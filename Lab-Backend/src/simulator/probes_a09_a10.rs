use super::*;
use crate::simulator_catalog::LevelId;
use serde_json::{Value, json};

pub(super) fn sim_a09_logging(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a09-logging", patch);
    let dataset = if input.action.is_empty() {
        "normal"
    } else {
        input.action.as_str()
    };
    let structured = secure
        || matches!(level, LevelId::Medium | LevelId::Hard | LevelId::Impossible)
        || patch == "burst-only-no-spray";
    let logs_failures = secure || level != LevelId::Easy || patch != "vulnerable";
    let detects_burst = secure
        || matches!(level, LevelId::Hard | LevelId::Impossible)
        || patch == "burst-only-no-spray";
    let detects_spray_and_sink = secure || level == LevelId::Impossible;

    let (log_entry, alert_msg, sink_error, exploit, baseline) = match dataset {
        "burst" => {
            let alert = if detects_burst {
                Some("ALERT-BURST: 6 gagal pada 1 akun dalam 2 menit")
            } else {
                None
            };
            (
                json!({"event": "auth_login_failed", "count": 6, "actor": "u_8f2a", "secret": "[REDACTED]"}),
                alert,
                false,
                alert.is_none(),
                false,
            )
        }
        "spray" => {
            let alert = if detects_spray_and_sink {
                Some("ALERT-SPRAY: 6 akun berbeda gagal dari sumber yang sama")
            } else {
                None
            };
            (
                json!({"event": "auth_spray_attempt", "distinct_accounts": 6, "secret": "[REDACTED]"}),
                alert,
                false,
                alert.is_none(),
                false,
            )
        }
        "log_injection" => {
            if structured && detects_spray_and_sink {
                (
                    json!({"event": "auth_login_failed", "username_escaped": "andi\\nINFO login_success admin", "injected_line": false}),
                    None,
                    false,
                    false,
                    false,
                )
            } else {
                (
                    json!({"raw_text": "WARN login failed user=andi\nINFO login_success admin (BARIS LOG PALSU TERSUNTIK!)"}),
                    None,
                    false,
                    true,
                    false,
                )
            }
        }
        "sink_failure" => {
            let monitored = detects_spray_and_sink;
            (
                json!({"event": "alert_sink_status", "sink_reachable": false, "monitored": monitored}),
                if monitored {
                    Some("OPS-WARN: Alert sink tidak terjangkau (antrean fallback aktif)")
                } else {
                    None
                },
                true,
                !monitored,
                false,
            )
        }
        _ => {
            let entry = if logs_failures {
                json!({"event": "auth_login_success_and_typo", "false_alerts": 0, "password_logged": false})
            } else {
                json!({"event": "only_success_logged", "failed_login_dropped": true})
            };
            (entry, None, false, !logs_failures, logs_failures)
        }
    };

    if let Some(arr) = state.get_mut("logs").and_then(|v| v.as_array_mut())
        && arr.len() < 12
    {
        arr.push(log_entry.clone());
    }
    if let Some(a) = alert_msg
        && let Some(arr) = state.get_mut("alerts").and_then(|v| v.as_array_mut())
    {
        arr.push(Value::String(a.into()));
    }

    let events = vec![trace(
        "Observability",
        "Log&AlertEngine",
        if exploit {
            "CELAH DETEKSI"
        } else {
            "TERPANTAU"
        },
        alert_msg.unwrap_or(if exploit {
            "Event/serangan tidak terdeteksi atau log tidak aman"
        } else {
            "Tercatat terstruktur tanpa membocorkan rahasia"
        }),
        if exploit { "bad" } else { "good" },
    )];

    ProbeOutcome {
        request: RequestPreview {
            method: "POST".into(),
            path: format!("/api/sim/logs/replay/{dataset}"),
            headers: vec![],
            body: json!({"dataset": dataset}).to_string(),
        },
        response: ResponsePreview {
            status: if sink_error && !detects_spray_and_sink {
                500
            } else {
                200
            },
            status_text: if sink_error && !detects_spray_and_sink {
                "Internal Server Error"
            } else {
                "OK"
            },
            headers: vec![],
            body: json!({"log": log_entry, "alert": alert_msg, "sink_error": sink_error})
                .to_string(),
            correlation_id: cid.into(),
        },
        events,
        visual_data: json!({ "kind": "logging", "dataset": dataset, "logs": state["logs"], "alerts": state["alerts"] }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_a10_checkout(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("a10-checkout", patch);
    let fault = if input.action.is_empty() {
        "normal"
    } else {
        input.action.as_str()
    };
    let idem_key = if input.target.is_empty() {
        "idem-1001"
    } else {
        input.target.as_str()
    };

    let mut stock = state["stock"].as_i64().unwrap_or(10);
    let mut orders = state["orders"].as_array().cloned().unwrap_or_default();
    let mut idem_map = state["idempotency"]
        .as_object()
        .cloned()
        .unwrap_or_default();

    let has_tx = secure
        || matches!(level, LevelId::Medium | LevelId::Hard | LevelId::Impossible)
        || patch == "tx-swallow-no-idempotency";
    let propagates_err = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
    let has_idem = secure || level == LevelId::Impossible;

    let (status, msg, steps, exploit, baseline) = match fault {
        "fail_after_reserve" => {
            if has_tx && propagates_err {
                (
                    500,
                    "Gagal membuat order; transaksi di-ROLLBACK otomatis sehingga stok tetap utuh.",
                    vec![
                        trace("Tx", "BEGIN", "OK", "Mulai transaksi", "info"),
                        trace("Tx", "Reserve", "stock - 1", "Sementara", "info"),
                        trace(
                            "Tx",
                            "Fault",
                            "ROLLBACK",
                            "Stok dikembalikan ke kondisi awal!",
                            "good",
                        ),
                    ],
                    false,
                    false,
                )
            } else {
                stock = (stock - 1).max(0);
                let fake_status = if has_tx { 200 } else { 500 };
                (
                    fake_status,
                    "INKONSISTENSI: Stok berkurang 1 tetapi 0 order tercipta!",
                    vec![trace(
                        "Tx",
                        "Reserve",
                        "COMMITTED",
                        "Stok berkurang permanen tanpa order!",
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        "timeout_retry" => {
            if has_idem {
                if !idem_map.contains_key(idem_key) {
                    let oid = format!("ORD-{}", orders.len() + 1);
                    stock = (stock - 1).max(0);
                    orders.push(json!({"id": oid, "idem_key": idem_key}));
                    idem_map.insert(idem_key.into(), json!(oid));
                }
                (
                    200,
                    "Retry dengan Idempotency-Key yang sama mengembalikan order awal tanpa mengurangi stok ulang.",
                    vec![trace(
                        "Idempotency",
                        "Lookup",
                        "HIT",
                        &format!("Idempotency guard menjaga 1 order untuk key {idem_key}"),
                        "good",
                    )],
                    false,
                    true,
                )
            } else {
                stock = (stock - 2).max(0);
                let oid1 = format!("ORD-{}", orders.len() + 1);
                let oid2 = format!("ORD-{}", orders.len() + 2);
                orders.push(json!({"id": oid1, "idem_key": idem_key}));
                orders.push(json!({"id": oid2, "idem_key": idem_key}));
                (
                    200,
                    "DUPLIKASI: Retry tanpa idempotency key membuat order ganda dan mengurangi stok 2x!",
                    vec![trace(
                        "Tx",
                        "COMMIT x2",
                        "DOUBLE EFFECT",
                        &format!("Total order: {}, stok: {}", orders.len(), stock),
                        "bad",
                    )],
                    true,
                    false,
                )
            }
        }
        _ => {
            if has_idem && idem_map.contains_key(idem_key) {
                (
                    200,
                    "Order idempoten sudah ada.",
                    vec![trace(
                        "Tx",
                        "Idempotent",
                        "OK",
                        "Tidak ada duplikasi",
                        "good",
                    )],
                    false,
                    true,
                )
            } else {
                stock = (stock - 1).max(0);
                let oid = format!("ORD-{}", orders.len() + 1);
                orders.push(json!({"id": oid, "idem_key": idem_key}));
                idem_map.insert(idem_key.into(), json!(oid));
                (
                    200,
                    "Checkout normal sukses: stok berkurang 1 dan tepat 1 order tercatat.",
                    vec![trace(
                        "Tx",
                        "BEGIN -> Reserve -> Create -> COMMIT",
                        "200 OK",
                        &format!("Stok: {stock}, Orders: {}", orders.len()),
                        "good",
                    )],
                    false,
                    true,
                )
            }
        }
    };

    state["stock"] = json!(stock);
    state["orders"] = Value::Array(orders.clone());
    state["idempotency"] = Value::Object(idem_map);

    ProbeOutcome {
        request: RequestPreview {
            method: "POST".into(),
            path: "/api/checkout".into(),
            headers: vec![("Idempotency-Key".into(), idem_key.into())],
            body: json!({"fault": fault}).to_string(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![],
            body: json!({"message": msg, "stock": stock, "order_count": orders.len()}).to_string(),
            correlation_id: cid.into(),
        },
        events: steps,
        visual_data: json!({ "kind": "checkout", "stock": stock, "order_count": orders.len(), "fault": fault }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: status == 200 && !exploit,
        updated_state: state.clone(),
    }
}
