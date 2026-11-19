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
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::FromRow;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use instructor::ClassRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(deny_unknown_fields)]
pub struct UserAccessRights {
    pub can_access_web_labs: bool,
    pub can_access_iot_studio: bool,
    pub can_submit_assignments: bool,
    pub can_import_questions: bool,
    pub can_manage_assignments: bool,
    pub can_view_class_analytics: bool,
    pub can_export_reports: bool,
}

#[derive(FromRow)]
struct UserAccessRow {
    user_id: Uuid,
    can_access_web_labs: bool,
    can_access_iot_studio: bool,
    can_submit_assignments: bool,
    can_import_questions: bool,
    can_manage_assignments: bool,
    can_view_class_analytics: bool,
    can_export_reports: bool,
}

impl From<UserAccessRow> for UserAccessRights {
    fn from(r: UserAccessRow) -> Self {
        Self {
            can_access_web_labs: r.can_access_web_labs,
            can_access_iot_studio: r.can_access_iot_studio,
            can_submit_assignments: r.can_submit_assignments,
            can_import_questions: r.can_import_questions,
            can_manage_assignments: r.can_manage_assignments,
            can_view_class_analytics: r.can_view_class_analytics,
            can_export_reports: r.can_export_reports,
        }
    }
}

pub fn default_rights_for_roles(roles: &[String]) -> UserAccessRights {
    let privileged = roles.iter().any(|r| r == "dosen" || r == "admin");
    UserAccessRights {
        can_access_web_labs: true,
        can_access_iot_studio: true,
        can_submit_assignments: true,
        can_import_questions: privileged,
        can_manage_assignments: privileged,
        can_view_class_analytics: privileged,
        can_export_reports: privileged,
    }
}

