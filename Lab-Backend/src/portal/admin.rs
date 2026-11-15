use super::*;
use crate::{
    ApiError, AppState, identity,
    simulator_catalog::{all_labs, find_lab},
    verify_mutation,
};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::FromRow;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use instructor::ClassRow;

#[derive(FromRow)]
struct AdminUserRow {
    id: Uuid,
    name: String,
    email: String,
    active: bool,
    roles: Vec<String>,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct AuditLogRow {
    id: Uuid,
    kind: String,
    title: String,
    target: String,
    result: String,
    created_at: DateTime<Utc>,
}

pub async fn admin_dashboard(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "admin")?;

    let users: Vec<AdminUserRow> = sqlx::query_as(
        "SELECT u.id,u.name,u.email,u.active,ARRAY(SELECT r.role FROM user_roles r WHERE r.user_id=u.id ORDER BY r.role) AS roles,u.created_at FROM users u ORDER BY u.created_at DESC",
    )
    .fetch_all(&state.pool)
    .await?;

    let classes: Vec<ClassRow> = sqlx::query_as(
        "SELECT id,name,course,semester,timezone,leaderboard_enabled,active FROM classes ORDER BY id",
    )
    .fetch_all(&state.pool)
    .await?;

    let modules: Vec<ModuleRow> =
        sqlx::query_as("SELECT lab_id,status,version FROM lab_modules ORDER BY lab_id")
            .fetch_all(&state.pool)
            .await?;

    let session_count: (i64,) = sqlx::query_as("SELECT count(*) FROM lab_sessions")
        .fetch_one(&state.pool)
        .await?;

    let audits: Vec<AuditLogRow> = sqlx::query_as(
        "SELECT id,kind,title,target,result,created_at FROM platform_audit_logs ORDER BY created_at DESC LIMIT 20",
    )
    .fetch_all(&state.pool)
    .await?;

    let mod_map: HashMap<String, (String, String)> = modules
        .into_iter()
        .map(|m| (m.lab_id, (m.status, m.version)))
        .collect();

    let published_web: HashSet<&str> = all_labs()
        .iter()
        .filter(|l| l.track == "web" && mod_map.get(l.id).is_some_and(|(s, _)| s == "Terbit"))
        .filter_map(|l| l.owasp_code)
        .collect();

    let role_counts = json!({
        "mahasiswa": users.iter().filter(|u| u.roles.contains(&"mahasiswa".to_string())).count(),
        "dosen": users.iter().filter(|u| u.roles.contains(&"dosen".to_string())).count(),
        "admin": users.iter().filter(|u| u.roles.contains(&"admin".to_string())).count(),
    });

    Ok(Json(json!({
        "kpis": {
            "active_accounts": users.iter().filter(|u| u.active).count(),
            "total_accounts": users.len(),
            "active_classes": classes.iter().filter(|c| c.active).count(),
            "published_labs": mod_map.values().filter(|(s, _)| s == "Terbit").count(),
            "owasp_covered": published_web.len(),
            "total_sessions": session_count.0,
        },
        "role_counts": role_counts,
        "users": users.iter().map(|u| json!({
            "id": u.id, "name": u.name, "email": u.email, "active": u.active, "roles": u.roles, "created_at": u.created_at
        })).collect::<Vec<_>>(),
        "classes": classes.iter().map(|c| json!({
            "id": c.id, "name": c.name, "course": c.course, "semester": c.semester, "timezone": c.timezone, "leaderboard_enabled": c.leaderboard_enabled, "active": c.active
        })).collect::<Vec<_>>(),
        "modules": all_labs().iter().map(|l| {
            let (status, version) = mod_map.get(l.id).cloned().unwrap_or_else(|| ("Terbit".into(), "1.0.0".into()));
            json!({ "lab_id": l.id, "title": l.title, "track": l.track, "owasp_code": l.owasp_code, "status": status, "version": version })
        }).collect::<Vec<_>>(),
        "audit_logs": audits.iter().map(|a| json!({
            "id": a.id, "kind": a.kind, "title": a.title, "target": a.target, "result": a.result, "created_at": a.created_at
        })).collect::<Vec<_>>(),
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ToggleUserStatusRequest {
    pub active: bool,
}

pub async fn admin_set_user_status(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(target_user_id): Path<Uuid>,
    Json(req): Json<ToggleUserStatusRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "admin")?;

    let mut tx = state.pool.begin().await?;
    if !req.active {
        // Pastikan selalu tersisa minimal satu admin aktif, termasuk pada mutasi paralel
        let other_admins: (i64,) = sqlx::query_as(
            "SELECT count(*) FROM users u JOIN user_roles r ON r.user_id=u.id WHERE r.role='admin' AND u.active AND u.id<>$1",
        )
        .bind(target_user_id)
        .fetch_one(&mut *tx)
        .await?;
        let is_target_admin: Option<(String,)> =
            sqlx::query_as("SELECT role FROM user_roles WHERE user_id=$1 AND role='admin'")
                .bind(target_user_id)
                .fetch_optional(&mut *tx)
                .await?;
        if is_target_admin.is_some() && other_admins.0 == 0 {
            return Err(ApiError(StatusCode::CONFLICT));
        }
    }

    let updated: Option<(String,)> =
        sqlx::query_as("UPDATE users SET active=$1 WHERE id=$2 RETURNING email")
            .bind(req.active)
            .bind(target_user_id)
            .fetch_optional(&mut *tx)
            .await?;
    let (email,) = updated.ok_or(ApiError(StatusCode::NOT_FOUND))?;

    if !req.active {
        sqlx::query("DELETE FROM sessions WHERE user_id=$1")
            .bind(target_user_id)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Akun',$3,$4,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(if req.active { "Aktifkan akun pengguna" } else { "Nonaktifkan akun & cabut sesi" })
    .bind(&email)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({ "id": target_user_id, "active": req.active })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateClassRequest {
    pub id: String,
    pub name: String,
    pub course: String,
    pub semester: String,
}

pub async fn admin_create_class(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<CreateClassRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "admin")?;
    let id = req.id.trim().to_uppercase();
    if id.is_empty()
        || id.len() > 24
        || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        || req.name.trim().is_empty()
        || req.name.len() > 140
        || req.course.trim().is_empty()
        || req.course.len() > 140
        || req.semester.trim().is_empty()
        || req.semester.len() > 80
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO classes(id,name,course,semester) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,course=EXCLUDED.course,semester=EXCLUDED.semester")
        .bind(&id)
        .bind(req.name.trim())
        .bind(req.course.trim())
        .bind(req.semester.trim())
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Kelas','Simpan konfigurasi kelas',$3,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(json!({ "id": id, "name": req.name.trim() })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ModuleStatusRequest {
    pub status: String,
}

pub async fn admin_update_module_status(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(lab_id): Path<String>,
    Json(req): Json<ModuleStatusRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "admin")?;
    if find_lab(&lab_id).is_none()
        || !matches!(
            req.status.as_str(),
            "Draft" | "Review" | "Terbit" | "Rencana"
        )
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let mut tx = state.pool.begin().await?;
    sqlx::query("UPDATE lab_modules SET status=$1,updated_by=$2,updated_at=now() WHERE lab_id=$3")
        .bind(&req.status)
        .bind(actor.id)
        .bind(&lab_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Publikasi',$3,$4,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(format!("Ubah status modul -> {}", req.status))
    .bind(&lab_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(json!({ "lab_id": lab_id, "status": req.status })))
}
