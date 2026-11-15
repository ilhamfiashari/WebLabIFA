use super::*;
use crate::simulator_catalog::LevelId;
use serde_json::{Value, json};

pub(super) fn sim_a05_sqli(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a05-sqli", patch);
    let where_parameterized = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
    let sort_mapped = secure || level == LevelId::Impossible;

    if input.action == "login_form" {
        let username = if input.payload.is_empty() {
            "rani"
        } else {
            input.payload.as_str()
        };
        let password = input.secondary.as_str();
        let u_lower = username.to_ascii_lowercase();
        let p_lower = password.to_ascii_lowercase();

        let (status, query_preview, ast_tokens, logged_user, events, exploit, baseline) =
            if !where_parameterized {
                let filtered_u = if level == LevelId::Medium || patch == "blacklist-quotes" {
                    username
                        .replace(" OR ", " ")
                        .replace('\'', if patch == "blacklist-quotes" { "" } else { "'" })
                } else {
                    username.to_string()
                };
                let fu_lower = filtered_u.to_ascii_lowercase();
                let comment_bypass = u_lower.contains("'--")
                    || u_lower.contains("' --")
                    || u_lower.contains("'/*")
                    || u_lower.contains("'#");
                let tautology_bypass = fu_lower.contains(" or ")
                    || fu_lower.contains("1=1")
                    || p_lower.contains("' or")
                    || p_lower.contains("1=1");
                let bypass = tautology_bypass || (comment_bypass && patch != "blacklist-quotes");
                let broken_quote = (username.contains('\'') || password.contains('\''))
                    && !bypass
                    && patch != "blacklist-quotes";

                if broken_quote {
                    (
                        500,
                        format!(
                            "SELECT id, username, role FROM accounts WHERE username='{filtered_u}' AND password_hash='...' -- SQL SYNTAX ERROR"
                        ),
                        vec![
                            "SELECT".into(),
                            "id, role".into(),
                            "FROM accounts".into(),
                            "WHERE".into(),
                            format!("username='{filtered_u}'"),
                            "SYNTAX ERROR".into(),
                        ],
                        None,
                        vec![trace(
                            "SQL Auth",
                            "StringConcat",
                            "ERROR 500",
                            "Tanda kutip mematahkan query login dan membocorkan error SQL!",
                            "bad",
                        )],
                        true,
                        false,
                    )
                } else if bypass {
                    let target_role = if u_lower.contains("admin") {
                        "admin (Dosen Lab)"
                    } else {
                        "admin (Bypassed Account #1)"
                    };
                    (
                        200,
                        format!(
                            "SELECT id, username, role FROM accounts WHERE username='{filtered_u}' AND password_hash='***' -> KLAUSA PASSWORD TERABAIKAN / TAUTOLOGI TRUE!"
                        ),
                        vec![
                            "SELECT".into(),
                            "id, role".into(),
                            "FROM accounts".into(),
                            "WHERE".into(),
                            format!("username='{filtered_u}'"),
                            if comment_bypass {
                                "-- COMMENTED OUT"
                            } else {
                                "OR 1=1 TRUE"
                            }
                            .into(),
                        ],
                        Some(target_role),
                        vec![trace(
                            "SQL Auth",
                            "LoginQuery",
                            "BYPASS LOGIN",
                            "Injeksi pada form login melewati verifikasi password dan masuk sebagai admin!",
                            "bad",
                        )],
                        true,
                        false,
                    )
                } else if username == "rani" && password == "praktikum2026" {
                    (
                        200,
                        format!(
                            "SELECT id, username, role FROM accounts WHERE username='{filtered_u}' AND password_hash='sha256(...)'"
                        ),
                        vec![
                            "SELECT".into(),
                            "id, role".into(),
                            "FROM accounts".into(),
                            "WHERE".into(),
                            "username='rani'".into(),
                            "AND password_hash=MATCH".into(),
                        ],
                        Some("rani (Mahasiswa)"),
                        vec![trace(
                            "SQL Auth",
                            "LoginQuery",
                            "200 OK",
                            "Login sah berhasil dengan akun demo rani",
                            "good",
                        )],
                        false,
                        true,
                    )
                } else {
                    (
                        401,
                        format!(
                            "SELECT id, username, role FROM accounts WHERE username='{filtered_u}' AND password_hash='***'"
                        ),
                        vec![
                            "SELECT".into(),
                            "id, role".into(),
                            "FROM accounts".into(),
                            "WHERE".into(),
                            format!("username='{filtered_u}'"),
                            "401 DENIED".into(),
                        ],
                        None,
                        vec![trace(
                            "SQL Auth",
                            "LoginQuery",
                            "401 TOLAK",
                            "Username atau password tidak cocok",
                            "warn",
                        )],
                        false,
                        false,
                    )
                }
            } else if username == "rani" && password == "praktikum2026" {
                (
                    200,
                    "SELECT id, username, role FROM accounts WHERE username = $1 AND password_hash = $2 [bind $1 = \"rani\"]".into(),
                    vec![
                        "SELECT".into(),
                        "id, role".into(),
                        "FROM accounts".into(),
                        "WHERE".into(),
                        "$1 = \"rani\"".into(),
                        "AND $2 = HASH_MATCH".into(),
                    ],
                    Some("rani (Mahasiswa)"),
                    vec![trace(
                        "SQLx",
                        "PreparedAuth",
                        "200 AMAN",
                        "Login sah terverifikasi dengan bind parameter $1/$2",
                        "good",
                    )],
                    false,
                    true,
                )
            } else {
                (
                    401,
                    format!(
                        "SELECT id, username, role FROM accounts WHERE username = $1 AND password_hash = $2 [bind $1 = \"{username}\"]"
                    ),
                    vec![
                        "SELECT".into(),
                        "id, role".into(),
                        "FROM accounts".into(),
                        "WHERE".into(),
                        format!("$1 = \"{username}\""),
                        "LITERAL TEXT (BLOCKED)".into(),
                    ],
                    None,
                    vec![trace(
                        "SQLx",
                        "PreparedAuth",
                        "TOLAK 401",
                        "Payload diperlakukan sebagai teks literal $1; bypass login gagal",
                        "good",
                    )],
                    false,
                    false,
                )
            };

        return ProbeOutcome {
            request: RequestPreview {
                method: "POST".into(),
                path: "/demo/login".into(),
                headers: vec![("Content-Type".into(), "application/json".into())],
                body: json!({ "username": username, "password": "[MASKED]" }).to_string(),
            },
            response: ResponsePreview {
                status,
                status_text: status_text(status),
                headers: vec![("Content-Type".into(), "application/json".into())],
                body: json!({
                    "authenticated": logged_user.is_some(),
                    "user": logged_user,
                    "bypassed": exploit,
                    "role": if exploit { "admin" } else if logged_user.is_some() { "mahasiswa" } else { "guest" },
                })
                .to_string(),
                correlation_id: cid.into(),
            },
            events,
            visual_data: json!({
                "kind": "sqli",
                "mode": "login_form",
                "keyword": username,
                "query_preview": query_preview,
                "ast_tokens": ast_tokens,
                "parameterized": where_parameterized,
                "sort_mapped": sort_mapped,
                "leaked_private": exploit,
                "authenticated": logged_user.is_some(),
                "logged_user": logged_user,
                "rows": [],
            }),
            baseline_captured: baseline,
            exploit_proved: exploit,
            is_legitimate: status == 200 && !exploit,
            updated_state: state,
        };
    }

    let keyword = if input.payload.is_empty() {
        "ESP32"
    } else {
        input.payload.as_str()
    };
    let sort = if input.target.is_empty() {
        "name_asc"
    } else {
        input.target.as_str()
    };
    let kw_lower = keyword.to_ascii_lowercase();

    let all_products = [
        ("p1", "ESP32 DevKit v1", "public", 95000),
        ("p2", "Kabel'Pro 1m", "public", 35000),
        ("p3", "Sensor Kelembapan v2", "public", 45000),
        ("p4", "Prototype Gateway Rahasia", "private", 9900000),
    ];

    let sort_valid = matches!(sort, "name_asc" | "price_desc");
    let sort_injection = !sort_valid
        && (sort.contains(';')
            || sort.contains("CASE")
            || sort.contains('(')
            || sort.contains("--"));
    let kw_injection =
        kw_lower.contains("' or") || kw_lower.contains("union select") || kw_lower.contains("1=1");

    let (status, rows, query_preview, events, exploit, baseline) = if !sort_valid && sort_mapped {
        (
            400,
            vec![],
            format!("REJECTED sort={sort} -> tidak ada di enum allowlist (name_asc | price_desc)"),
            vec![trace(
                "Validator",
                "SortEnum",
                "TOLAK 400",
                "Kolom urut di luar allowlist ditolak sebelum membangun kueri",
                "good",
            )],
            false,
            false,
        )
    } else if !where_parameterized {
        let filtered_kw = if level == LevelId::Medium || patch == "blacklist-quotes" {
            keyword
                .replace(" OR ", " ")
                .replace('\'', if patch == "blacklist-quotes" { "" } else { "'" })
        } else {
            keyword.to_string()
        };
        let leaked = filtered_kw.to_ascii_lowercase().contains(" or ")
            || filtered_kw.contains("1=1")
            || kw_injection && level == LevelId::Easy;
        let broken_quote = keyword.contains('\'') && !leaked && patch != "blacklist-quotes";
        if broken_quote {
            (
                500,
                vec![],
                format!(
                    "SELECT id, name FROM products WHERE visibility='public' AND name LIKE '%{filtered_kw}%' -- SYNTAX ERROR near '{filtered_kw}'"
                ),
                vec![trace(
                    "SQL Parser",
                    "StringConcat",
                    "ERROR 500",
                    "Tanda kutip sah mematahkan literal SQL!",
                    "bad",
                )],
                true,
                false,
            )
        } else if leaked {
            let matched: Vec<_> = all_products
                .iter()
                .map(|p| json!({"id": p.0, "name": p.1, "visibility": p.2, "price": p.3}))
                .collect();
            (
                200,
                matched,
                format!(
                    "SELECT id, name FROM products WHERE visibility='public' AND name LIKE '%{filtered_kw}%' -> kondisi OR 1=1 mem-bypass filter visibility!"
                ),
                vec![trace(
                    "SQL Parser",
                    "AST Break",
                    "INJECTION",
                    "Struktur WHERE berubah; produk PRIVATE ikut dikembalikan!",
                    "bad",
                )],
                true,
                false,
            )
        } else {
            let matched: Vec<_> = all_products
                .iter()
                .filter(|p| {
                    p.2 == "public"
                        && p.1
                            .to_ascii_lowercase()
                            .contains(&filtered_kw.to_ascii_lowercase())
                })
                .map(|p| json!({"id": p.0, "name": p.1, "visibility": p.2, "price": p.3}))
                .collect();
            (
                200,
                matched,
                format!(
                    "SELECT id, name FROM products WHERE visibility='public' AND name LIKE '%{filtered_kw}%'"
                ),
                vec![trace(
                    "SQL Parser",
                    "Query",
                    "200 OK",
                    "Pencarian normal mengembalikan produk public yang cocok",
                    "good",
                )],
                false,
                keyword == "ESP32",
            )
        }
    } else if !sort_mapped && sort_injection {
        let matched: Vec<_> = all_products
            .iter()
            .filter(|p| p.2 == "public")
            .map(|p| json!({"id": p.0, "name": p.1, "visibility": p.2, "price": p.3}))
            .collect();
        (
            200,
            matched,
            format!(
                "SELECT id, name FROM products WHERE visibility='public' AND name ILIKE $1 ORDER BY {sort} -- EKSPRESI SQL AKTIF!"
            ),
            vec![trace(
                "SQL Parser",
                "Dynamic ORDER BY",
                "INJECTION",
                "Klausa sort dievaluasi sebagai fragmen SQL mentah!",
                "bad",
            )],
            true,
            false,
        )
    } else {
        let matched: Vec<_> = all_products
            .iter()
            .filter(|p| p.2 == "public" && p.1.to_ascii_lowercase().contains(&kw_lower))
            .map(|p| json!({"id": p.0, "name": p.1, "visibility": p.2, "price": p.3}))
            .collect();
        let order_sql = if sort == "price_desc" {
            "price DESC"
        } else {
            "name ASC"
        };
        (
            200,
            matched,
            format!(
                "SELECT id, name FROM products WHERE visibility='public' AND name ILIKE $1 ORDER BY {order_sql} [bind $1 = \"%{keyword}%\"]"
            ),
            vec![trace(
                "SQLx",
                "PreparedStatement",
                "AMAN",
                "Input terikat sebagai literal $1; sort berasal dari enum statis",
                "good",
            )],
            false,
            keyword == "ESP32" || keyword == "Kabel'Pro",
        )
    };

    ProbeOutcome {
        request: RequestPreview {
            method: "GET".into(),
            path: format!("/api/products?keyword={keyword}&sort={sort}"),
            headers: vec![],
            body: String::new(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![("Content-Type".into(), "application/json".into())],
            body: json!({"items": rows, "count": rows.len()}).to_string(),
            correlation_id: cid.into(),
        },
        events,
        visual_data: json!({
            "kind": "sqli",
            "mode": "catalog_search",
            "keyword": keyword,
            "sort": sort,
            "query_preview": query_preview,
            "parameterized": where_parameterized,
            "sort_mapped": sort_mapped,
            "leaked_private": exploit,
            "ast_tokens": [
                "SELECT",
                "id, name",
                "FROM products",
                "WHERE",
                if where_parameterized { "$1 (BIND)".into() } else { format!("name LIKE '%{keyword}%'") },
                "ORDER BY",
                sort
            ],
            "rows": rows
        }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: status == 200 && !exploit,
        updated_state: state,
    }
}

pub(super) fn sim_a05_xss(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a05-xss", patch);
    let view = if input.target == "moderator" {
        "moderator"
    } else {
        "reader"
    };
    let comment = if input.payload.is_empty() {
        "Halo praktikum keamanan web!"
    } else {
        input.payload.as_str()
    };
    let lower = comment.to_ascii_lowercase();

    let has_script_tag = lower.contains("<script");
    let has_event_handler = lower.contains("onerror=")
        || lower.contains("onload=")
        || lower.contains("<svg")
        || lower.contains("<img");

    let reader_escaped = secure
        || matches!(level, LevelId::Hard | LevelId::Impossible)
        || patch == "escape-reader-only";
    let mod_escaped = secure || level == LevelId::Impossible;
    let strip_script = level == LevelId::Medium || patch == "strip-script-tag";

    let stored_text = if strip_script && !secure {
        comment
            .replace("<script>", "")
            .replace("</script>", "")
            .replace("<SCRIPT>", "")
    } else {
        comment.to_string()
    };

    let active_sink_escaped = if view == "moderator" {
        mod_escaped
    } else {
        reader_escaped
    };
    let dom_triggered =
        !active_sink_escaped && (has_script_tag && !strip_script || has_event_handler);

    let events = if dom_triggered {
        vec![trace(
            "Renderer",
            if view == "moderator" {
                "ModeratorPreviewSink"
            } else {
                "ReaderHtmlSink"
            },
            "DOM ALERT TERPICU",
            "Indikator eksekusi script simulasi menyala (disimpan sebagai teks aman di portal)",
            "bad",
        )]
    } else {
        vec![trace(
            "Renderer",
            if view == "moderator" {
                "ModeratorTextNode"
            } else {
                "ReaderTextNode"
            },
            "AMAN (TEXT NODE)",
            "Komentar dirender sebagai teks entity-encoded; script inert",
            "good",
        )]
    };

    if let Some(arr) = state.get_mut("comments").and_then(|v| v.as_array_mut())
        && arr.len() < 8
    {
        arr.push(Value::String(stored_text.clone()));
    }

    ProbeOutcome {
        request: RequestPreview { method: "POST".into(), path: format!("/api/comments?view={view}"), headers: vec![("Content-Type".into(), "application/json".into())], body: json!({"body": comment}).to_string() },
        response: ResponsePreview { status: 200, status_text: "OK", headers: vec![("Content-Security-Policy".into(), if secure || level == LevelId::Impossible { "default-src 'self'" } else { "none" }.into())], body: json!({"view": view, "rendered_as_text": stored_text, "dom_alert_triggered": dom_triggered}).to_string(), correlation_id: cid.into() },
        events,
        visual_data: json!({ "kind": "xss", "view": view, "stored_text": stored_text, "comments": state["comments"], "dom_alert_triggered": dom_triggered, "escaped": active_sink_escaped }),
        baseline_captured: !has_script_tag && !has_event_handler,
        exploit_proved: dom_triggered,
        is_legitimate: !dom_triggered,
        updated_state: state.clone(),
    }
}
