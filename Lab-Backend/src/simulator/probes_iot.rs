use super::*;
use crate::simulator_catalog::LevelId;
use serde_json::{Value, json};

pub(super) fn sim_iot_mqtt_acl(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-mqtt-acl", patch);
    let client = if input.actor.is_empty() {
        "sensor-tanah-01"
    } else {
        input.actor.as_str()
    };
    let topic = if input.target.is_empty() {
        "kebun/A/sensor/kelembapan"
    } else {
        input.target.as_str()
    };
    let op = if input.action == "subscribe" {
        "SUB"
    } else {
        "PUB"
    };

    let allowed = if secure || level == LevelId::Impossible {
        matches!(
            (client, op, topic),
            ("sensor-tanah-01", "PUB", "kebun/A/sensor/kelembapan")
                | ("controller-kebun-a", "SUB", "kebun/A/sensor/kelembapan")
                | ("controller-kebun-a", "PUB", "kebun/A/aktuator/pompa")
        )
    } else {
        match level {
            LevelId::Easy => true,
            LevelId::Medium => topic.starts_with("kebun/A/"),
            LevelId::Hard => {
                !(op == "PUB"
                    && topic == "kebun/A/aktuator/pompa"
                    && client != "controller-kebun-a")
            }
            LevelId::Impossible => unreachable!(),
        }
    };

    let is_legit = matches!(
        (client, op, topic),
        ("sensor-tanah-01", "PUB", "kebun/A/sensor/kelembapan")
            | ("controller-kebun-a", "PUB", "kebun/A/aktuator/pompa")
            | ("controller-kebun-a", "SUB", "kebun/A/sensor/kelembapan")
    );
    let exploit = allowed && !is_legit;
    if allowed && topic == "kebun/A/aktuator/pompa" {
        state["pump"] = json!("ON");
    }

    let entry = format!(
        "{op} {client} -> {topic} : {}",
        if allowed { "ALLOW" } else { "DENY" }
    );
    if let Some(arr) = state.get_mut("broker_log").and_then(|v| v.as_array_mut())
        && arr.len() < 10
    {
        arr.push(Value::String(entry.clone()));
    }

    ProbeOutcome {
        request: RequestPreview { method: op.into(), path: topic.into(), headers: vec![("MQTT-ClientId".into(), client.into())], body: if op == "PUB" { "{\"cmd\":\"PUMP_ON\"}".into() } else { String::new() } },
        response: ResponsePreview { status: if allowed { 200 } else { 403 }, status_text: if allowed { "ALLOW" } else { "Forbidden" }, headers: vec![], body: json!({"client": client, "op": op, "topic": topic, "acl_decision": if allowed { "ALLOW" } else { "DENY" }, "pump_state": state["pump"]}).to_string(), correlation_id: cid.into() },
        events: vec![trace("MQTT Broker", "AclEngine", if allowed { if exploit { "BYPASS ALLOW" } else { "ALLOW" } } else { "DENY 403" }, &entry, if exploit { "bad" } else { "good" })],
        visual_data: json!({ "kind": "iot_mqtt", "client": client, "topic": topic, "allowed": allowed, "pump": state["pump"], "broker_log": state["broker_log"] }),
        baseline_captured: is_legit && allowed,
        exploit_proved: exploit,
        is_legitimate: is_legit && allowed,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_iot_replay(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-replay", patch);
    let action = if input.action.is_empty() {
        "fresh_signed"
    } else {
        input.action.as_str()
    };
    let mut clock = state["clock_sec"].as_i64().unwrap_or(1000);
    if input.advance_minutes > 0 {
        clock += input.advance_minutes * 60;
        state["clock_sec"] = json!(clock);
    }
    let mut seen: Vec<String> = state["seen_nonces"]
        .as_array()
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let has_hmac = secure || level != LevelId::Easy;
    let checks_nonce = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
    let checks_ts = secure || level == LevelId::Impossible;

    let (accepted, reason, exploit, baseline) = match action {
        "replay_recorded" => {
            if checks_nonce && seen.iter().any(|n| n == "n-1001") {
                (
                    false,
                    "Ditolak: Nonce n-1001 sudah pernah dipakai (anti-replay).",
                    false,
                    false,
                )
            } else {
                (
                    true,
                    "REPLAY DITERIMA: Paket lama kembali menyalakan pompa!",
                    true,
                    false,
                )
            }
        }
        "expired_ts" => {
            if checks_ts {
                (
                    false,
                    "Ditolak: Timestamp paket sudah melewati jendela toleransi 60 detik.",
                    false,
                    false,
                )
            } else {
                (
                    true,
                    "Paket timestamp +10 menit lalu masih diterima aktuator!",
                    true,
                    false,
                )
            }
        }
        "forged_cmd" => {
            if has_hmac {
                (
                    false,
                    "Ditolak: HMAC tidak valid untuk payload yang dimodifikasi.",
                    false,
                    false,
                )
            } else {
                (
                    true,
                    "Perintah palsu tanpa HMAC menyalakan pompa!",
                    true,
                    false,
                )
            }
        }
        _ => {
            if !seen.iter().any(|n| n == "n-fresh-2002") {
                seen.push("n-fresh-2002".into());
            }
            state["pump"] = json!("ON");
            (
                true,
                "Perintah segar bertanda tangan sah (nonce n-fresh-2002) diterima (pump ON).",
                false,
                true,
            )
        }
    };
    state["seen_nonces"] = json!(seen);

    ProbeOutcome {
        request: RequestPreview {
            method: "PUB".into(),
            path: "kebun/A/aktuator/pompa".into(),
            headers: vec![("Scenario".into(), action.into())],
            body: json!({"cmd": "PUMP_ON", "nonce": "n-1001", "clock_sec": clock}).to_string(),
        },
        response: ResponsePreview {
            status: if accepted { 200 } else { 403 },
            status_text: if accepted { "OK" } else { "Forbidden" },
            headers: vec![],
            body: json!({"accepted": accepted, "reason": reason, "pump": state["pump"]})
                .to_string(),
            correlation_id: cid.into(),
        },
        events: vec![trace(
            "ESP32",
            "CommandGuard",
            if exploit {
                "REPLAY/FORGE LOLOS"
            } else if accepted {
                "ACCEPT"
            } else {
                "REJECT"
            },
            reason,
            if exploit { "bad" } else { "good" },
        )],
        visual_data: json!({ "kind": "iot_replay", "pump": state["pump"], "clock_sec": clock, "seen_nonces": seen }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: accepted && !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_iot_ota(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-ota", patch);
    let pkg = if input.target.is_empty() {
        "official-v2.2.0"
    } else {
        input.target.as_str()
    };
    let checks_sig = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
    let checks_rollback = secure || level == LevelId::Impossible;

    let (accepted, new_ver, reason, exploit, baseline) = match pkg {
        "tampered-bin" => {
            if checks_sig {
                (
                    false,
                    state["active_version"]
                        .as_str()
                        .unwrap_or("v2.1.0")
                        .to_string(),
                    "Ditolak: Tanda tangan digital ECDSA/Ed25519 tidak valid; tetap di v2.1.0.",
                    false,
                    false,
                )
            } else {
                (
                    true,
                    "v9.9.9-rogue".into(),
                    "BAHAYA: Firmware palsu tanpa signature terpasang di ESP32!",
                    true,
                    false,
                )
            }
        }
        "downgrade-v1.0.0" => {
            if checks_rollback {
                (
                    false,
                    state["active_version"]
                        .as_str()
                        .unwrap_or("v2.1.0")
                        .to_string(),
                    "Ditolak: Versi v1.0.0 lebih rendah dari anti-rollback minimum (v2.1.0).",
                    false,
                    false,
                )
            } else {
                (
                    true,
                    "v1.0.0-vulnerable".into(),
                    "DOWNGRADE: Firmware lama rentan terpasang menimpa v2.1.0!",
                    true,
                    false,
                )
            }
        }
        _ => (
            true,
            "v2.2.0".into(),
            "Firmware resmi v2.2.0 terverifikasi signature & versi naik.",
            false,
            true,
        ),
    };
    state["active_version"] = json!(new_ver);

    ProbeOutcome {
        request: RequestPreview { method: "POST".into(), path: "/ota/flash".into(), headers: vec![], body: json!({"package": pkg}).to_string() },
        response: ResponsePreview { status: if accepted { 200 } else { 422 }, status_text: if accepted { "OK" } else { "Unprocessable Entity" }, headers: vec![], body: json!({"accepted": accepted, "active_version": new_ver, "operational": true, "reason": reason}).to_string(), correlation_id: cid.into() },
        events: vec![trace("Bootloader", "OtaVerifier", if exploit { "FLASH RENTAN" } else if accepted { "FLASH SAH" } else { "SAFE REJECT" }, reason, if exploit { "bad" } else { "good" })],
        visual_data: json!({ "kind": "iot_ota", "active_version": new_ver, "operational": true, "package": pkg }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_iot_interlock(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-interlock", patch);
    let mode = if input.action.is_empty() {
        "dry_valid"
    } else {
        input.action.as_str()
    };

    let checks_range =
        secure || matches!(level, LevelId::Medium | LevelId::Hard | LevelId::Impossible);
    let checks_online = secure || matches!(level, LevelId::Hard | LevelId::Impossible);
    let recovers = secure || level == LevelId::Impossible;
    let was_fault = state["fault_latched"].as_bool().unwrap_or(false);

    let (pump, reason, exploit, baseline) = match mode {
        "out_of_range" => {
            if checks_range {
                state["fault_latched"] = json!(true);
                (
                    "SAFE_OFF",
                    "Nilai sensor -50% di luar rentang 0..100%; pompa masuk SAFE_OFF.",
                    false,
                    false,
                )
            } else {
                (
                    "ON",
                    "BAHAYA: Nilai -50% dianggap kering (<30%), pompa menyala terus!",
                    true,
                    false,
                )
            }
        }
        "sensor_offline" => {
            if checks_online {
                state["fault_latched"] = json!(true);
                (
                    "SAFE_OFF",
                    "Heartbeat sensor terputus (offline); pompa otomatis SAFE_OFF.",
                    false,
                    false,
                )
            } else {
                (
                    "ON",
                    "BAHAYA: Memakai data basi terakhir (18%) saat sensor offline, pompa terus menyala!",
                    true,
                    false,
                )
            }
        }
        "wet_valid" => (
            "OFF",
            "Kelembapan 68% (cukup basah); pompa tetap OFF.",
            false,
            true,
        ),
        "fault_then_recover" => {
            if recovers {
                state["fault_latched"] = json!(false);
                (
                    "ON",
                    "Setelah sensor pulih ke 24%, fault latch terlepas dan pompa menyala aman.",
                    false,
                    true,
                )
            } else {
                state["fault_latched"] = json!(true);
                (
                    "OFF",
                    "GAGAL PULIH: Sistem terkunci fault permanen meski sensor sudah kembali normal 24%!",
                    true,
                    false,
                )
            }
        }
        _ => {
            if was_fault && !recovers {
                (
                    "OFF",
                    "GAGAL PULIH: Sistem terkunci fault permanen meski sensor sudah normal 24%!",
                    true,
                    false,
                )
            } else {
                state["fault_latched"] = json!(false);
                (
                    "ON",
                    "Sensor online valid (22%); pompa menyala aman sesuai target irigasi.",
                    false,
                    true,
                )
            }
        }
    };
    state["pump"] = json!(pump);

    ProbeOutcome {
        request: RequestPreview {
            method: "TELEMETRY".into(),
            path: "kebun/A/sensor/kelembapan".into(),
            headers: vec![],
            body: json!({"mode": mode}).to_string(),
        },
        response: ResponsePreview {
            status: 200,
            status_text: "OK",
            headers: vec![],
            body: json!({"pump_state": pump, "reason": reason}).to_string(),
            correlation_id: cid.into(),
        },
        events: vec![trace(
            "Interlock",
            "SafetyGuard",
            pump,
            reason,
            if exploit { "bad" } else { "good" },
        )],
        visual_data: json!({ "kind": "iot_interlock", "pump": pump, "mode": mode, "fault_latched": state["fault_latched"] }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: !exploit,
        updated_state: state.clone(),
    }
}