pub(crate) async fn load_user_access_rights(
    pool: &PgPool,
    user_id: Uuid,
    roles: &[String],
) -> UserAccessRights {
    sqlx::query_as::<_, UserAccessRights>(
        "SELECT can_access_web_labs,can_access_iot_studio,can_submit_assignments,can_import_questions,can_manage_assignments,can_view_class_analytics,can_export_reports FROM user_access_rights WHERE user_id=$1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| default_rights_for_roles(roles))
}

#[derive(FromRow)]
struct AdminUserRow {
    id: Uuid,
    name: String,
    email: String,
    active: bool,
    roles: Vec<String>,
    class_ids: Vec<String>,
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
        "SELECT u.id,u.name,u.email,u.active,ARRAY(SELECT r.role FROM user_roles r WHERE r.user_id=u.id ORDER BY r.role) AS roles,ARRAY(SELECT m.class_id FROM class_memberships m WHERE m.user_id=u.id ORDER BY m.class_id) AS class_ids,u.created_at FROM users u ORDER BY u.created_at DESC",
    )
    .fetch_all(&state.pool)
    .await?;

    let rights_rows: Vec<UserAccessRow> = sqlx::query_as(
        "SELECT user_id,can_access_web_labs,can_access_iot_studio,can_submit_assignments,can_import_questions,can_manage_assignments,can_view_class_analytics,can_export_reports FROM user_access_rights",
    )
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();
    let rights_map: HashMap<Uuid, UserAccessRights> = rights_rows
        .into_iter()
        .map(|r| (r.user_id, r.into()))
        .collect();

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

    let settings = crate::latihan::load_platform_settings(&state.pool).await;

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
        "settings": settings,
        "users": users.iter().map(|u| {
            let perms = rights_map
                .get(&u.id)
                .cloned()
                .unwrap_or_else(|| default_rights_for_roles(&u.roles));
            json!({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "active": u.active,
                "roles": u.roles,
                "class_ids": u.class_ids,
                "permissions": perms,
                "created_at": u.created_at
            })
        }).collect::<Vec<_>>(),
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
    let course = req.course.trim();
    if id.is_empty()
        || id.len() > 24
        || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
        || req.name.trim().is_empty()
        || req.name.len() > 140
        || (course != "Keamanan Web" && course != "IoT")
        || req.semester.trim().is_empty()
        || req.semester.len() > 80
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let mut tx = state.pool.begin().await?;
    sqlx::query("INSERT INTO classes(id,name,course,semester) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,course=EXCLUDED.course,semester=EXCLUDED.semester")
        .bind(&id)
        .bind(req.name.trim())
        .bind(course)
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

pub async fn admin_get_settings(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    if require_role(&actor, "admin").is_err() {
        crate::latihan::record_role_tampering(&state.pool, &actor, "/api/admin/settings").await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let settings = crate::latihan::load_platform_settings(&state.pool).await;
    Ok(Json(json!({ "settings": settings })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateAdminSettingsRequest {
    pub active_tracks: Vec<String>,
    pub enforce_sequential_unlock: bool,
    pub strict_deadline_lock: bool,
    pub block_concurrent_attempts: bool,
    pub max_import_questions: i32,
    pub allow_dosen_question_import: bool,
    pub allow_student_hints: bool,
    pub hide_answer_explanations_until_due: bool,
}

pub async fn admin_update_settings(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<UpdateAdminSettingsRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if require_role(&actor, "admin").is_err() {
        crate::latihan::record_role_tampering(&state.pool, &actor, "/api/admin/settings").await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    // Pastikan jalur hanya boleh 'web' (Cyber Security) dan/atau 'iot' (IoT), dan minimal 1 aktif.
    let mut clean_tracks = Vec::new();
    for t in &req.active_tracks {
        if t != "web" && t != "iot" {
            return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
        }
        if !clean_tracks.contains(t) {
            clean_tracks.push(t.clone());
        }
    }
    if clean_tracks.is_empty() || !(10..=500).contains(&req.max_import_questions) {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let tracks_json = serde_json::json!(clean_tracks);
    let mut tx = state.pool.begin().await?;
    sqlx::query(
        "INSERT INTO platform_settings(id,active_tracks,enforce_sequential_unlock,strict_deadline_lock,block_concurrent_attempts,max_import_questions,allow_dosen_question_import,allow_student_hints,hide_answer_explanations_until_due,updated_by,updated_at) VALUES('default',$1,$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT(id) DO UPDATE SET active_tracks=EXCLUDED.active_tracks,enforce_sequential_unlock=EXCLUDED.enforce_sequential_unlock,strict_deadline_lock=EXCLUDED.strict_deadline_lock,block_concurrent_attempts=EXCLUDED.block_concurrent_attempts,max_import_questions=EXCLUDED.max_import_questions,allow_dosen_question_import=EXCLUDED.allow_dosen_question_import,allow_student_hints=EXCLUDED.allow_student_hints,hide_answer_explanations_until_due=EXCLUDED.hide_answer_explanations_until_due,updated_by=EXCLUDED.updated_by,updated_at=now()",
    )
    .bind(&tracks_json)
    .bind(req.enforce_sequential_unlock)
    .bind(req.strict_deadline_lock)
    .bind(req.block_concurrent_attempts)
    .bind(req.max_import_questions)
    .bind(req.allow_dosen_question_import)
    .bind(req.allow_student_hints)
    .bind(req.hide_answer_explanations_until_due)
    .bind(actor.id)
    .execute(&mut *tx)
    .await?;

    let summary = format!(
        "tracks={:?}, seq={}, deadline={}, hints={}, import={}",
        clean_tracks,
        req.enforce_sequential_unlock,
        req.strict_deadline_lock,
        req.allow_student_hints,
        req.allow_dosen_question_import
    );
    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Kebijakan','Perbarui Pengaturan Admin & Anti-Kecurangan',$3,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&summary)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let saved = crate::latihan::load_platform_settings(&state.pool).await;
    Ok(Json(json!({ "settings": saved })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateUserAccessRequest {
    pub roles: Vec<String>,
    pub class_ids: Vec<String>,
    pub permissions: UserAccessRights,
}

fn validate_roles(roles: &[String]) -> Option<Vec<String>> {
    let mut clean = Vec::new();
    for r in roles {
        let trimmed = r.trim();
        if !matches!(trimmed, "mahasiswa" | "dosen" | "admin") {
            return None;
        }
        if !clean.iter().any(|x| x == trimmed) {
            clean.push(trimmed.to_string());
        }
    }
    if clean.is_empty() { None } else { Some(clean) }
}

pub async fn admin_update_user_access(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(target_user_id): Path<Uuid>,
    Json(req): Json<UpdateUserAccessRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if require_role(&actor, "admin").is_err() {
        crate::latihan::record_role_tampering(
            &state.pool,
            &actor,
            &format!("/api/admin/users/{target_user_id}/access"),
        )
        .await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    let Some(clean_roles) = validate_roles(&req.roles) else {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    };

    let mut clean_classes = Vec::new();
    for cid in &req.class_ids {
        let norm = cid.trim().to_uppercase();
        if norm.is_empty() || norm.len() > 24 {
            return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
        }
        if !clean_classes.contains(&norm) {
            clean_classes.push(norm);
        }
    }

    let mut tx = state.pool.begin().await?;
    let target: Option<(String,)> = sqlx::query_as("SELECT email FROM users WHERE id=$1")
        .bind(target_user_id)
        .fetch_optional(&mut *tx)
        .await?;
    let (email,) = target.ok_or(ApiError(StatusCode::NOT_FOUND))?;

    let valid_class_count: (i64,) = sqlx::query_as("SELECT count(*) FROM classes WHERE id=ANY($1)")
        .bind(&clean_classes)
        .fetch_one(&mut *tx)
        .await?;
    if valid_class_count.0 as usize != clean_classes.len() {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    // Pastikan tidak dapat mencabut hak akses Admin terakhir yang masih aktif.
    let had_admin: Option<(String,)> =
        sqlx::query_as("SELECT role FROM user_roles WHERE user_id=$1 AND role='admin'")
            .bind(target_user_id)
            .fetch_optional(&mut *tx)
            .await?;
    if had_admin.is_some() && !clean_roles.iter().any(|r| r == "admin") {
        let other_admins: (i64,) = sqlx::query_as(
            "SELECT count(*) FROM users u JOIN user_roles r ON r.user_id=u.id WHERE r.role='admin' AND u.active AND u.id<>$1",
        )
        .bind(target_user_id)
        .fetch_one(&mut *tx)
        .await?;
        if other_admins.0 == 0 {
            return Err(ApiError(StatusCode::CONFLICT));
        }
    }

    let primary_role = if clean_roles.iter().any(|r| r == "admin") {
        "admin"
    } else if clean_roles.iter().any(|r| r == "dosen") {
        "dosen"
    } else {
        "mahasiswa"
    };
    sqlx::query("UPDATE users SET role=$1 WHERE id=$2")
        .bind(primary_role)
        .bind(target_user_id)
        .execute(&mut *tx)
        .await?;

    let current_roles: Vec<(String,)> =
        sqlx::query_as("SELECT role FROM user_roles WHERE user_id=$1")
            .bind(target_user_id)
            .fetch_all(&mut *tx)
            .await?;
    for (existing,) in &current_roles {
        if !clean_roles.contains(existing) {
            sqlx::query("DELETE FROM user_roles WHERE user_id=$1 AND role=$2")
                .bind(target_user_id)
                .bind(existing)
                .execute(&mut *tx)
                .await?;
        }
    }
    for r in &clean_roles {
        sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,$2) ON CONFLICT DO NOTHING")
            .bind(target_user_id)
            .bind(r)
            .execute(&mut *tx)
            .await?;
    }

    let class_role = if clean_roles.iter().any(|r| r == "dosen") {
        "dosen"
    } else {
        "mahasiswa"
    };
    sqlx::query("DELETE FROM class_memberships WHERE user_id=$1")
        .bind(target_user_id)
        .execute(&mut *tx)
        .await?;
    for cid in &clean_classes {
        sqlx::query(
            "INSERT INTO class_memberships(class_id,user_id,role_in_class) VALUES($1,$2,$3) ON CONFLICT(class_id,user_id) DO UPDATE SET role_in_class=EXCLUDED.role_in_class",
        )
        .bind(cid)
        .bind(target_user_id)
        .bind(class_role)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        "INSERT INTO user_access_rights(user_id,can_access_web_labs,can_access_iot_studio,can_submit_assignments,can_import_questions,can_manage_assignments,can_view_class_analytics,can_export_reports,updated_by,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now()) ON CONFLICT(user_id) DO UPDATE SET can_access_web_labs=EXCLUDED.can_access_web_labs,can_access_iot_studio=EXCLUDED.can_access_iot_studio,can_submit_assignments=EXCLUDED.can_submit_assignments,can_import_questions=EXCLUDED.can_import_questions,can_manage_assignments=EXCLUDED.can_manage_assignments,can_view_class_analytics=EXCLUDED.can_view_class_analytics,can_export_reports=EXCLUDED.can_export_reports,updated_by=EXCLUDED.updated_by,updated_at=now()",
    )
    .bind(target_user_id)
    .bind(req.permissions.can_access_web_labs)
    .bind(req.permissions.can_access_iot_studio)
    .bind(req.permissions.can_submit_assignments)
    .bind(req.permissions.can_import_questions)
    .bind(req.permissions.can_manage_assignments)
    .bind(req.permissions.can_view_class_analytics)
    .bind(req.permissions.can_export_reports)
    .bind(actor.id)
    .execute(&mut *tx)
    .await?;

    let target_label = format!(
        "{} roles={:?} classes={:?}",
        email, clean_roles, clean_classes
    );
    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Akses','Atur Peran & Hak Akses Pengguna',$3,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&target_label)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({
        "user_id": target_user_id,
        "roles": clean_roles,
        "class_ids": clean_classes,
        "permissions": req.permissions,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_roles_and_computes_default_rights() {
        assert!(validate_roles(&[]).is_none());
        assert!(validate_roles(&["superuser".into()]).is_none());
        assert_eq!(
            validate_roles(&["dosen".into(), "admin".into(), "dosen".into()]),
            Some(vec!["dosen".into(), "admin".into()])
        );

        let stu = default_rights_for_roles(&["mahasiswa".into()]);
        assert!(stu.can_access_web_labs && stu.can_access_iot_studio && stu.can_submit_assignments);
        assert!(!stu.can_import_questions && !stu.can_manage_assignments);

        let dos = default_rights_for_roles(&["dosen".into()]);
        assert!(dos.can_import_questions && dos.can_manage_assignments && dos.can_export_reports);
    }
}
