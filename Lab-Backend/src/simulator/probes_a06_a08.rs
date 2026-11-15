use super::*;
use crate::simulator_catalog::LevelId;
use serde_json::{Value, json};

pub(super) fn sim_a06_coupon(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a06-coupon", patch);
    let actor = if input.actor.is_empty() {
        "rani"
    } else {
        input.actor.as_str()
    };
    let cart = if input.target.is_empty() {
        "cart-a"
    } else {
        input.target.as_str()
    };
    let expired = input.action == "expired" || state["expired"].as_bool().unwrap_or(false);
    let mut redeemed: Vec<String> = state["redeemed_by"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let checks_history = secure
        || matches!(level, LevelId::Hard | LevelId::Impossible)
        || patch == "check-then-insert";
    let atomic = secure || level == LevelId::Impossible;

    let (status, discount_count, msg, events, exploit, baseline) = if expired
        && (secure || level == LevelId::Impossible)
    {
        (
            422,
            0,
            "Kupon KELAS10 sudah kedaluwarsa menurut waktu server.",
            vec![trace(
                "Clock",
                "ServerTime",
                "TOLAK 422",
                "Masa berlaku kupon berakhir",
                "good",
            )],
            false,
            false,
        )
    } else if input.parallel {
        if atomic {
            let already = redeemed.iter().any(|u| u == actor);
            if already {
                (
                    409,
                    0,
                    "Kedua request paralel ditolak karena kupon sudah terpakai.",
                    vec![trace(
                        "DB",
                        "UniqueConstraint",
                        "TOLAK 409",
                        "Constraint unik mencegah pemakaian ulang",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                redeemed.push(actor.into());
                (
                    200,
                    1,
                    "Barrier 2 request paralel: Request #1 COMMIT (200), Request #2 ditolak CONFLICT (409).",
                    vec![
                        trace(
                            "Barrier",
                            "Tx1",
                            "COMMIT 200",
                            "INSERT ... ON CONFLICT RETURNING 1 row",
                            "good",
                        ),
                        trace(
                            "Barrier",
                            "Tx2",
                            "CONFLICT 409",
                            "ON CONFLICT DO NOTHING mengembalikan 0 row",
                            "good",
                        ),
                    ],
                    false,
                    true,
                )
            }
        } else {
            redeemed.push(actor.into());
            redeemed.push(actor.into());
            (
                200,
                2,
                "RACE CONDITION: Kedua request paralel lolos dan diskon diterapkan 2 kali!",
                vec![trace(
                    "Barrier",
                    "Tx1 & Tx2",
                    "TOCTOU RACE",
                    "Keduanya membaca count=0 sebelum menulis redeem!",
                    "bad",
                )],
                true,
                false,
            )
        }
    } else {
        let already = redeemed.iter().any(|u| u == actor);
        if already && checks_history {
            (
                409,
                0,
                "Kupon KELAS10 sudah pernah dipakai oleh akun ini.",
                vec![trace(
                    "Coupon",
                    "PolicyCheck",
                    "TOLAK 409",
                    &format!("{actor} sudah memakai kupon"),
                    "good",
                )],
                false,
                false,
            )
        } else {
            let is_repeat = already;
            redeemed.push(actor.into());
            (
                200,
                1,
                if is_repeat {
                    "Kupon diterima ulang oleh API (celah bisnis!)"
                } else {
                    "Kupon KELAS10 diterapkan (diskon Rp10.000)."
                },
                vec![trace(
                    "Coupon",
                    "Checkout",
                    if is_repeat { "BYPASS" } else { "APPLY" },
                    if is_repeat {
                        "Kupon berhasil diklaim lebih dari sekali!"
                    } else {
                        "Klaim pertama berhasil"
                    },
                    if is_repeat { "bad" } else { "good" },
                )],
                is_repeat,
                !is_repeat,
            )
        }
    };

    state["redeemed_by"] = json!(redeemed);
    let rani_count = redeemed.iter().filter(|u| *u == "rani").count();
    let bima_count = redeemed.iter().filter(|u| *u == "bima").count();

    ProbeOutcome {
        request: RequestPreview { method: "POST".into(), path: format!("/api/checkout/{cart}/coupon"), headers: vec![("X-Actor".into(), actor.into())], body: json!({"code": "KELAS10", "parallel_barrier": input.parallel}).to_string() },
        response: ResponsePreview { status, status_text: status_text(status), headers: vec![], body: json!({"message": msg, "discounts_applied_now": discount_count, "rani_total_redeems": rani_count, "bima_total_redeems": bima_count}).to_string(), correlation_id: cid.into() },
        events,
        visual_data: json!({ "kind": "coupon", "rani_redeems": rani_count, "bima_redeems": bima_count, "state": if rani_count > 0 { "Redeemed" } else { "Eligible" } }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: status == 200 && !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_a07_auth(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a07-auth", patch);
    let action = if input.action.is_empty() {
        "login_valid"
    } else {
        input.action.as_str()
    };
    let ip = if input.actor.is_empty() {
        "10.0.1.1"
    } else {
        input.actor.as_str()
    };
    let target_email = if input.target.is_empty() {
        "rani@demo.local"
    } else {
        input.target.as_str()
    };

    if input.advance_minutes > 0 {
        let cur = state["clock_min"].as_i64().unwrap_or(0) + input.advance_minutes;
        state["clock_min"] = json!(cur);
        if input.advance_minutes >= 15 {
            state["attempts_by_ip"] = json!({});
            state["attempts_by_account"] = json!({});
        }
    }

    let ip_limited = secure
        || matches!(level, LevelId::Medium | LevelId::Hard | LevelId::Impossible)
        || patch == "ip-limit-only";
    let acct_limited = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
    let recovery_safe = secure || level == LevelId::Impossible;

    let (status, body, events, exploit, baseline) = match action {
        "login_burst" => {
            let mut ip_map = state["attempts_by_ip"]
                .as_object()
                .cloned()
                .unwrap_or_default();
            let mut acct_map = state["attempts_by_account"]
                .as_object()
                .cloned()
                .unwrap_or_default();
            let ip_cnt = ip_map.get(ip).and_then(|v| v.as_i64()).unwrap_or(0) + 5;
            let acct_cnt = acct_map
                .get(target_email)
                .and_then(|v| v.as_i64())
                .unwrap_or(0)
                + 5;
            ip_map.insert(ip.into(), json!(ip_cnt));
            acct_map.insert(target_email.into(), json!(acct_cnt));
            state["attempts_by_ip"] = Value::Object(ip_map);
            state["attempts_by_account"] = Value::Object(acct_map);

            let blocked = (acct_limited && acct_cnt >= 5)
                || (ip_limited && ip_cnt >= 5 && ip == "10.0.1.1" && !acct_limited);
            if patch == "permanent-lockout" {
                (
                    423,
                    json!({"message": "Akun dikunci permanen! Pengguna sah tidak dapat pulih."})
                        .to_string(),
                    vec![trace(
                        "Limiter",
                        "PermanentLock",
                        "DOS RISK",
                        "Lockout permanen memblokir korban selamanya",
                        "bad",
                    )],
                    true,
                    false,
                )
            } else if blocked {
                (429, json!({"message": "Terlalu banyak percobaan. Tunggu 15 menit pada jam virtual.", "retry_after_min": 15}).to_string(),
                 vec![trace("Limiter", "AccountBucket", "THROTTLE 429", &format!("Burst ke {target_email} (IP {ip}) diblokir"), "good")], false, false)
            } else {
                (401, json!({"message": "Kredensial salah (burst lolos tanpa 429!)", "acct_attempts": acct_cnt, "ip": ip}).to_string(),
                 vec![trace("Limiter", "Bypass", "LOLOS 401", &format!("IP {ip} mengirim burst ke {target_email} tanpa dibatasi!"), "bad")], true, false)
            }
        }
        "recovery_probe" => {
            let exists = target_email == "rani@demo.local";
            if recovery_safe {
                (
                    200,
                    json!({"message": "Jika akun terdaftar, tautan pemulihan telah dikirim."})
                        .to_string(),
                    vec![trace(
                        "Recovery",
                        "GenericResponse",
                        "AMAN",
                        "Pesan identik untuk email terdaftar maupun tidak terdaftar",
                        "good",
                    )],
                    false,
                    true,
                )
            } else if exists {
                (
                    200,
                    json!({"message": "Tautan reset dikirim ke rani@demo.local"}).to_string(),
                    vec![trace(
                        "Recovery",
                        "Enumeration",
                        "INFO",
                        "Email terdaftar mengembalikan 200",
                        "info",
                    )],
                    false,
                    true,
                )
            } else {
                (
                    404,
                    json!({"message": "Email tidak terdaftar di sistem!"}).to_string(),
                    vec![trace(
                        "Recovery",
                        "Enumeration",
                        "BOCOR",
                        "Status 404 membedakan akun ada vs tidak ada!",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        "replay_reset_token" => {
            let tok = if input.payload.is_empty() {
                "rst-2026-rani"
            } else {
                input.payload.as_str()
            };
            let mut used: Vec<String> = state["used_tokens"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default();
            let already_used = used.iter().any(|t| t == tok);
            if already_used && recovery_safe {
                (
                    401,
                    json!({"message": "Token pemulihan sudah digunakan atau kedaluwarsa."})
                        .to_string(),
                    vec![trace(
                        "Recovery",
                        "OneTimeToken",
                        "TOLAK 401",
                        "Token sekali pakai ditolak saat replay",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                used.push(tok.into());
                state["used_tokens"] = json!(used);
                let replay_bug = already_used;
                (200, json!({"message": if replay_bug { "Replay token berhasil mereset password lagi!" } else { "Token valid pertama digunakan." }}).to_string(),
                 vec![trace("Recovery", "ResetToken", if replay_bug { "REPLAY BUG" } else { "USED 1x" }, if replay_bug { "Token lama diterima dua kali!" } else { "Penggunaan pertama sukses" }, if replay_bug { "bad" } else { "good" })],
                 replay_bug, !replay_bug)
            }
        }
        _ => {
            let acct_cnt = state["attempts_by_account"]
                .get(target_email)
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            if patch == "permanent-lockout" && acct_cnt > 0 {
                (
                    423,
                    json!({"message": "Akun terkunci permanen!"}).to_string(),
                    vec![trace(
                        "Auth",
                        "Lock",
                        "LOCKOUT",
                        "Akun sah terblokir permanen",
                        "bad",
                    )],
                    true,
                    false,
                )
            } else if acct_limited && acct_cnt >= 5 {
                (
                    429,
                    json!({"message": "Cooldown masih aktif. Majukan jam virtual +15 menit."})
                        .to_string(),
                    vec![trace(
                        "Limiter",
                        "Cooldown",
                        "429",
                        "Menunggu cooldown selesai",
                        "warn",
                    )],
                    false,
                    false,
                )
            } else {
                (200, json!({"authenticated": true, "user": target_email, "clock_min": state["clock_min"]}).to_string(),
                 vec![trace("Auth", "Login", "200 OK", "Login sah berhasil", "good")], false, true)
            }
        }
    };

    ProbeOutcome {
        request: RequestPreview {
            method: "POST".into(),
            path: format!("/demo/{action}"),
            headers: vec![("X-Forwarded-For".into(), ip.into())],
            body: json!({"email": target_email, "ip": ip}).to_string(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![],
            body,
            correlation_id: cid.into(),
        },
        events,
        visual_data: json!({ "kind": "auth", "clock_min": state["clock_min"], "attempts_by_account": state["attempts_by_account"], "attempts_by_ip": state["attempts_by_ip"] }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: status == 200 && !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_a08_webhook(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a08-webhook", patch);
    let case = if input.action.is_empty() {
        "valid"
    } else {
        input.action.as_str()
    };
    let mut processed: Vec<String> = state["processed_events"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let checks_sig = secure
        || matches!(level, LevelId::Medium | LevelId::Hard | LevelId::Impossible)
        || patch == "sig-without-dedup";
    let uses_raw_bytes = secure
        || matches!(level, LevelId::Hard | LevelId::Impossible)
        || patch == "sig-without-dedup";
    let checks_fresh_dedup = secure || level == LevelId::Impossible;

    let (status, msg, events, exploit, baseline) = match case {
        "unsigned_tamper" => {
            if checks_sig {
                (
                    401,
                    "Tanda tangan HMAC tidak ada atau tidak valid.",
                    vec![trace(
                        "Webhook",
                        "HmacVerifier",
                        "TOLAK 401",
                        "Signature tidak cocok",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                state["order_status"] = json!("PAID");
                (
                    200,
                    "Order ORD-500 berubah menjadi PAID tanpa tanda tangan!",
                    vec![trace(
                        "Webhook",
                        "NoSignature",
                        "PALSU DITERIMA",
                        "Webhook tanpa HMAC mengubah status order!",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        "spaced_valid_json" => {
            if uses_raw_bytes {
                state["order_status"] = json!("PAID");
                (
                    200,
                    "Raw body bytes cocok persis dengan HMAC penyedia.",
                    vec![trace(
                        "Webhook",
                        "RawBytes",
                        "200 OK",
                        "Verifikasi buffer mentah berhasil meski format spasi JSON bervariasi",
                        "good",
                    )],
                    false,
                    true,
                )
            } else {
                (
                    401,
                    "Gagal: implementasi menghitung HMAC dari JSON.stringify(), bukan raw bytes!",
                    vec![trace(
                        "Webhook",
                        "Reserialized",
                        "MISMATCH",
                        "Re-serialization merusak kecocokan HMAC buffer asli",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        "replay_event" => {
            let already = processed.iter().any(|e| e == "evt-01");
            if checks_fresh_dedup && already {
                (
                    200,
                    "Event evt-01 sudah pernah diproses (respons idempoten tanpa mutasi ulang).",
                    vec![trace(
                        "Webhook",
                        "DedupKey",
                        "IDEMPOTENT",
                        "Constraint (provider, evt-01) mencegah efek ganda",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                processed.push("evt-01".into());
                state["amount_paid"] = json!(state["amount_paid"].as_i64().unwrap_or(0) + 150000);
                let is_dup = already;
                (
                    200,
                    if is_dup {
                        "REPLAY: evt-01 diproses ulang dan saldo bertambah ganda!"
                    } else {
                        "Event evt-01 diproses pertama kali."
                    },
                    vec![trace(
                        "Webhook",
                        "Processor",
                        if is_dup { "REPLAY BUG" } else { "COMMIT" },
                        if is_dup {
                            "Event duplikat memicu kredit ganda!"
                        } else {
                            "Commit pertama berhasil"
                        },
                        if is_dup { "bad" } else { "good" },
                    )],
                    is_dup,
                    !is_dup,
                )
            }
        }
        "expired_or_mismatch" => {
            if checks_fresh_dedup {
                (
                    422,
                    "Ditolak: timestamp kedaluwarsa (>300s) atau nominal tidak cocok dengan tagihan 150000 IDR.",
                    vec![trace(
                        "Webhook",
                        "Freshness&Amount",
                        "TOLAK 422",
                        "Timestamp / nominal gagal validasi",
                        "good",
                    )],
                    false,
                    false,
                )
            } else {
                state["order_status"] = json!("PAID");
                state["amount_paid"] = json!(100);
                (
                    200,
                    "Order dilunasi dengan event kedaluwarsa / nominal Rp100!",
                    vec![trace(
                        "Webhook",
                        "NoFreshness",
                        "BYPASS",
                        "Nominal & kesegaran waktu tidak divalidasi!",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        _ => {
            if !processed.iter().any(|e| e == "evt-01") {
                processed.push("evt-01".into());
                state["order_status"] = json!("PAID");
                state["amount_paid"] = json!(150000);
            }
            (
                200,
                "Webhook sah diverifikasi dan ORD-500 lunas tepat 1x.",
                vec![trace(
                    "Webhook",
                    "Pipeline",
                    "200 OK",
                    "Signature, freshness, nominal, dan dedup lolos",
                    "good",
                )],
                false,
                true,
            )
        }
    };

    state["processed_events"] = json!(processed);

    ProbeOutcome {
        request: RequestPreview { method: "POST".into(), path: "/api/webhook/payment".into(), headers: vec![("X-Signature".into(), if case == "unsigned_tamper" { "missing" } else { "t=1700000,v1=hmac_sha256_valid" }.into())], body: json!({"event_id": "evt-01", "order_id": "ORD-500", "scenario": case}).to_string() },
        response: ResponsePreview { status, status_text: status_text(status), headers: vec![], body: json!({"message": msg, "order_status": state["order_status"], "amount_paid": state["amount_paid"]}).to_string(), correlation_id: cid.into() },
        events,
        visual_data: json!({ "kind": "webhook", "order_status": state["order_status"], "amount_paid": state["amount_paid"], "events_count": processed.len() }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: status == 200 && !exploit,
        updated_state: state.clone(),
    }
}
