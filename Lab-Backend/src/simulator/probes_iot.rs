use super::*;
use crate::simulator_catalog::LevelId;
use serde_json::{Value, json};

pub(super) fn sim_iot_esp32_gpio(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-esp32-gpio", patch);
    let action = if input.action.is_empty() {
        "blink_resistor"
    } else {
        input.action.as_str()
    };
    let protected = secure || level == LevelId::Impossible;
    let (status, allowed, exploit, baseline, detail) = match action {
        "direct_no_resistor" | "short_circuit" => {
            if protected {
                (
                    422,
                    false,
                    false,
                    false,
                    "Proteksi GPIO 3.3V menahan over-current / short-circuit tanpa merusak pin.",
                )
            } else {
                (
                    200,
                    true,
                    true,
                    false,
                    "BAHAYA: Pin GPIO mengalirkan arus tanpa resistor pembatas 220Ω!",
                )
            }
        }
        _ => (
            200,
            true,
            false,
            true,
            "LED menyala stabil melalui resistor seri 220Ω pada logika 3.3V ESP32-C3.",
        ),
    };
    state["gpio2"] = json!(if allowed { "HIGH" } else { "SAFE_LOW" });

    ProbeOutcome {
        request: RequestPreview {
            method: "SIM".into(),
            path: format!("/esp32-c3/gpio/{action}"),
            headers: vec![("X-Board".into(), "ESP32-C3-RISCV".into())],
            body: json!({ "action": action, "logic_v": 3.3 }).to_string(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![],
            body: json!({ "gpio2": state["gpio2"], "safe": !exploit, "detail": detail })
                .to_string(),
            correlation_id: cid.into(),
        },
        events: vec![trace(
            "ESP32 GPIO",
            "HardwareChecker",
            if exploit {
                "OVER_CURRENT"
            } else if allowed {
                "SAFE_HIGH"
            } else {
                "BLOCKED"
            },
            detail,
            if exploit { "bad" } else { "good" },
        )],
        visual_data: json!({ "kind": "esp32_gpio", "gpio2": state["gpio2"] }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: baseline && !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_iot_esp32_ultrasonic(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-esp32-ultrasonic", patch);
    let action = if input.action.is_empty() {
        "valid_distance"
    } else {
        input.action.as_str()
    };
    let protected = secure || level == LevelId::Impossible;
    let (status, servo_deg, exploit, baseline, detail) = match action {
        "timeout_zero" | "noise_999" => {
            if protected {
                (
                    422,
                    0,
                    false,
                    false,
                    "Nilai sensor di luar rentang 2..400 cm diabaikan; servo dan buzzer tetap aman.",
                )
            } else {
                (
                    200,
                    90,
                    true,
                    false,
                    "BAHAYA: Pembacaan 0/timeout langsung membuka servo dan menyalakan buzzer!",
                )
            }
        }
        "close_valid" => (
            200,
            90,
            false,
            true,
            "Objek terdeteksi pada 14 cm (<25 cm): buzzer berbunyi & servo 90°.",
        ),
        _ => (
            200,
            0,
            false,
            true,
            "Jarak aman 120 cm: buzzer nonaktif dan servo di posisi 0°.",
        ),
    };
    state["servo_deg"] = json!(servo_deg);

    ProbeOutcome {
        request: RequestPreview {
            method: "SIM".into(),
            path: format!("/esp32-c3/hc-sr04/{action}"),
            headers: vec![("X-Board".into(), "ESP32-C3-RISCV".into())],
            body: json!({ "action": action }).to_string(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![],
            body: json!({ "servo_deg": servo_deg, "safe": !exploit, "detail": detail }).to_string(),
            correlation_id: cid.into(),
        },
        events: vec![trace(
            "Ultrasonic + PWM",
            "FirmwareLoop",
            if exploit {
                "FALSE_TRIGGER"
            } else if status == 200 {
                "ACTUATED"
            } else {
                "FILTERED"
            },
            detail,
            if exploit { "bad" } else { "good" },
        )],
        visual_data: json!({ "kind": "esp32_ultrasonic", "servo_deg": servo_deg }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: baseline && !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_iot_esp32_dht_oled(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-esp32-dht-oled", patch);
    let action = if input.action.is_empty() {
        "valid_dht"
    } else {
        input.action.as_str()
    };
    let protected = secure || level == LevelId::Impossible;
    let (status, exploit, baseline, detail) = match action {
        "nan_reading" | "no_clear" => {
            if protected {
                (
                    422,
                    false,
                    false,
                    "Data NaN/ekstrem ditahan dan buffer OLED SSD1306 dibersihkan bersih.",
                )
            } else {
                (
                    200,
                    true,
                    false,
                    "Layar OLED SSD1306 menampilkan teks bertumpuk / nilai NaN!",
                )
            }
        }
        _ => (
            200,
            false,
            true,
            "Suhu 28.5°C & kelembapan 64% tampil rapi pada OLED SSD1306 dan Serial Plotter.",
        ),
    };
    state["oled_clean"] = json!(!exploit);

    ProbeOutcome {
        request: RequestPreview {
            method: "I2C".into(),
            path: format!("/esp32-c3/dht-oled/{action}"),
            headers: vec![("X-I2C-Addr".into(), "0x3C".into())],
            body: json!({ "action": action }).to_string(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![],
            body: json!({ "oled_clean": !exploit, "detail": detail }).to_string(),
            correlation_id: cid.into(),
        },
        events: vec![trace(
            "I2C Display",
            "SSD1306",
            if exploit {
                "CORRUPT_FRAME"
            } else if status == 200 {
                "RENDER_OK"
            } else {
                "GUARDED"
            },
            detail,
            if exploit { "bad" } else { "good" },
        )],
        visual_data: json!({ "kind": "esp32_dht_oled", "oled_clean": !exploit }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: baseline && !exploit,
        updated_state: state.clone(),
    }
}

pub(super) fn sim_iot_esp32_mqtt(
    level: LevelId,
    patch: &str,
    cid: &str,
    state: &mut Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let secure = is_target_patch("iot-esp32-mqtt", patch);
    let target = if input.target.is_empty() {
        "mqtts://broker.weblab.local:8883"
    } else {
        input.target.as_str()
    };
    let protected = secure || level == LevelId::Impossible;
    let is_plaintext = target.starts_with("mqtt://");
    let (status, exploit, baseline, detail) = if is_plaintext {
        if protected {
            (
                403,
                false,
                false,
                "Koneksi plaintext mqtt://1883 ditolak; sistem wajib memakai mqtts://8883 (TLS).",
            )
        } else {
            (
                200,
                true,
                false,
                "Telemetri MQTT dikirim plaintext melalui port 1883 tanpa enkripsi TLS!",
            )
        }
    } else {
        (
            200,
            false,
            true,
            "Telemetri ESP32-C3 terkirim aman terenkripsi melalui mqtts://8883.",
        )
    };
    state["tls_active"] = json!(!is_plaintext && !exploit);

    ProbeOutcome {
        request: RequestPreview {
            method: "MQTT".into(),
            path: target.into(),
            headers: vec![("X-Board".into(), "ESP32-C3-WiFi".into())],
            body: "{\"adc\":2048}".into(),
        },
        response: ResponsePreview {
            status,
            status_text: status_text(status),
            headers: vec![],
            body: json!({ "broker": target, "tls_active": state["tls_active"], "detail": detail })
                .to_string(),
            correlation_id: cid.into(),
        },
        events: vec![trace(
            "Wi-Fi MQTT",
            "TlsTransport",
            if exploit {
                "PLAINTEXT_LEAK"
            } else if status == 200 {
                "TLS_SENT"
            } else {
                "BLOCKED_INSECURE"
            },
            detail,
            if exploit { "bad" } else { "good" },
        )],
        visual_data: json!({ "kind": "esp32_mqtt", "tls_active": state["tls_active"] }),
        baseline_captured: baseline,
        exploit_proved: exploit,
        is_legitimate: baseline && !exploit,
        updated_state: state.clone(),
    }
}
