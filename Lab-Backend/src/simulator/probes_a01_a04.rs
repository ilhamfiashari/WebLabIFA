use super::*;
use crate::simulator_catalog::LevelId;
use serde_json::{Value, json};

pub(super) fn sim_a01(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let actor = if input.actor.is_empty() {
        "rani"
    } else {
        input.actor.as_str()
    };
    let route_kind = if input.action == "invoice" {
        "invoices"
    } else {
        "orders"
    };
    let raw_target = if input.target.is_empty() {
        "101"
    } else {
        input.target.trim()
    };
    let target = raw_target.strip_prefix("INV-").unwrap_or(raw_target);
    let path = format!("/api/{route_kind}/{target}");
    let headers = if actor == "anon" {
        vec![("Host".into(), "demo.lab.ifa".into())]
    } else {
        vec![
            ("Host".into(), "demo.lab.ifa".into()),
            (
                "Cookie".into(),
                format!("demo_session={actor}_tok_redacted"),
            ),
        ]
    };

    let owner = match target {
        "101" | "7f9a-101" => Some((
            "rani",
            "Order #101",
            "Rani Wijaya",
            "ESP32 DevKit + Sensor",
            "Rp185.000",
        )),
        "102" | "9c4e-102" => Some((
            "bima",
            "Order #102",
            "Bima Pratama",
            "Gateway LoRaWAN + Kabel",
            "Rp640.000",
        )),
        _ => None,
    };

    let secure_patch = is_target_patch("a01-idor", patch);
    let (status, body, events, exploit, baseline) = if actor == "anon" {
        (
            401,
            json!({"error": "Sesi tidak ditemukan"}).to_string(),
            vec![trace(
                "Auth",
                "SessionExtractor",
                "TOLAK 401",
                "Permintaan anonim tanpa cookie sesi ditolak",
                "warn",
            )],
            false,
            false,
        )
    } else if let Some((own, label, full_name, item, total)) = owner {
        let same_owner = own == actor;
        let check_enforced = if secure_patch {
            true
        } else {
            match level {
                LevelId::Easy | LevelId::Medium => false,
                LevelId::Hard => route_kind == "orders",
                LevelId::Impossible => true,
            }
        };
        if same_owner {
            (
                200,
                json!({"id": target, "label": label, "owner_id": own, "customer": full_name, "item": item, "total": total, "route": route_kind}).to_string(),
                vec![
                    trace("Auth", "SessionExtractor", "OK", &format!("Aktor sesi: {actor}"), "good"),
                    trace("Policy", "OrderPolicy", if check_enforced { "ALLOW (owner == actor)" } else { "SKIPPED (no check)" }, &format!("Objek {target} milik {own}"), "good"),
                ],
                false,
                true,
            )
        } else if check_enforced {
            (
                403,
                json!({"error": "Anda tidak berhak mengakses objek ini", "correlation_id": cid})
                    .to_string(),
                vec![
                    trace(
                        "Auth",
                        "SessionExtractor",
                        "OK",
                        &format!("Aktor sesi: {actor}"),
                        "good",
                    ),
                    trace(
                        "Policy",
                        "OrderPolicy",
                        "TOLAK 403",
                        &format!("owner_id ({own}) != actor ({actor}); DTO tidak dikirim"),
                        "good",
                    ),
                ],
                false,
                false,
            )
        } else {
            (
                200,
                json!({"id": target, "label": label, "owner_id": own, "customer": full_name, "item": item, "total": total, "warning": "CROSS_ACCOUNT_LEAK"}).to_string(),
                vec![
                    trace("Auth", "SessionExtractor", "OK", &format!("Aktor sesi: {actor}"), "info"),
                    trace("Policy", "Handler Lookup", "BYPASS", &format!("Data milik {own} dikembalikan ke {actor} tanpa pemeriksaan pemilik!"), "bad"),
                ],
                true,
                false,
            )
        }
    } else {
        (
            404,
            json!({"error": "Objek tidak ditemukan"}).to_string(),
            vec![trace(
                "Lookup",
                "OrderRepo",
                "404 Not Found",
                &format!("ID {target} tidak ada di basis data"),
                "muted",
            )],
            false,
            false,
        )
    };

    ProbeOutcome {
        request: RequestPreview {
            method: "GET".into(),
            path,
            headers,
            body: String::new(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![
                ("Content-Type".into(), "application/json".into()),
                ("Cache-Control".into(), "no-store".into()),
            ],
            body,
            correlation_id: cid.into(),
        },
        events,
        visual_data: json!({ "kind": "idor", "actor": actor, "target": target, "route": route_kind, "status": status, "enforced": secure_patch || level == LevelId::Impossible }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: status == 200 && !exploit,
        updated_state: state,
    }
}

pub(super) fn sim_a02(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a02-misconfig", patch);
    let partial = patch == "hide-trace-only";
    let action = if input.action.is_empty() {
        "health"
    } else {
        input.action.as_str()
    };
    let (method, path, req_body, status, body, events, exploit, baseline) = match action {
        "parse_error" => {
            let safe_app = secure || partial || matches!(level, LevelId::Medium | LevelId::Hard | LevelId::Impossible);
            if safe_app {
                ("POST", "/api/items/parse", "{broken_json", 400, json!({"message": "Format JSON tidak valid.", "correlation_id": cid}).to_string(),
                 vec![trace("AppError", "IntoResponse", "AMAN", &format!("Detail error disimpan ke log internal teredaksi ({cid})"), "good")], false, false)
            } else {
                ("POST", "/api/items/parse", "{broken_json", 500, json!({"error": "ParseError at /srv/ifa-lab/src/items.rs:42", "env": "APP_ENV=dev", "db_host": "127.0.0.1:5432"}).to_string(),
                 vec![trace("AppError", "DebugFormat", "BOCOR", "Stack trace & path server tercetak langsung ke respons HTTP!", "bad")], true, false)
            }
        }
        "proxy_fallback" => {
            let safe_proxy = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
            if safe_proxy {
                ("GET", "/proxy-fallback-test", "", 502, json!({"message": "Layanan sementara sibuk.", "correlation_id": cid}).to_string(),
                 vec![trace("Edge", "Nginx", "AMAN", "server_tokens off; halaman fallback generik aktif", "good")], false, false)
            } else {
                ("GET", "/proxy-fallback-test", "", 502, "<html><h1>502 Bad Gateway</h1><p>nginx/1.26.1 upstream: 127.0.0.1:3008 (/srv/ifa-lab)</p></html>".into(),
                 vec![trace("Edge", "Nginx Fallback", "BOCOR", "Halaman error default proxy memaparkan versi & upstream internal", "bad")], true, false)
            }
        }
        "backup_probe" => {
            let safe_backup = secure || level == LevelId::Impossible;
            if safe_backup {
                ("GET", "/backup.sql.bak", "", 404, json!({"message": "Sumber daya tidak ditemukan."}).to_string(),
                 vec![trace("Edge", "Static Location Deny", "DITOLAK 404", "Berkas .bak / _debug diblokir pada konfigurasi rilis", "good")], false, false)
            } else {
                ("GET", "/backup.sql.bak", "", 200, "-- IFA LAB DUMP\nCREATE TABLE demo_users (...);\n-- DEBUG_ROUTE=/_debug/routes".into(),
                 vec![trace("Edge", "Static Root", "BOCOR", "File cadangan /backup.sql.bak dapat diunduh publik!", "bad")], true, false)
            }
        }
        _ => ("GET", "/api/health", "", 200, json!({"status": "ok", "profile": if secure || level == LevelId::Impossible { "production" } else { "staging-debug" }}).to_string(),
              vec![trace("Health", "Router", "200 OK", "Endpoint sehat merespons normal", "good")], false, true),
    };

    ProbeOutcome {
        request: RequestPreview {
            method: method.into(),
            path: path.into(),
            headers: vec![("Host".into(), "demo.lab.ifa".into())],
            body: req_body.into(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![("X-Content-Type-Options".into(), "nosniff".into())],
            body,
            correlation_id: cid.into(),
        },
        events,
        visual_data: json!({ "kind": "misconfig", "action": action, "correlation_id": cid, "internal_log": format!("cid={cid} path={path} status={status} [REDACTED_PARAMS]") }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: action == "health" && status == 200,
        updated_state: state,
    }
}

pub(super) fn sim_a03(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a03-supply-chain", patch);
    let partial = patch == "direct-audit-only";
    let artifact = if input.target.is_empty() {
        "release-v1.4"
    } else {
        input.target.as_str()
    };
    let (status, allowed, reason, events, exploit, baseline) = match artifact {
        "core-clean" => (
            200,
            true,
            "Artefak resmi `ilhamfiashari/WebLabIFA`, SBOM bersih, digest cocok",
            vec![trace(
                "Gate",
                "SLSA+SCA",
                "LULUS",
                "Digest SHA-256 & builder resmi terverifikasi",
                "good",
            )],
            false,
            true,
        ),
        "direct-cve" => {
            let blocked = secure || partial || level != LevelId::Easy;
            if blocked {
                (
                    422,
                    false,
                    "Diblokir SCA: `ifa-xml@1.2.0` (CVE-2026-001 Critical)",
                    vec![trace(
                        "Gate",
                        "SCA",
                        "BLOKIR",
                        "Dependensi langsung rentan ditolak",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                (
                    200,
                    true,
                    "Lolos tanpa SCA: `ifa-xml@1.2.0` masuk ke rilis!",
                    vec![trace(
                        "Gate",
                        "No-SCA",
                        "LOLOS RENTAN",
                        "Advisory kritis pada lockfile tidak dicek",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        "transitive-cve" => {
            let blocked = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
            if blocked {
                (
                    422,
                    false,
                    "Diblokir SBOM Transitif: `auth-helper@3.0 -> fast-parse@0.4.1`",
                    vec![trace(
                        "Gate",
                        "SBOM Tree",
                        "BLOKIR",
                        "Dependensi transitif rentan terdeteksi di lockfile",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                (
                    200,
                    true,
                    "Lolos: pengecekan top-level tidak melihat transitif `fast-parse@0.4.1`!",
                    vec![trace(
                        "Gate",
                        "Shallow Audit",
                        "LOLOS RENTAN",
                        "Transitif ber-CVE terlewat ke artefak rilis",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        "untrusted-builder" => {
            if secure || level == LevelId::Impossible {
                (
                    403,
                    false,
                    "Diblokir SLSA: builder `evil-fork/ci` bukan repo resmi",
                    vec![trace(
                        "Gate",
                        "SLSA Attestation",
                        "BLOKIR",
                        "Identitas builder & workflow tidak sesuai kebijakan",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                (
                    200,
                    true,
                    "Lolos! SCA bersih & tag v1.4.0 cocok meski dibangun oleh `evil-fork/ci`",
                    vec![trace(
                        "Gate",
                        "Tag-Only",
                        "LOLOS RENTAN",
                        "Provenance asal build tidak diverifikasi!",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        _ => {
            if secure || level == LevelId::Impossible {
                (
                    403,
                    false,
                    "Diblokir: digest berubah / advisory baru terdeteksi",
                    vec![trace(
                        "Gate",
                        "Integrity",
                        "BLOKIR",
                        "Hash artefak tidak cocok dengan attestation",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                (
                    200,
                    true,
                    "Artefak dimodifikasi lolos tanpa pemeriksaan integritas!",
                    vec![trace(
                        "Gate",
                        "Bypass",
                        "LOLOS RENTAN",
                        "Digest tidak divalidasi",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
    };

    ProbeOutcome {
        request: RequestPreview {
            method: "POST".into(),
            path: format!("/api/ci/promote/{artifact}"),
            headers: vec![("X-CI-Workflow".into(), "release.yml".into())],
            body: json!({"artifact": artifact}).to_string(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![("Content-Type".into(), "application/json".into())],
            body: json!({"artifact": artifact, "promoted": allowed, "reason": reason}).to_string(),
            correlation_id: cid.into(),
        },
        events,
        visual_data: json!({
            "kind": "supply_chain",
            "artifact": artifact,
            "promoted": allowed,
            "tree": [
                {"name": "ifa-core@2.1.0", "type": "direct", "status": "clean"},
                {"name": "ifa-xml@1.2.0", "type": "direct", "status": if artifact == "direct-cve" { "critical-cve" } else { "patched-1.2.4" }},
                {"name": "auth-helper@3.0 -> fast-parse@0.4.1", "type": "transitive", "status": if artifact == "transitive-cve" { "critical-cve" } else { "patched-0.4.9" }},
            ],
            "slsa_builder": if artifact == "untrusted-builder" { "evil-fork/ci" } else { "ilhamfiashari/WebLabIFA" },
        }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: artifact == "core-clean" && allowed,
        updated_state: state,
    }
}

pub(super) fn sim_a04(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a04-crypto", patch);
    let action = if input.action.is_empty() {
        "inspect_dump"
    } else {
        input.action.as_str()
    };
    let password = if input.payload.is_empty() {
        "PraktikumAman26!"
    } else {
        input.payload.as_str()
    };

    let (status, body, events, exploit, baseline, records) = match action {
        "login_wrong_legacy" => {
            let safe_rehash = secure || level == LevelId::Impossible;
            if safe_rehash {
                (401, json!({"authenticated": false, "rehashed": false, "message": "Password salah; record lama tidak diubah."}).to_string(),
                 vec![trace("Auth", "Argon2Verifier", "TOLAK 401", "Verifikasi gagal; tidak ada penulisan rehash ke database", "good")], false, false, json!([]))
            } else if level == LevelId::Hard || patch == "rehash-always" {
                (401, json!({"authenticated": false, "rehashed": true, "warning": "BUG: hash lama tertimpa meski login salah!"}).to_string(),
                 vec![trace("Auth", "LegacyMigration", "BAHAYA", "Logika rehash menimpa record meskipun password salah!", "bad")], true, false, json!([]))
            } else {
                (401, json!({"authenticated": false, "rehashed": false}).to_string(),
                 vec![trace("Auth", "Verifier", "401", "Password salah", "info")], false, false, json!([]))
            }
        }
        "login_valid" => {
            (200, json!({"authenticated": true, "user": "rani_demo", "hash_scheme": if secure || level == LevelId::Impossible { "argon2id-phc" } else { "legacy" }}).to_string(),
             vec![trace("Auth", "PasswordVerifier", "200 OK", "Verifikasi password sah berhasil", "good")], false, true, json!([]))
        }
        _ => {
            let (scheme, rani_hash, bima_hash, leak) = if secure || level == LevelId::Impossible {
                ("Argon2id (Salt acak unik)", "$argon2id$v=19$m=19456,t=2,p=1$R4n1S4lt9x$kP8mZ...", "$argon2id$v=19$m=19456,t=2,p=1$B1m4S4lt3q$wQ2vX...", false)
            } else if level == LevelId::Easy && patch == "vulnerable" {
                ("Plaintext (Tanpa hash)", password, password, true)
            } else if patch == "sha256-global-salt" || level == LevelId::Medium {
                ("SHA-256 Tanpa Salt Unik", "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", true)
            } else {
                ("Campuran Legacy + Argon2id", "sha256$9f86d08188...", "$argon2id$v=19$...", true)
            };
            let recs = json!([
                {"user": "rani_demo", "scheme": scheme, "stored": rani_hash},
                {"user": "bima_demo", "scheme": scheme, "stored": bima_hash},
            ]);
            (
                200,
                json!({"scheme": scheme, "identical_hashes": rani_hash == bima_hash, "records": recs}).to_string(),
                vec![trace("Inspect", "CredentialDump", if leak { "RENTAN" } else { "AMAN" }, &format!("Skema aktif: {scheme}"), if leak { "bad" } else { "good" })],
                leak,
                false,
                recs,
            )
        }
    };

    ProbeOutcome {
        request: RequestPreview {
            method: "POST".into(),
            path: format!("/demo/crypto/{action}"),
            headers: vec![],
            body: json!({"user": "rani_demo", "password": "[REDACTED]"}).to_string(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![],
            body,
            correlation_id: cid.into(),
        },
        events,
        visual_data: json!({ "kind": "crypto", "action": action, "records": records }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: action == "login_valid" && status == 200,
        updated_state: state,
    }
}
