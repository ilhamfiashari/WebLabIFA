use crate::{ApiError, AppState, identity, simulator_catalog::find_lab};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::FromRow;
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
    lab_id: String,
    score: Option<i32>,
    updated_at: DateTime<Utc>,
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
pub struct SubmitMissionReq {
    pub mission_id: String,
    pub board: String,
    pub code: String,
    pub component_count: usize,
    pub wire_count: usize,
    pub checks_passed: usize,
    pub checks_total: usize,
    pub has_hardware_alerts: bool,
}

fn valid_board(board: &str) -> bool {
    matches!(board, "esp32-c3" | "esp32" | "arduino-uno" | "pico-w")
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
        "SELECT DISTINCT ON (lab_id) lab_id, score, updated_at FROM lab_sessions WHERE user_id = $1 AND lab_id LIKE 'iot-esp32-%' AND passed = true ORDER BY lab_id, updated_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

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

    let completed_missions: Vec<Value> = missions
        .into_iter()
        .map(|m| {
            json!({
                "mission_id": m.lab_id,
                "score": m.score.unwrap_or(100),
                "completed_at": m.updated_at,
            })
        })
        .collect();

    Ok(Json(json!({
        "projects": projects,
        "completed_missions": completed_missions,
    })))
}

pub async fn save_iot_project(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<SaveProjectReq>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
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
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
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
    Json(req): Json<SubmitMissionReq>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    if !valid_board(&req.board) || req.code.len() > 8192 {
        return Err(ApiError(StatusCode::BAD_REQUEST));
    }
    let Some(lab) = find_lab(&req.mission_id) else {
        return Err(ApiError(StatusCode::NOT_FOUND));
    };
    if lab.track != "iot" {
        return Err(ApiError(StatusCode::BAD_REQUEST));
    }
    if req.checks_total == 0 || req.checks_passed < req.checks_total || req.has_hardware_alerts {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let score = if req.has_hardware_alerts { 75 } else { 100 };
    let session_id = Uuid::new_v4();
    let patch_id = lab
        .levels
        .first()
        .map_or("safe-esp32", |l| l.target_patch_id);
    let state_json = json!({
        "board": req.board,
        "component_count": req.component_count,
        "wire_count": req.wire_count,
        "checks_passed": req.checks_passed,
        "checks_total": req.checks_total,
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
    .execute(&state.pool)
    .await?;

    let ach_key = format!("iot-sim:{}", lab.id);
    let xp_awarded = if actor.role == "mahasiswa" { 50 } else { 0 };
    if xp_awarded > 0 {
        sqlx::query(
            "INSERT INTO lab_achievements(user_id, achievement_key, xp) VALUES($1, $2, $3) ON CONFLICT (user_id, achievement_key) DO NOTHING",
        )
        .bind(actor.id)
        .bind(&ach_key)
        .bind(xp_awarded)
        .execute(&state.pool)
        .await?;
    }

    sqlx::query(
        "INSERT INTO platform_audit_logs(id, actor_id, kind, title, target, result) VALUES($1, $2, 'Praktikum IoT', 'Verifikasi Sirkuit & Firmware ESP32', $3, 'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(lab.id)
    .execute(&state.pool)
    .await
    .ok();

    Ok(Json(json!({
        "session_id": session_id,
        "mission_id": lab.id,
        "score": score,
        "passed": true,
        "xp_awarded": xp_awarded,
    })))
}
