use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use super::{
    handlers::ActivityRow,
    telemetry::{extract_telemetry, record_activity},
};
use crate::{ApiError, AppState, identity, portal::require_role, verify_mutation};

#[derive(Serialize, FromRow)]
pub struct AdminActiveSessionRow {
    pub session_id: Uuid,
    pub user_id: Uuid,
    pub user_name: String,
    pub email: String,
    pub active_role: String,
    pub ip_address: Option<String>,
    pub device_label: Option<String>,
    pub location_label: Option<String>,
    pub current_path: Option<String>,
    pub mfa_verified: bool,
    pub created_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Serialize, FromRow)]
pub struct SecurityAnomalyRow {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub actor_email: Option<String>,
    pub user_name: Option<String>,
    pub kind: String,
    pub severity: String,
    pub summary: String,
    pub ip_address: Option<String>,
    pub device_label: Option<String>,
    pub location_label: Option<String>,
    pub acknowledged: bool,
    pub created_at: DateTime<Utc>,
}

pub async fn admin_security_monitor(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "admin")?;

    let active_sessions: Vec<AdminActiveSessionRow> = sqlx::query_as(
        "SELECT s.session_id, u.id AS user_id, u.name AS user_name, u.email, s.active_role, s.ip_address, s.device_label, s.location_label, s.current_path, s.mfa_verified, s.created_at, s.last_seen_at, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.expires_at>now() AND s.last_seen_at>now()-interval '30 minutes' ORDER BY s.last_seen_at DESC",
    )
    .fetch_all(&state.pool)
    .await?;

    let activity_logs: Vec<ActivityRow> = sqlx::query_as(
        "SELECT a.id, a.user_id, a.actor_email, u.name AS user_name, a.action, a.route_path, a.ip_address, a.device_label, a.location_label, a.anomaly_flag, a.detail, a.created_at FROM user_activity_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 80",
    )
    .fetch_all(&state.pool)
    .await?;

    let anomalies: Vec<SecurityAnomalyRow> = sqlx::query_as(
        "SELECT sa.id, sa.user_id, sa.actor_email, u.name AS user_name, sa.kind, sa.severity, sa.summary, sa.ip_address, sa.device_label, sa.location_label, sa.acknowledged, sa.created_at FROM security_anomalies sa LEFT JOIN users u ON u.id=sa.user_id ORDER BY sa.acknowledged ASC, sa.created_at DESC LIMIT 50",
    )
    .fetch_all(&state.pool)
    .await?;

    let unacknowledged_anomalies = anomalies.iter().filter(|a| !a.acknowledged).count();
    let mfa_enabled_users: (i64,) =
        sqlx::query_as("SELECT count(*) FROM user_security_settings WHERE mfa_enabled=true")
            .fetch_one(&state.pool)
            .await?;
    let emails_sent_total: (i64,) =
        sqlx::query_as("SELECT count(*) FROM email_notifications WHERE status='sent'")
            .fetch_one(&state.pool)
            .await?;

    Ok(Json(json!({
        "summary": {
            "active_sessions": active_sessions.len(),
            "unacknowledged_anomalies": unacknowledged_anomalies,
            "mfa_enabled_users": mfa_enabled_users.0,
            "emails_sent_total": emails_sent_total.0,
        },
        "active_sessions": active_sessions,
        "activity_logs": activity_logs,
        "anomalies": anomalies,
    })))
}

pub async fn admin_revoke_session(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "admin")?;

    let target: Option<(Uuid, String)> = sqlx::query_as(
        "DELETE FROM sessions s USING users u WHERE s.session_id=$1 AND u.id=s.user_id RETURNING s.user_id, u.email",
    )
    .bind(session_id)
    .fetch_optional(&state.pool)
    .await?;
    let (target_uid, target_email) = target.ok_or(ApiError(StatusCode::NOT_FOUND))?;

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(target_uid),
        Some(&target_email),
        Some(session_id),
        "session_revoked_by_admin",
        Some("/lab/admin/audit"),
        &telemetry,
        false,
        &format!("Sesi dicabut oleh Admin ({})", actor.email),
    )
    .await;

    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Sesi','Cabut sesi pengguna aktif',$3,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&target_email)
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "revoked": true, "session_id": session_id })))
}

pub async fn admin_ack_anomaly(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(anomaly_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "admin")?;

    let res = sqlx::query(
        "UPDATE security_anomalies SET acknowledged=true, acknowledged_by=$1 WHERE id=$2",
    )
    .bind(actor.id)
    .bind(anomaly_id)
    .execute(&state.pool)
    .await?;
    if res.rows_affected() == 0 {
        return Err(ApiError(StatusCode::NOT_FOUND));
    }
    Ok(Json(json!({ "acknowledged": true, "id": anomaly_id })))
}

#[derive(Serialize, FromRow)]
struct ClassBackupRow {
    id: String,
    name: String,
    course: String,
    semester: String,
    leaderboard_enabled: bool,
    active: bool,
}

