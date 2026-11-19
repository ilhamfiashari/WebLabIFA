use super::load_user_access_rights;
use crate::{ApiError, AppState, identity, simulator_catalog::find_lab, verify_mutation};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use std::collections::HashSet;
use uuid::Uuid;

#[derive(FromRow)]
struct ProjectRow {
    id: Uuid,
    title: String,
    board: String,
    mission_id: Option<String>,
    code: String,
    components_json: Value,
    wires_json: Value,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct CompletedMissionRow {
    mission_id: String,
    score: i32,
    completed_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct SaveProjectReq {
    pub id: Option<Uuid>,
    pub title: String,
    pub board: String,
    pub mission_id: Option<String>,
    pub code: String,
    pub components: Vec<Value>,
    pub wires: Vec<Value>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SubmitMissionReq {
    pub mission_id: String,
    pub board: String,
    pub code: String,
    #[serde(default)]
    pub components: Vec<Value>,
    #[serde(default)]
    pub wires: Vec<Value>,
    pub component_count: usize,
    pub wire_count: usize,
    pub checks_passed: usize,
    pub checks_total: usize,
    pub has_hardware_alerts: bool,
    #[serde(default)]
    pub loop_iterations: usize,
    #[serde(default)]
    pub has_serial_output: bool,
    #[serde(default)]
    pub has_oled_output: bool,
    #[serde(default)]
    pub mqtt_tls_verified: bool,
}

#[derive(Clone, Copy)]
struct IotMissionRule {
    id: &'static str,
    title: &'static str,
    xp: i32,
    /// Setiap sub-slice adalah pilihan grup komponen (OR dalam sub-slice, AND antar sub-slice)
    required_components: &'static [&'static [&'static str]],
    min_wires: usize,
    required_code_tokens: &'static [&'static str],
    forbidden_code_tokens: &'static [&'static str],
    requires_tls_telemetry: bool,
}

const IOT_MISSION_RULES: &[IotMissionRule] = &[
    IotMissionRule {
        id: "iot-esp32-gpio",
        title: "Misi 1 · Kontrol GPIO, LED & Proteksi Resistor",
        xp: 50,
        required_components: &[&["led"], &["resistor"]],
        min_wires: 2,
        required_code_tokens: &["pinMode", "digitalWrite"],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-ultrasonic",
        title: "Misi 2 · Sensor Jarak HC-SR04 + Alarm & Servo",
        xp: 50,
        required_components: &[&["hc-sr04"], &["servo", "buzzer"]],
        min_wires: 4,
        required_code_tokens: &["ultrasonicRead"],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-dht-oled",
        title: "Misi 3 · Monitoring DHT22 + Layar OLED SSD1306",
        xp: 50,
        required_components: &[&["dht22"], &["oled-ssd1306"]],
        min_wires: 4,
        required_code_tokens: &["oled."],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-mqtt",
        title: "Misi 4 · ESP32 Wi-Fi Telemetri & Keamanan MQTT TLS",
        xp: 50,
        required_components: &[&["ldr", "dht22", "potentiometer", "mq2"]],
        min_wires: 3,
        required_code_tokens: &["mqtts://", "mqtt.publish"],
        forbidden_code_tokens: &["\"mqtt://"],
        requires_tls_telemetry: true,
    },
    IotMissionRule {
        id: "iot-esp32-button-pullup",
        title: "Misi 5 · Input Pushbutton Pull-Up & Kendali LED",
        xp: 50,
        required_components: &[&["pushbutton"], &["led"]],
        min_wires: 4,
        required_code_tokens: &["INPUT_PULLUP", "digitalRead"],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-adc-servo",
        title: "Misi 6 · Kalibrasi ADC Potensiometer & Sudut Servo PWM",
        xp: 50,
        required_components: &[&["potentiometer"], &["servo"]],
        min_wires: 4,
        required_code_tokens: &["analogRead", "map("],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-pir-alarm",
        title: "Misi 7 · Deteksi Gerak PIR + Buzzer & Relay Kunci",
        xp: 60,
        required_components: &[&["pir"], &["buzzer", "relay"]],
        min_wires: 5,
        required_code_tokens: &["digitalRead", "tone("],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-lcd-access",
        title: "Misi 8 · Panel Akses LCD 16x2 I2C & Indikator Status",
        xp: 60,
        required_components: &[&["lcd-1602"], &["pushbutton", "led", "buzzer"]],
        min_wires: 4,
        required_code_tokens: &["lcd."],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-gas-safety",
        title: "Misi 9 · Sensor Gas MQ-2, Relay Ventilasi & Buzzer Darurat",
        xp: 70,
        required_components: &[&["mq2"], &["relay"], &["buzzer"]],
        min_wires: 6,
        required_code_tokens: &["analogRead", "digitalWrite"],
        forbidden_code_tokens: &[],
        requires_tls_telemetry: false,
    },
    IotMissionRule {
        id: "iot-esp32-secure-telemetry",
        title: "Misi 10 · Guard Sensor Suhu, Alarm & Telemetri TLS Tervalidasi",
        xp: 80,
        required_components: &[&["dht22"], &["buzzer"]],
        min_wires: 4,
        required_code_tokens: &["mqtts://", "mqtt.publish", "tone("],
        forbidden_code_tokens: &["\"mqtt://"],
        requires_tls_telemetry: true,
    },
];

pub struct IotBadgeSpec {
    pub key: &'static str,
    pub id: &'static str,
    pub title: &'static str,
    pub detail: &'static str,
    pub xp: i32,
}

pub const IOT_BADGE_SPECS: &[IotBadgeSpec] = &[
    IotBadgeSpec {
        key: "badge:iot-perintis",
        id: "iot-perintis",
        title: "Perintis IoT Studio",
        detail: "Menyelesaikan misi simulasi perangkat keras IoT pertama.",
        xp: 25,
    },
    IotBadgeSpec {
        key: "badge:iot-zero-alert",
        id: "iot-zero-alert",
        title: "Insinyur Sirkuit Aman",
        detail: "Lolos verifikasi misi IoT dengan 0 peringatan korsleting/tegangan.",
        xp: 30,
    },
    IotBadgeSpec {
        key: "badge:iot-telemetri-tls",
        id: "iot-telemetri-tls",
        title: "Penjaga Telemetri TLS",
        detail: "Menuntaskan misi komunikasi IoT terenkripsi mqtts:// TLS.",
        xp: 40,
    },
    IotBadgeSpec {
        key: "badge:iot-arsitek",
        id: "iot-arsitek",
        title: "Arsitek 5 Misi IoT",
        detail: "Menyelesaikan minimal 5 misi berbeda pada IoT Simulator Studio.",
        xp: 60,
    },
    IotBadgeSpec {
        key: "badge:iot-master",
        id: "iot-master",
        title: "Master Praktikum IoT",
        detail: "Menyelesaikan seluruh 10 misi praktikum pada IoT Simulator Studio.",
        xp: 100,
    },
];

fn find_mission_rule(mission_id: &str) -> Option<&'static IotMissionRule> {
    IOT_MISSION_RULES.iter().find(|r| r.id == mission_id)
}

fn valid_board(board: &str) -> bool {
    matches!(
        board,
        "esp32-c3" | "esp32" | "arduino-uno" | "arduino-mega" | "pico-w"
    )
}

fn count_valid_wires(wires: &[Value]) -> usize {
    wires
        .iter()
        .filter(|w| {
            let from_node = w
                .get("from")
                .and_then(|f| f.get("nodeId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let from_pin = w
                .get("from")
                .and_then(|f| f.get("pinId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let to_node = w
                .get("to")
                .and_then(|t| t.get("nodeId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let to_pin = w
                .get("to")
                .and_then(|t| t.get("pinId"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            !from_node.is_empty()
                && !from_pin.is_empty()
                && !to_node.is_empty()
                && !to_pin.is_empty()
                && !(from_node == to_node && from_pin == to_pin)
        })
        .count()
}

/// Verifikasi server-side agar Mahasiswa tidak dapat memanipulasi skor/kelulusan misi lewat payload klien.
fn verify_iot_mission_payload(
    rule: &IotMissionRule,
    req: &SubmitMissionReq,
) -> Result<(), &'static str> {
    if req.has_hardware_alerts {
        return Err("Terdapat peringatan hardware/korsleting pada sirkuit.");
    }
    if req.checks_total == 0 || req.checks_passed < req.checks_total {
        return Err("Belum semua kriteria simulasi terpenuhi.");
    }
    if req.loop_iterations == 0 {
        return Err("Simulasi belum dijalankan (loop_iterations == 0).");
    }
    if req.components.len() > 36 || req.wires.len() > 64 {
        return Err("Jumlah komponen atau kabel melebihi batas aman simulator.");
    }
    let code = req.code.trim();
    if code.is_empty() || !code.contains("setup") || !code.contains("loop") {
        return Err("Firmware harus berisi fungsi setup() dan loop() yang valid.");
    }

    let present_kinds: HashSet<&str> = req
        .components
        .iter()
        .filter_map(|c| c.get("kind").and_then(|v| v.as_str()))
        .collect();

    for any_of in rule.required_components {
        if !any_of
            .iter()
            .any(|req_kind| present_kinds.contains(req_kind))
        {
            return Err("Komponen perangkat keras wajib pada misi belum lengkap di kanvas.");
        }
    }

    if count_valid_wires(&req.wires) < rule.min_wires {
        return Err("Koneksi kabel antar pin belum mencukupi untuk misi ini.");
    }

    for token in rule.required_code_tokens {
        if !code.contains(token) {
            return Err("Implementasi firmware belum memenuhi fungsi wajib misi.");
        }
    }
    for forbidden in rule.forbidden_code_tokens {
        if code.contains(forbidden) {
            return Err("Firmware memakai protokol tidak aman (harus memakai mqtts:// TLS).");
        }
    }

    if rule.requires_tls_telemetry && !req.mqtt_tls_verified {
        return Err("Telemetri MQTT TLS belum terverifikasi selama simulasi berjalan.");
    }
    if rule.id == "iot-esp32-dht-oled" && !req.has_oled_output {
        return Err("Layar OLED SSD1306 belum menampilkan pembacaan sensor.");
    }

    Ok(())
}

pub async fn list_iot_projects(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;

    let rows: Vec<ProjectRow> = sqlx::query_as(
        "SELECT id, title, board, mission_id, code, components_json, wires_json, updated_at FROM iot_projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let missions: Vec<CompletedMissionRow> = sqlx::query_as(
        "SELECT mission_id, score, completed_at FROM iot_mission_completions WHERE user_id = $1 ORDER BY completed_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let mut seen: HashSet<String> = missions.iter().map(|m| m.mission_id.clone()).collect();
    let legacy_sessions: Vec<(String, Option<i32>, DateTime<Utc>)> = sqlx::query_as(
        "SELECT DISTINCT ON (lab_id) lab_id, score, updated_at FROM lab_sessions WHERE user_id = $1 AND lab_id LIKE 'iot-esp32-%' AND passed = true ORDER BY lab_id, updated_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let mut completed_missions: Vec<Value> = missions
        .into_iter()
        .map(|m| {
            json!({
                "mission_id": m.mission_id,
                "score": m.score,
                "completed_at": m.completed_at,
            })
        })
        .collect();

    for (lab_id, score, updated_at) in legacy_sessions {
        if seen.insert(lab_id.clone()) {
            completed_missions.push(json!({
                "mission_id": lab_id,
                "score": score.unwrap_or(100),
                "completed_at": updated_at,
            }));
        }
    }

    let ach_rows: Vec<(String,)> = sqlx::query_as(
        "SELECT achievement_key FROM lab_achievements WHERE user_id = $1 AND achievement_key LIKE 'badge:iot-%' ORDER BY earned_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;
    let earned_set: HashSet<String> = ach_rows.into_iter().map(|a| a.0).collect();

    let achievements: Vec<Value> = IOT_BADGE_SPECS
        .iter()
        .map(|b| {
            json!({
                "id": b.id,
                "key": b.key,
                "title": b.title,
                "detail": b.detail,
                "xp": b.xp,
                "earned": earned_set.contains(b.key),
            })
        })
        .collect();

    let total_iot_xp: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(xp), 0)::bigint FROM lab_achievements WHERE user_id = $1 AND (achievement_key LIKE 'iot-sim:%' OR achievement_key LIKE 'badge:iot-%')",
    )
    .bind(actor.id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let projects: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.id,
                "title": r.title,
                "board": r.board,
                "mission_id": r.mission_id,
                "code": r.code,
                "components": r.components_json,
                "wires": r.wires_json,
                "updated_at": r.updated_at,
            })
        })
        .collect();

    Ok(Json(json!({
        "projects": projects,
        "completed_missions": completed_missions,
        "achievements": achievements,
        "iot_xp": total_iot_xp,
    })))
}

pub async fn save_iot_project(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<SaveProjectReq>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let rights = load_user_access_rights(&state.pool, actor.id, &actor.allowed_roles).await;
    if actor.role == "mahasiswa" && !rights.can_access_iot_studio {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let title = req.title.trim();
    if title.is_empty() || title.len() > 80 {
        return Err(ApiError(StatusCode::BAD_REQUEST));
    }
    if !valid_board(&req.board) {
        return Err(ApiError(StatusCode::BAD_REQUEST));
    }
    if req.code.len() > 8192 || req.components.len() > 36 || req.wires.len() > 64 {
        return Err(ApiError(StatusCode::BAD_REQUEST));
    }

    let components_json = Value::Array(req.components);
    let wires_json = Value::Array(req.wires);

    let project_id = if let Some(existing_id) = req.id {
        let updated = sqlx::query(
            "UPDATE iot_projects SET title=$1, board=$2, mission_id=$3, code=$4, components_json=$5, wires_json=$6, updated_at=now() WHERE id=$7 AND user_id=$8",
        )
        .bind(title)
        .bind(&req.board)
        .bind(req.mission_id.as_deref())
        .bind(&req.code)
        .bind(&components_json)
        .bind(&wires_json)
        .bind(existing_id)
        .bind(actor.id)
        .execute(&state.pool)
        .await?;
        if updated.rows_affected() == 0 {
            return Err(ApiError(StatusCode::NOT_FOUND));
        }
        existing_id
    } else {
        let new_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO iot_projects(id, user_id, title, board, mission_id, code, components_json, wires_json) VALUES($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(new_id)
        .bind(actor.id)
        .bind(title)
        .bind(&req.board)
        .bind(req.mission_id.as_deref())
        .bind(&req.code)
        .bind(&components_json)
        .bind(&wires_json)
        .execute(&state.pool)
        .await?;
        new_id
    };

    Ok(Json(json!({
        "id": project_id,
        "title": title,
        "board": req.board,
        "saved": true,
    })))
}

pub async fn delete_iot_project(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let res = sqlx::query("DELETE FROM iot_projects WHERE id=$1 AND user_id=$2")
        .bind(project_id)
        .bind(actor.id)
        .execute(&state.pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(ApiError(StatusCode::NOT_FOUND));
    }
    Ok(Json(json!({ "deleted": true, "id": project_id })))
}

pub async fn submit_iot_mission(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<SubmitMissionReq>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if !valid_board(&req.board) || req.code.len() > 8192 {
        return Err(ApiError(StatusCode::BAD_REQUEST));
    }
    if actor.role == "mahasiswa" {
        let settings = crate::latihan::load_platform_settings(&state.pool).await;
        if let Some(list) = settings.active_tracks.as_array()
            && !list.iter().any(|v| v.as_str() == Some("iot"))
        {
            return Err(ApiError(StatusCode::FORBIDDEN));
        }
        let rights = load_user_access_rights(&state.pool, actor.id, &actor.allowed_roles).await;
        if !rights.can_access_iot_studio || !rights.can_submit_assignments {
            return Err(ApiError(StatusCode::FORBIDDEN));
        }
    }

    let Some(rule) = find_mission_rule(&req.mission_id) else {
        return Err(ApiError(StatusCode::NOT_FOUND));
    };

    if let Err(reason) = verify_iot_mission_payload(rule, &req) {
        if actor.role == "mahasiswa"
            && req.checks_total > 0
            && req.checks_passed >= req.checks_total
        {
            let summary = format!(
                "Klaim lulus misi {} ditolak server: {} (components={}, wires={}, loops={})",
                rule.id,
                reason,
                req.components.len(),
                req.wires.len(),
                req.loop_iterations
            );
            let _ = sqlx::query(
                "INSERT INTO security_anomalies(id,user_id,actor_email,kind,severity,summary) VALUES($1,$2,$3,'iot_submission_tampering','medium',$4)",
            )
            .bind(Uuid::new_v4())
            .bind(actor.id)
            .bind(&actor.email)
            .bind(&summary)
            .execute(&state.pool)
            .await;
        }
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let score = 100;
    let code_hash = format!("{:x}", Sha256::digest(req.code.as_bytes()));
    let mut tx = state.pool.begin().await?;

    sqlx::query(
        "INSERT INTO iot_mission_completions(user_id, mission_id, board, score, code_sha256, completed_at) VALUES($1, $2, $3, $4, $5, now()) ON CONFLICT (user_id, mission_id) DO UPDATE SET board=EXCLUDED.board, score=GREATEST(iot_mission_completions.score, EXCLUDED.score), code_sha256=EXCLUDED.code_sha256, completed_at=now()",
    )
    .bind(actor.id)
    .bind(rule.id)
    .bind(&req.board)
    .bind(score)
    .bind(&code_hash)
    .execute(&mut *tx)
    .await?;

    let session_id = Uuid::new_v4();
    if let Some(lab) = find_lab(rule.id) {
        let patch_id = lab
            .levels
            .first()
            .map_or("safe-esp32", |l| l.target_patch_id);
        let state_json = json!({
            "board": req.board,
            "component_count": req.components.len(),
            "wire_count": req.wires.len(),
            "checks_passed": req.checks_passed,
            "checks_total": req.checks_total,
            "server_verified": true,
        });
        sqlx::query(
            "INSERT INTO lab_sessions(id, user_id, lab_id, level_id, scenario_version, current_step, selected_patch, baseline_recorded, exploit_proved, verification_passed, reflection_submitted, score, passed, state_json, completed_at) VALUES($1, $2, $3, 'easy', '2026.2', 'refleksi', $4, true, true, true, true, $5, true, $6, now())",
        )
        .bind(session_id)
        .bind(actor.id)
        .bind(lab.id)
        .bind(patch_id)
        .bind(score)
        .bind(&state_json)
        .execute(&mut *tx)
        .await?;
    }

    let mut xp_awarded = 0;
    let mut newly_unlocked: Vec<&'static str> = Vec::new();
    if actor.role == "mahasiswa" {
        let ach_key = format!("iot-sim:{}", rule.id);
        let inserted: Option<(String,)> = sqlx::query_as(
            "INSERT INTO lab_achievements(user_id, achievement_key, xp) VALUES($1, $2, $3) ON CONFLICT (user_id, achievement_key) DO NOTHING RETURNING achievement_key",
        )
        .bind(actor.id)
        .bind(&ach_key)
        .bind(rule.xp)
        .fetch_optional(&mut *tx)
        .await?;
        if inserted.is_some() {
            xp_awarded += rule.xp;
        }

        let total_done: (i64,) = sqlx::query_as(
            "SELECT count(DISTINCT mission_id) FROM iot_mission_completions WHERE user_id=$1",
        )
        .bind(actor.id)
        .fetch_one(&mut *tx)
        .await?;

        let mut unlock_keys: Vec<&'static str> = vec!["badge:iot-perintis", "badge:iot-zero-alert"];
        if rule.requires_tls_telemetry {
            unlock_keys.push("badge:iot-telemetri-tls");
        }
        if total_done.0 >= 5 {
            unlock_keys.push("badge:iot-arsitek");
        }
        if total_done.0 >= IOT_MISSION_RULES.len() as i64 {
            unlock_keys.push("badge:iot-master");
        }

        for bkey in unlock_keys {
            if let Some(spec) = IOT_BADGE_SPECS.iter().find(|s| s.key == bkey) {
                let added: Option<(String,)> = sqlx::query_as(
                    "INSERT INTO lab_achievements(user_id, achievement_key, xp) VALUES($1, $2, $3) ON CONFLICT (user_id, achievement_key) DO NOTHING RETURNING achievement_key",
                )
                .bind(actor.id)
                .bind(spec.key)
                .bind(spec.xp)
                .fetch_optional(&mut *tx)
                .await?;
                if added.is_some() {
                    xp_awarded += spec.xp;
                    newly_unlocked.push(spec.title);
                }
            }
        }
    }

    sqlx::query(
        "INSERT INTO platform_audit_logs(id, actor_id, kind, title, target, result) VALUES($1, $2, 'Praktikum IoT', 'Verifikasi Misi IoT Server-Side', $3, 'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(rule.title)
    .execute(&mut *tx)
    .await
    .ok();

    tx.commit().await?;

    let earned_rows: Vec<(String,)> = sqlx::query_as(
        "SELECT achievement_key FROM lab_achievements WHERE user_id=$1 AND achievement_key LIKE 'badge:iot-%'",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();
    let earned_set: HashSet<String> = earned_rows.into_iter().map(|r| r.0).collect();
    let achievements: Vec<Value> = IOT_BADGE_SPECS
        .iter()
        .map(|b| {
            json!({
                "id": b.id,
                "key": b.key,
                "title": b.title,
                "detail": b.detail,
                "xp": b.xp,
                "earned": earned_set.contains(b.key),
            })
        })
        .collect();

    Ok(Json(json!({
        "session_id": session_id,
        "mission_id": rule.id,
        "score": score,
        "passed": true,
        "xp_awarded": xp_awarded,
        "newly_unlocked": newly_unlocked,
        "achievements": achievements,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iot_mission_catalog_has_ten_missions_and_rejects_tampered_submissions() {
        assert_eq!(IOT_MISSION_RULES.len(), 10);
        assert_eq!(IOT_BADGE_SPECS.len(), 5);

        let rule_tls = find_mission_rule("iot-esp32-mqtt").unwrap();
        let spoofed = SubmitMissionReq {
            mission_id: "iot-esp32-mqtt".into(),
            board: "esp32-c3".into(),
            code: "void setup(){} void loop(){ mqtt.publish(\"a\", \"b\"); }".into(),
            components: vec![],
            wires: vec![],
            component_count: 3,
            wire_count: 5,
            checks_passed: 3,
            checks_total: 3,
            has_hardware_alerts: false,
            loop_iterations: 2,
            has_serial_output: true,
            has_oled_output: false,
            mqtt_tls_verified: true,
        };
        assert!(verify_iot_mission_payload(rule_tls, &spoofed).is_err());

        let valid_tls = SubmitMissionReq {
            mission_id: "iot-esp32-mqtt".into(),
            board: "esp32-c3".into(),
            code: "void setup(){ mqtt.begin(\"mqtts://broker:8883\", true); } void loop(){ mqtt.publish(\"t\", \"1\"); }".into(),
            components: vec![json!({"id": "ldr-1", "kind": "ldr"})],
            wires: vec![
                json!({"from": {"nodeId": "board", "pinId": "3V3"}, "to": {"nodeId": "ldr-1", "pinId": "VCC"}}),
                json!({"from": {"nodeId": "board", "pinId": "GPIO1"}, "to": {"nodeId": "ldr-1", "pinId": "AO"}}),
                json!({"from": {"nodeId": "ldr-1", "pinId": "GND"}, "to": {"nodeId": "board", "pinId": "GND1"}}),
            ],
            component_count: 1,
            wire_count: 3,
            checks_passed: 3,
            checks_total: 3,
            has_hardware_alerts: false,
            loop_iterations: 1,
            has_serial_output: true,
            has_oled_output: false,
            mqtt_tls_verified: true,
        };
        assert!(verify_iot_mission_payload(rule_tls, &valid_tls).is_ok());
    }
}
