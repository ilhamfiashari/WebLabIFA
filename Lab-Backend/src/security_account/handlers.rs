use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::FromRow;
use uuid::Uuid;

use super::{
    telemetry::{extract_telemetry, record_activity},
    totp::{
        argon2_hash_secret, argon2_verify_secret, generate_backup_codes, generate_totp_secret,
        sha256_hex, verify_totp_code,
    },
};
use crate::{ApiError, AppState, hash, identity, verify_mutation};

#[derive(Serialize, FromRow)]
pub struct PasskeyRow {
    pub id: Uuid,
    pub credential_id: String,
    pub device_name: String,
    pub transports: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
pub struct UserSessionRow {
    pub session_id: Uuid,
    pub active_role: String,
    pub ip_address: Option<String>,
    pub device_label: Option<String>,
    pub location_label: Option<String>,
    pub current_path: Option<String>,
    pub mfa_verified: bool,
    pub created_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub is_current: bool,
}

#[derive(Serialize, FromRow)]
pub struct NotificationRow {
    pub id: Uuid,
    pub recipient_email: String,
    pub category: String,
    pub subject: String,
    pub body_preview: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub sent_at: Option<DateTime<Utc>>,
    pub read_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
pub struct ActivityRow {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub actor_email: Option<String>,
    pub user_name: Option<String>,
    pub action: String,
    pub route_path: Option<String>,
    pub ip_address: Option<String>,
    pub device_label: Option<String>,
    pub location_label: Option<String>,
    pub anomaly_flag: bool,
    pub detail: String,
    pub created_at: DateTime<Utc>,
}

pub async fn get_security_settings(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    let current_token_hash = jar
        .get(state.config.session_cookie())
        .map(|c| hash(c.value()))
        .unwrap_or_default();

    let settings: Option<(Option<String>, bool, bool, bool, bool, bool)> = sqlx::query_as(
        "SELECT secondary_email, notify_assignments, notify_feedback, notify_security_alerts, mfa_enabled, totp_verified FROM user_security_settings WHERE user_id=$1",
    )
    .bind(actor.id)
    .fetch_optional(&state.pool)
    .await?;
    let (secondary_email, n_assign, n_feed, n_sec, mfa_enabled, totp_verified) =
        settings.unwrap_or((None, true, true, true, false, false));

    let backup_remaining: (i64,) = sqlx::query_as(
        "SELECT count(*) FROM mfa_backup_codes WHERE user_id=$1 AND used_at IS NULL",
    )
    .bind(actor.id)
    .fetch_one(&state.pool)
    .await?;

    let passkeys: Vec<PasskeyRow> = sqlx::query_as(
        "SELECT id, credential_id, device_name, transports, created_at, last_used_at FROM user_passkeys WHERE user_id=$1 ORDER BY created_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let sessions: Vec<UserSessionRow> = sqlx::query_as(
        "SELECT session_id, active_role, ip_address, device_label, location_label, current_path, mfa_verified, created_at, last_seen_at, expires_at, (token_hash=$2) AS is_current FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY last_seen_at DESC",
    )
    .bind(actor.id)
    .bind(&current_token_hash)
    .fetch_all(&state.pool)
    .await?;

    let notifications: Vec<NotificationRow> = sqlx::query_as(
        "SELECT id, recipient_email, category, subject, body_preview, status, created_at, sent_at, read_at FROM email_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let recent_activity: Vec<ActivityRow> = sqlx::query_as(
        "SELECT a.id, a.user_id, a.actor_email, u.name AS user_name, a.action, a.route_path, a.ip_address, a.device_label, a.location_label, a.anomaly_flag, a.detail, a.created_at FROM user_activity_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.user_id=$1 ORDER BY a.created_at DESC LIMIT 15",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(json!({
        "primary_email": actor.email,
        "secondary_email": secondary_email,
        "notify_assignments": n_assign,
        "notify_feedback": n_feed,
        "notify_security_alerts": n_sec,
        "mfa_enabled": mfa_enabled,
        "totp_verified": totp_verified,
        "backup_codes_remaining": backup_remaining.0,
        "backup_hash_algorithm": "Argon2id",
        "passkeys": passkeys,
        "sessions": sessions,
        "notifications": notifications,
        "recent_activity": recent_activity,
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateEmailPrefsRequest {
    pub secondary_email: Option<String>,
    pub notify_assignments: bool,
    pub notify_feedback: bool,
    pub notify_security_alerts: bool,
}

pub async fn update_email_preferences(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<UpdateEmailPrefsRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let sec_clean = req
        .secondary_email
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_ascii_lowercase);
    if let Some(ref e) = sec_clean
        && (!e.contains('@') || e.len() > 160 || e.contains(' '))
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    sqlx::query(
        "INSERT INTO user_security_settings(user_id,secondary_email,notify_assignments,notify_feedback,notify_security_alerts,updated_at) VALUES($1,$2,$3,$4,$5,now()) ON CONFLICT(user_id) DO UPDATE SET secondary_email=EXCLUDED.secondary_email, notify_assignments=EXCLUDED.notify_assignments, notify_feedback=EXCLUDED.notify_feedback, notify_security_alerts=EXCLUDED.notify_security_alerts, updated_at=now()",
    )
    .bind(actor.id)
    .bind(&sec_clean)
    .bind(req.notify_assignments)
    .bind(req.notify_feedback)
    .bind(req.notify_security_alerts)
    .execute(&state.pool)
    .await?;

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "email_preferences_updated",
        Some("/pengaturan"),
        &telemetry,
        false,
        "Memperbarui email notifikasi & preferensi peringatan",
    )
    .await;

    Ok(Json(json!({ "ok": true, "secondary_email": sec_clean })))
}

pub async fn enroll_totp(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let secret = generate_totp_secret();
    sqlx::query(
        "INSERT INTO user_security_settings(user_id,totp_secret_b32,totp_verified,updated_at) VALUES($1,$2,false,now()) ON CONFLICT(user_id) DO UPDATE SET totp_secret_b32=EXCLUDED.totp_secret_b32, totp_verified=false, updated_at=now()",
    )
    .bind(actor.id)
    .bind(&secret)
    .execute(&state.pool)
    .await?;

    let otpauth_uri = format!(
        "otpauth://totp/WebLabIFA:{}?secret={secret}&issuer=WebLabIFA&algorithm=SHA1&digits=6&period=30",
        actor.email
    );
    Ok(Json(json!({
        "secret": secret,
        "otpauth_uri": otpauth_uri,
        "issuer": "WebLabIFA",
        "account": actor.email,
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CodeRequest {
    pub code: String,
}

pub async fn verify_and_enable_totp(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<CodeRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let secret: Option<(Option<String>,)> =
        sqlx::query_as("SELECT totp_secret_b32 FROM user_security_settings WHERE user_id=$1")
            .bind(actor.id)
            .fetch_optional(&state.pool)
            .await?;
    let secret = secret
        .and_then(|r| r.0)
        .ok_or(ApiError(StatusCode::BAD_REQUEST))?;
    let now = Utc::now().timestamp().max(0) as u64;
    if !verify_totp_code(&secret, &req.code, now) {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    sqlx::query(
        "UPDATE user_security_settings SET totp_verified=true, mfa_enabled=true, updated_at=now() WHERE user_id=$1",
    )
    .bind(actor.id)
    .execute(&state.pool)
    .await?;

    if let Some(cookie) = jar.get(state.config.session_cookie()) {
        sqlx::query("UPDATE sessions SET mfa_verified=true WHERE token_hash=$1")
            .bind(hash(cookie.value()))
            .execute(&state.pool)
            .await?;
    }

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "mfa_totp_enabled",
        Some("/pengaturan"),
        &telemetry,
        false,
        "Mengaktifkan Authenticator App (TOTP) & MFA",
    )
    .await;

    Ok(Json(json!({ "mfa_enabled": true, "totp_verified": true })))
}

pub async fn disable_totp(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    sqlx::query(
        "UPDATE user_security_settings SET mfa_enabled=false, totp_verified=false, totp_secret_b32=NULL, updated_at=now() WHERE user_id=$1",
    )
    .bind(actor.id)
    .execute(&state.pool)
    .await?;

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "mfa_disabled",
        Some("/pengaturan"),
        &telemetry,
        true,
        "Menonaktifkan autentikasi multi-faktor (TOTP)",
    )
    .await;

    Ok(Json(
        json!({ "mfa_enabled": false, "totp_verified": false }),
    ))
}

pub async fn regenerate_backup_codes(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let codes = generate_backup_codes(8);

    let mut tx = state.pool.begin().await?;
    sqlx::query("DELETE FROM mfa_backup_codes WHERE user_id=$1")
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;
    for code in &codes {
        let digest = argon2_hash_secret(&code.replace('-', ""))
            .map_err(|_| ApiError(StatusCode::INTERNAL_SERVER_ERROR))?;
        sqlx::query("INSERT INTO mfa_backup_codes(id,user_id,code_hash) VALUES($1,$2,$3)")
            .bind(Uuid::new_v4())
            .bind(actor.id)
            .bind(digest)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query(
        "INSERT INTO user_security_settings(user_id,mfa_enabled,updated_at) VALUES($1,true,now()) ON CONFLICT(user_id) DO UPDATE SET mfa_enabled=true, updated_at=now()",
    )
    .bind(actor.id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "backup_codes_regenerated",
        Some("/pengaturan"),
        &telemetry,
        false,
        "Menerbitkan 8 kode cadangan (backup codes) baru",
    )
    .await;

    Ok(Json(json!({ "codes": codes, "remaining": codes.len() })))
}

pub async fn verify_mfa_challenge(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<CodeRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let trimmed = req.code.trim().to_ascii_uppercase();
    if trimmed.is_empty() || trimmed.len() > 32 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let settings: Option<(Option<String>, bool)> = sqlx::query_as(
        "SELECT totp_secret_b32, totp_verified FROM user_security_settings WHERE user_id=$1",
    )
    .bind(actor.id)
    .fetch_optional(&state.pool)
    .await?;

    let now = Utc::now().timestamp().max(0) as u64;
    let mut method = None;
    if let Some((Some(secret), true)) = settings
        && verify_totp_code(&secret, &trimmed, now)
    {
        method = Some("totp");
    }

    if method.is_none() {
        let normalized = trimmed.replace('-', "");
        let sha_digest = sha256_hex(&normalized);
        let unused_codes: Vec<(Uuid, String)> = sqlx::query_as(
            "SELECT id, code_hash FROM mfa_backup_codes WHERE user_id=$1 AND used_at IS NULL",
        )
        .bind(actor.id)
        .fetch_all(&state.pool)
        .await?;

        let matched_id = unused_codes.into_iter().find_map(|(id, stored)| {
            let is_match = if stored.starts_with("$argon2") {
                argon2_verify_secret(&normalized, &stored)
            } else {
                stored == sha_digest
            };
            is_match.then_some(id)
        });

        if let Some(code_id) = matched_id {
            let consumed: Option<(Uuid,)> = sqlx::query_as(
                "UPDATE mfa_backup_codes SET used_at=now() WHERE id=$1 AND user_id=$2 AND used_at IS NULL RETURNING id",
            )
            .bind(code_id)
            .bind(actor.id)
            .fetch_optional(&state.pool)
            .await?;
            if consumed.is_some() {
                method = Some("backup_code");
            }
        }
    }

    let Some(used_method) = method else {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    };

    if let Some(cookie) = jar.get(state.config.session_cookie()) {
        sqlx::query("UPDATE sessions SET mfa_verified=true WHERE token_hash=$1")
            .bind(hash(cookie.value()))
            .execute(&state.pool)
            .await?;
    }

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "mfa_verified",
        Some("/pengaturan"),
        &telemetry,
        false,
        &format!("Verifikasi MFA berhasil menggunakan {used_method}"),
    )
    .await;

    Ok(Json(json!({ "verified": true, "method": used_method })))
}

pub async fn challenge_passkey(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let mut raw = [0u8; 32];
    rand::rng().fill_bytes(&mut raw);
    let challenge = hex::encode(raw);
    Ok(Json(json!({
        "challenge": challenge,
        "rp_name": "WebLabIFA",
        "user_id": actor.id.to_string(),
        "user_name": actor.email,
        "user_display_name": actor.name,
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RegisterPasskeyRequest {
    pub credential_id: String,
    pub device_name: String,
    pub transports: Option<String>,
}

pub async fn register_passkey(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<RegisterPasskeyRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let cred = req.credential_id.trim();
    let name = req.device_name.trim();
    if cred.is_empty() || cred.len() > 256 || name.is_empty() || name.len() > 80 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }
    let transports = req
        .transports
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty() && s.len() <= 64)
        .unwrap_or("internal");

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO user_passkeys(id,user_id,credential_id,device_name,transports) VALUES($1,$2,$3,$4,$5) ON CONFLICT(credential_id) DO NOTHING",
    )
    .bind(id)
    .bind(actor.id)
    .bind(cred)
    .bind(name)
    .bind(transports)
    .execute(&state.pool)
    .await?;

    sqlx::query(
        "INSERT INTO user_security_settings(user_id,mfa_enabled,updated_at) VALUES($1,true,now()) ON CONFLICT(user_id) DO UPDATE SET mfa_enabled=true, updated_at=now()",
    )
    .bind(actor.id)
    .execute(&state.pool)
    .await?;

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "passkey_registered",
        Some("/pengaturan"),
        &telemetry,
        false,
        &format!("Menambahkan Passkey baru: {name}"),
    )
    .await;

    Ok(Json(json!({ "id": id, "device_name": name })))
}

pub async fn delete_passkey(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(passkey_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let res = sqlx::query("DELETE FROM user_passkeys WHERE id=$1 AND user_id=$2")
        .bind(passkey_id)
        .bind(actor.id)
        .execute(&state.pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(ApiError(StatusCode::NOT_FOUND));
    }

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "passkey_revoked",
        Some("/pengaturan"),
        &telemetry,
        false,
        "Menghapus passkey terdaftar",
    )
    .await;

    Ok(Json(json!({ "deleted": true })))
}

pub async fn revoke_my_session(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let res = sqlx::query("DELETE FROM sessions WHERE session_id=$1 AND user_id=$2")
        .bind(session_id)
        .bind(actor.id)
        .execute(&state.pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(ApiError(StatusCode::NOT_FOUND));
    }

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        Some(session_id),
        "session_revoked_self",
        Some("/pengaturan"),
        &telemetry,
        false,
        "Pengguna mencabut salah satu sesi aktifnya",
    )
    .await;

    Ok(Json(json!({ "revoked": true })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PresenceRequest {
    pub path: String,
}

pub async fn update_presence(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<PresenceRequest>,
) -> Result<Json<Value>, ApiError> {
    let _actor = verify_mutation(&state, &jar, &headers).await?;
    let path = req.path.trim();
    if !path.starts_with('/') || path.len() > 160 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }
    let telemetry = extract_telemetry(&headers);
    let token = jar
        .get(state.config.session_cookie())
        .ok_or(ApiError(StatusCode::UNAUTHORIZED))?;
    sqlx::query(
        "UPDATE sessions SET current_path=$1, ip_address=COALESCE($2,ip_address), device_label=COALESCE($3,device_label), location_label=COALESCE($4,location_label), last_seen_at=now() WHERE token_hash=$5",
    )
    .bind(path)
    .bind(&telemetry.ip_address)
    .bind(&telemetry.device_label)
    .bind(&telemetry.location_label)
    .bind(hash(token.value()))
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "ok": true, "path": path })))
}

pub async fn list_notifications(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    let rows: Vec<NotificationRow> = sqlx::query_as(
        "SELECT id, recipient_email, category, subject, body_preview, status, created_at, sent_at, read_at FROM email_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 25",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;
    let unread = rows.iter().filter(|n| n.read_at.is_none()).count();
    Ok(Json(json!({ "items": rows, "unread": unread })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MarkNotificationReadRequest {
    pub id: Option<Uuid>,
}

pub async fn mark_notifications_read(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<MarkNotificationReadRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if let Some(id) = req.id {
        sqlx::query(
            "UPDATE email_notifications SET read_at=now() WHERE id=$1 AND user_id=$2 AND read_at IS NULL",
        )
        .bind(id)
        .bind(actor.id)
        .execute(&state.pool)
        .await?;
    } else {
        sqlx::query(
            "UPDATE email_notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL",
        )
        .bind(actor.id)
        .execute(&state.pool)
        .await?;
    }
    Ok(Json(json!({ "ok": true })))
}

#[derive(Serialize, FromRow)]
struct ExerciseBackupRow {
    exercise_id: String,
    attempts: i32,
    hint_used: bool,
    points: i32,
    completed_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, FromRow)]
struct LabSessionBackupRow {
    id: Uuid,
    lab_id: String,
    level_id: String,
    current_step: String,
    verification_passed: bool,
    score: Option<i32>,
}

pub async fn export_account_backup(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    let settings: Option<(Option<String>, bool, bool, bool, bool, bool)> = sqlx::query_as(
        "SELECT secondary_email, notify_assignments, notify_feedback, notify_security_alerts, mfa_enabled, totp_verified FROM user_security_settings WHERE user_id=$1",
    )
    .bind(actor.id)
    .fetch_optional(&state.pool)
    .await?;
    let (secondary_email, n_assign, n_feed, n_sec, mfa_enabled, totp_verified) =
        settings.unwrap_or((None, true, true, true, false, false));

    let backup_remaining: (i64,) = sqlx::query_as(
        "SELECT count(*) FROM mfa_backup_codes WHERE user_id=$1 AND used_at IS NULL",
    )
    .bind(actor.id)
    .fetch_one(&state.pool)
    .await?;

    let passkeys: Vec<PasskeyRow> = sqlx::query_as(
        "SELECT id, credential_id, device_name, transports, created_at, last_used_at FROM user_passkeys WHERE user_id=$1 ORDER BY created_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let exercises: Vec<ExerciseBackupRow> = sqlx::query_as(
        "SELECT exercise_id, attempts, hint_used, points, completed_at FROM exercise_progress WHERE user_id=$1 ORDER BY exercise_id",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let lab_sessions: Vec<LabSessionBackupRow> = sqlx::query_as(
        "SELECT id, lab_id, level_id, current_step, verification_passed, score FROM lab_sessions WHERE user_id=$1 ORDER BY lab_id, level_id",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let telemetry = extract_telemetry(&headers);
    record_activity(
        &state.pool,
        Some(actor.id),
        Some(&actor.email),
        None,
        "account_backup_exported",
        Some("/pengaturan"),
        &telemetry,
        false,
        "Mengunduh cadangan akun & progres belajar (JSON)",
    )
    .await;

    Ok(Json(json!({
        "schema": "weblabifa.account_backup.v1",
        "exported_at": Utc::now(),
        "account": {
            "id": actor.id,
            "name": actor.name,
            "email": actor.email,
            "role": actor.role,
        },
        "security_metadata": {
            "secondary_email": secondary_email,
            "notify_assignments": n_assign,
            "notify_feedback": n_feed,
            "notify_security_alerts": n_sec,
            "mfa_enabled": mfa_enabled,
            "totp_verified": totp_verified,
            "backup_codes_remaining": backup_remaining.0,
            "backup_hash_algorithm": "Argon2id",
            "passkeys": passkeys,
        },
        "exercise_progress": exercises,
        "simulator_sessions": lab_sessions,
    })))
}