#[derive(Serialize, FromRow)]
struct UserBackupRow {
    id: Uuid,
    name: String,
    email: String,
    active: bool,
}

#[derive(Serialize, FromRow)]
struct ModuleBackupRow {
    lab_id: String,
    track: String,
    owasp_code: Option<String>,
    status: String,
    version: String,
}

pub async fn export_admin_backup(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "admin")?;

    let classes: Vec<ClassBackupRow> = sqlx::query_as(
        "SELECT id, name, course, semester, leaderboard_enabled, active FROM classes ORDER BY id",
    )
    .fetch_all(&state.pool)
    .await?;

    let users: Vec<UserBackupRow> =
        sqlx::query_as("SELECT id, name, email, active FROM users ORDER BY email")
            .fetch_all(&state.pool)
            .await?;

    let modules: Vec<ModuleBackupRow> = sqlx::query_as(
        "SELECT lab_id, track, owasp_code, status, version FROM lab_modules ORDER BY lab_id",
    )
    .fetch_all(&state.pool)
    .await?;

    let anomalies: Vec<SecurityAnomalyRow> = sqlx::query_as(
        "SELECT sa.id, sa.user_id, sa.actor_email, u.name AS user_name, sa.kind, sa.severity, sa.summary, sa.ip_address, sa.device_label, sa.location_label, sa.acknowledged, sa.created_at FROM security_anomalies sa LEFT JOIN users u ON u.id=sa.user_id ORDER BY sa.created_at DESC LIMIT 200",
    )
    .fetch_all(&state.pool)
    .await?;

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "admin_backup_exported",
        Some("/lab/admin/audit"),
        &telemetry,
        false,
        "Mengunduh cadangan sistem portal WebLabIFA (JSON)",
    )
    .await;

    Ok(Json(json!({
        "schema": "weblabifa.admin_backup.v1",
        "exported_at": Utc::now(),
        "exported_by": actor.email,
        "backup_policy": {
            "hash_algorithm": "Argon2id",
            "excludes_secrets": true,
        },
        "classes": classes,
        "users": users,
        "lab_modules": modules,
        "security_anomalies": anomalies,
    })))
}

fn deterministic_seed_uuid(key: &str) -> Uuid {
    let hash = Sha256::digest(key.as_bytes());
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&hash[..16]);
    Uuid::from_bytes(bytes)
}

/// Membentuk jejak aktivitas, notifikasi email tugas, dan peringatan anomali contoh saat seeding.
pub async fn seed_security_demo_data(pool: &PgPool) {
    let students: Vec<(Uuid, String, String)> = sqlx::query_as(
        "SELECT u.id, u.name, u.email FROM users u JOIN user_roles r ON r.user_id=u.id WHERE r.role='mahasiswa' ORDER BY u.email LIMIT 5",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (idx, (uid, name, email)) in students.iter().enumerate() {
        let notif_id = deterministic_seed_uuid(&format!("seed-notif:{email}"));
        let _ = sqlx::query(
            "INSERT INTO email_notifications(id,user_id,recipient_email,category,subject,body_preview,status,sent_at) VALUES($1,$2,$3,'assignment','[Tugas Baru IF-4A] Audit Celah Akses IDOR','Tugas praktikum Broken Access Control (level 1-2) telah diterbitkan oleh dosen pengampu.','sent',now()-interval '2 hours') ON CONFLICT(id) DO NOTHING",
        )
        .bind(notif_id)
        .bind(uid)
        .bind(email)
        .execute(pool)
        .await;

        let act_id = deterministic_seed_uuid(&format!("seed-act:{email}"));
        let _ = sqlx::query(
            "INSERT INTO user_activity_logs(id,user_id,actor_email,action,route_path,ip_address,device_label,location_label,anomaly_flag,detail,created_at) VALUES($1,$2,$3,'login_success','/lab/web/A01/broken-access-control',$4,'Chrome · Windows','Jaringan Kampus ITERA',false,$5,now()-interval '45 minutes') ON CONFLICT(id) DO NOTHING",
        )
        .bind(act_id)
        .bind(uid)
        .bind(email)
        .bind(format!("10.24.10.{}", 20 + idx))
        .bind(format!("{name} membuka modul praktikum Broken Access Control"))
        .execute(pool)
        .await;
    }

    if let Some((uid, name, email)) = students.first() {
        let anomaly_id = deterministic_seed_uuid("seed-anomaly-device-1");
        let _ = sqlx::query(
            "INSERT INTO security_anomalies(id,user_id,actor_email,kind,severity,summary,ip_address,device_label,location_label,acknowledged,created_at) VALUES($1,$2,$3,'new_device','medium',$4,'182.10.42.88','Firefox · Linux','Jaringan Publik (182.10.42.88)',false,now()-interval '12 minutes') ON CONFLICT(id) DO NOTHING",
        )
        .bind(anomaly_id)
        .bind(uid)
        .bind(email)
        .bind(format!("Login perangkat baru terdeteksi pada akun {name} ({email})"))
        .execute(pool)
        .await;
    }
}
