use super::*;
use crate::{ApiError, AppState, config::student_nim, identity, verify_mutation};
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
use uuid::Uuid;

use instructor::ClassRow;

const MAX_IMPORT_ROWS: usize = 500;

fn require_admin_or_lecturer(actor: &Identity) -> Result<(), ApiError> {
    if actor.role == "admin" || actor.role == "dosen" {
        Ok(())
    } else {
        Err(ApiError(StatusCode::FORBIDDEN))
    }
}

pub(crate) fn normalize_email(raw: &str) -> Option<String> {
    let email = raw.trim().to_ascii_lowercase();
    if email.is_empty() || email.len() > 320 {
        return None;
    }
    let (local, domain) = email.split_once('@')?;
    if local.is_empty()
        || domain.is_empty()
        || !domain.contains('.')
        || domain.starts_with('.')
        || domain.ends_with('.')
        || email.chars().any(|c| {
            c.is_control()
                || c.is_whitespace()
                || matches!(c, '?' | '#' | '&' | ',' | ';' | '<' | '>' | '"' | '\'')
        })
    {
        return None;
    }
    Some(email)
}

fn sanitize_label(raw: &str, max_len: usize) -> String {
    raw.trim()
        .chars()
        .filter(|c| !c.is_control())
        .take(max_len)
        .collect()
}

#[derive(FromRow)]
struct AccessRequestRow {
    id: Uuid,
    email: String,
    name: String,
    workspace_domain: Option<String>,
    requested_role: String,
    status: String,
    note: String,
    reviewed_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct ApprovedAccountRow {
    email: String,
    full_name: String,
    nim: Option<String>,
    role: String,
    class_id: Option<String>,
    source: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

pub async fn list_access_approvals(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_admin_or_lecturer(&actor)?;

    let requests: Vec<AccessRequestRow> = sqlx::query_as(
        "SELECT id,email,name,workspace_domain,requested_role,status,note,reviewed_at,created_at,updated_at \
         FROM access_requests \
         ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, updated_at DESC \
         LIMIT 200",
    )
    .fetch_all(&state.pool)
    .await?;

    let approved: Vec<ApprovedAccountRow> = sqlx::query_as(
        "SELECT email,full_name,nim,role,class_id,source,created_at,updated_at \
         FROM approved_accounts \
         ORDER BY updated_at DESC \
         LIMIT 500",
    )
    .fetch_all(&state.pool)
    .await?;

    let classes: Vec<ClassRow> = if actor.role == "admin" {
        sqlx::query_as(
            "SELECT id,name,course,semester,timezone,leaderboard_enabled,active FROM classes WHERE active=true ORDER BY id",
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        let owned: Vec<ClassRow> = sqlx::query_as(
            "SELECT c.id,c.name,c.course,c.semester,c.timezone,c.leaderboard_enabled,c.active \
             FROM classes c \
             JOIN class_memberships m ON m.class_id = c.id \
             WHERE m.user_id=$1 AND m.role_in_class='dosen' AND c.active=true \
             ORDER BY c.id",
        )
        .bind(actor.id)
        .fetch_all(&state.pool)
        .await?;
        if owned.is_empty() {
            sqlx::query_as(
                "SELECT id,name,course,semester,timezone,leaderboard_enabled,active FROM classes WHERE active=true ORDER BY id",
            )
            .fetch_all(&state.pool)
            .await?
        } else {
            owned
        }
    };

    let pending_count = requests.iter().filter(|r| r.status == "pending").count();

    Ok(Json(json!({
        "pending_count": pending_count,
        "can_approve_dosen": actor.role == "admin",
        "classes": classes.iter().map(|c| json!({
            "id": c.id,
            "name": c.name,
            "course": c.course,
            "semester": c.semester,
        })).collect::<Vec<_>>(),
        "requests": requests.iter().map(|r| json!({
            "id": r.id,
            "email": r.email,
            "name": r.name,
            "workspace_domain": r.workspace_domain,
            "requested_role": r.requested_role,
            "status": r.status,
            "note": r.note,
            "reviewed_at": r.reviewed_at,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })).collect::<Vec<_>>(),
        "approved_accounts": approved.iter().map(|a| json!({
            "email": a.email,
            "full_name": a.full_name,
            "nim": a.nim,
            "role": a.role,
            "class_id": a.class_id,
            "source": a.source,
            "created_at": a.created_at,
            "updated_at": a.updated_at,
        })).collect::<Vec<_>>(),
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DecideAccessRequest {
    pub action: String,
    pub role: Option<String>,
    pub class_id: Option<String>,
    pub note: Option<String>,
}

pub async fn decide_access_request(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(request_id): Path<Uuid>,
    Json(req): Json<DecideAccessRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_admin_or_lecturer(&actor)?;

    let action = req.action.trim().to_ascii_lowercase();
    if action != "approve" && action != "reject" {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let note = req
        .note
        .as_deref()
        .map(|s| sanitize_label(s, 200))
        .unwrap_or_default();

    let mut tx = state.pool.begin().await?;
    let existing: Option<(String, String, String)> =
        sqlx::query_as("SELECT email, name, requested_role FROM access_requests WHERE id=$1")
            .bind(request_id)
            .fetch_optional(&mut *tx)
            .await?;
    let (email, name, requested_role) = existing.ok_or(ApiError(StatusCode::NOT_FOUND))?;

    if action == "approve" {
        let target_role = req
            .role
            .as_deref()
            .map(|r| r.trim().to_ascii_lowercase())
            .unwrap_or(requested_role);
        if target_role != "mahasiswa" && target_role != "dosen" {
            return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
        }
        if target_role == "dosen" && actor.role != "admin" {
            return Err(ApiError(StatusCode::FORBIDDEN));
        }

        let class_id = match req
            .class_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            Some(cid) => {
                let exists: Option<(String,)> =
                    sqlx::query_as("SELECT id FROM classes WHERE id=$1 AND active=true")
                        .bind(cid)
                        .fetch_optional(&mut *tx)
                        .await?;
                if exists.is_none() {
                    return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
                }
                if actor.role == "dosen" {
                    let has_any_class: (i64,) = sqlx::query_as(
                        "SELECT count(*) FROM class_memberships WHERE user_id=$1 AND role_in_class='dosen'",
                    )
                    .bind(actor.id)
                    .fetch_one(&mut *tx)
                    .await?;
                    if has_any_class.0 > 0 {
                        verify_lecturer_class(&state.pool, actor.id, cid).await?;
                    }
                }
                Some(cid.to_string())
            }
            None => None,
        };

        let nim = student_nim(&email).map(str::to_string);
        sqlx::query(
            "INSERT INTO approved_accounts (email, full_name, nim, role, class_id, source, approved_by, updated_at) \
             VALUES ($1, $2, $3, $4, $5, 'approval', $6, now()) \
             ON CONFLICT (email) DO UPDATE SET \
               full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE approved_accounts.full_name END, \
               nim = COALESCE(EXCLUDED.nim, approved_accounts.nim), \
               role = EXCLUDED.role, \
               class_id = COALESCE(EXCLUDED.class_id, approved_accounts.class_id), \
               source = 'approval', \
               approved_by = EXCLUDED.approved_by, \
               updated_at = now()",
        )
        .bind(&email)
        .bind(&name)
        .bind(&nim)
        .bind(&target_role)
        .bind(&class_id)
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE access_requests SET status='approved', note=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now() WHERE id=$1",
        )
        .bind(request_id)
        .bind(&note)
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;

        if let Some((uid,)) =
            sqlx::query_as::<_, (Uuid,)>("SELECT id FROM users WHERE lower(email)=$1 LIMIT 1")
                .bind(&email)
                .fetch_optional(&mut *tx)
                .await?
        {
            sqlx::query("UPDATE users SET active=true WHERE id=$1")
                .bind(uid)
                .execute(&mut *tx)
                .await?;
            sqlx::query(
                "INSERT INTO user_roles(user_id, role) VALUES($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(uid)
            .bind(&target_role)
            .execute(&mut *tx)
            .await?;
            if let Some(ref cid) = class_id {
                let role_in_class = if target_role == "dosen" {
                    "dosen"
                } else {
                    "mahasiswa"
                };
                sqlx::query(
                    "INSERT INTO class_memberships(class_id, user_id, role_in_class) VALUES($1, $2, $3) ON CONFLICT DO NOTHING",
                )
                .bind(cid)
                .bind(uid)
                .bind(role_in_class)
                .execute(&mut *tx)
                .await?;
            }
        }

        sqlx::query(
            "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Akses',$3,$4,'Berhasil')",
        )
        .bind(Uuid::new_v4())
        .bind(actor.id)
        .bind(format!("Setujui akses login ({target_role})"))
        .bind(&email)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(Json(json!({
            "id": request_id,
            "email": email,
            "status": "approved",
            "role": target_role,
            "class_id": class_id,
        })))
    } else {
        sqlx::query(
            "UPDATE access_requests SET status='rejected', note=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now() WHERE id=$1",
        )
        .bind(request_id)
        .bind(&note)
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM approved_accounts WHERE email=$1")
            .bind(&email)
            .execute(&mut *tx)
            .await?;

        if !state.config.email_allowed(&email)
            && let Some((uid,)) =
                sqlx::query_as::<_, (Uuid,)>("SELECT id FROM users WHERE lower(email)=$1 LIMIT 1")
                    .bind(&email)
                    .fetch_optional(&mut *tx)
                    .await?
        {
            sqlx::query("DELETE FROM sessions WHERE user_id=$1")
                .bind(uid)
                .execute(&mut *tx)
                .await?;
            sqlx::query("UPDATE users SET active=false WHERE id=$1")
                .bind(uid)
                .execute(&mut *tx)
                .await?;
        }

        sqlx::query(
            "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Akses','Tolak permintaan akses login',$3,'Ditolak')",
        )
        .bind(Uuid::new_v4())
        .bind(actor.id)
        .bind(&email)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        Ok(Json(json!({
            "id": request_id,
            "email": email,
            "status": "rejected",
        })))
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StudentImportRow {
    pub email: String,
    pub name: Option<String>,
    pub nim: Option<String>,
    pub class_id: Option<String>,
    pub role: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportStudentsRequest {
    pub default_class_id: Option<String>,
    pub source: Option<String>,
    pub rows: Vec<StudentImportRow>,
}

pub async fn import_approved_students(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<ImportStudentsRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_admin_or_lecturer(&actor)?;

    if req.rows.is_empty() || req.rows.len() > MAX_IMPORT_ROWS {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let source = match req.source.as_deref() {
        Some("manual") => "manual",
        _ => "excel_import",
    };

    let valid_classes: Vec<String> = if actor.role == "admin" {
        sqlx::query_scalar("SELECT id FROM classes WHERE active=true")
            .fetch_all(&state.pool)
            .await?
    } else {
        let owned: Vec<String> = sqlx::query_scalar(
            "SELECT c.id FROM classes c JOIN class_memberships m ON m.class_id=c.id WHERE m.user_id=$1 AND m.role_in_class='dosen' AND c.active=true",
        )
        .bind(actor.id)
        .fetch_all(&state.pool)
        .await?;
        if owned.is_empty() {
            sqlx::query_scalar("SELECT id FROM classes WHERE active=true")
                .fetch_all(&state.pool)
                .await?
        } else {
            owned
        }
    };

    let default_class_id = req
        .default_class_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_uppercase);
    if let Some(ref cid) = default_class_id
        && !valid_classes.iter().any(|c| c == cid)
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let mut tx = state.pool.begin().await?;
    let mut imported = 0usize;
    let mut updated = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for (idx, row) in req.rows.into_iter().take(MAX_IMPORT_ROWS).enumerate() {
        let row_num = idx + 1;
        let Some(email) = normalize_email(&row.email) else {
            skipped += 1;
            if errors.len() < 20 {
                errors.push(format!("Baris {row_num}: format email tidak valid."));
            }
            continue;
        };

        let target_role = row
            .role
            .as_deref()
            .map(|r| r.trim().to_ascii_lowercase())
            .filter(|r| !r.is_empty())
            .unwrap_or_else(|| "mahasiswa".to_string());
        if target_role != "mahasiswa" && target_role != "dosen" {
            skipped += 1;
            if errors.len() < 20 {
                errors.push(format!("Baris {row_num} ({email}): peran tidak valid."));
            }
            continue;
        }
        if target_role == "dosen" && actor.role != "admin" {
            skipped += 1;
            if errors.len() < 20 {
                errors.push(format!(
                    "Baris {row_num} ({email}): hanya Admin yang dapat menyetujui peran dosen."
                ));
            }
            continue;
        }

        let row_class = row
            .class_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_uppercase)
            .or_else(|| default_class_id.clone());
        let resolved_class = match row_class {
            Some(ref cid) if valid_classes.iter().any(|c| c == cid) => Some(cid.clone()),
            Some(ref cid) => {
                skipped += 1;
                if errors.len() < 20 {
                    errors.push(format!(
                        "Baris {row_num} ({email}): kelas '{cid}' tidak ditemukan atau di luar akses Anda."
                    ));
                }
                continue;
            }
            None => None,
        };

        let full_name = row
            .name
            .as_deref()
            .map(|n| sanitize_label(n, 160))
            .unwrap_or_default();
        let nim = row
            .nim
            .as_deref()
            .map(|n| sanitize_label(n, 32))
            .filter(|n| !n.is_empty())
            .or_else(|| student_nim(&email).map(str::to_string));

        let existed: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM approved_accounts WHERE email=$1)")
                .bind(&email)
                .fetch_one(&mut *tx)
                .await?;

        sqlx::query(
            "INSERT INTO approved_accounts (email, full_name, nim, role, class_id, source, approved_by, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, now()) \
             ON CONFLICT (email) DO UPDATE SET \
               full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE approved_accounts.full_name END, \
               nim = COALESCE(EXCLUDED.nim, approved_accounts.nim), \
               role = EXCLUDED.role, \
               class_id = COALESCE(EXCLUDED.class_id, approved_accounts.class_id), \
               source = EXCLUDED.source, \
               approved_by = EXCLUDED.approved_by, \
               updated_at = now()",
        )
        .bind(&email)
        .bind(&full_name)
        .bind(&nim)
        .bind(&target_role)
        .bind(&resolved_class)
        .bind(source)
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "UPDATE access_requests SET status='approved', reviewed_by=$2, reviewed_at=now(), updated_at=now() \
             WHERE email=$1 AND status <> 'approved'",
        )
        .bind(&email)
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;

        if let Some((uid,)) =
            sqlx::query_as::<_, (Uuid,)>("SELECT id FROM users WHERE lower(email)=$1 LIMIT 1")
                .bind(&email)
                .fetch_optional(&mut *tx)
                .await?
        {
            sqlx::query("UPDATE users SET active=true WHERE id=$1")
                .bind(uid)
                .execute(&mut *tx)
                .await?;
            sqlx::query(
                "INSERT INTO user_roles(user_id, role) VALUES($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(uid)
            .bind(&target_role)
            .execute(&mut *tx)
            .await?;
            if let Some(ref cid) = resolved_class {
                let role_in_class = if target_role == "dosen" {
                    "dosen"
                } else {
                    "mahasiswa"
                };
                sqlx::query(
                    "INSERT INTO class_memberships(class_id, user_id, role_in_class) VALUES($1, $2, $3) ON CONFLICT DO NOTHING",
                )
                .bind(cid)
                .bind(uid)
                .bind(role_in_class)
                .execute(&mut *tx)
                .await?;
            }
        }

        if existed {
            updated += 1;
        } else {
            imported += 1;
        }
    }

    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Akses',$3,$4,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(format!("Impor daftar akun disetujui ({source})"))
    .bind(format!("{imported} baru, {updated} diperbarui, {skipped} dilewati"))
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": errors,
    })))
}

pub async fn revoke_approved_account(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(raw_email): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_admin_or_lecturer(&actor)?;

    let Some(email) = normalize_email(&raw_email) else {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    };
    if state.config.email_allowed(&email) {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    let mut tx = state.pool.begin().await?;
    let row: Option<(String,)> =
        sqlx::query_as("SELECT role FROM approved_accounts WHERE email=$1")
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await?;
    let (role,) = row.ok_or(ApiError(StatusCode::NOT_FOUND))?;
    if role == "dosen" && actor.role != "admin" {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    sqlx::query("DELETE FROM approved_accounts WHERE email=$1")
        .bind(&email)
        .execute(&mut *tx)
        .await?;

    if let Some((uid,)) =
        sqlx::query_as::<_, (Uuid,)>("SELECT id FROM users WHERE lower(email)=$1 LIMIT 1")
            .bind(&email)
            .fetch_optional(&mut *tx)
            .await?
    {
        sqlx::query("DELETE FROM sessions WHERE user_id=$1")
            .bind(uid)
            .execute(&mut *tx)
            .await?;
        sqlx::query("UPDATE users SET active=false WHERE id=$1")
            .bind(uid)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Akses','Cabut persetujuan login akun',$3,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&email)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(json!({ "revoked": true, "email": email })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_and_validates_import_emails() {
        assert_eq!(
            normalize_email("  123140051@Student.ITERA.ac.id "),
            Some("123140051@student.itera.ac.id".to_string())
        );
        assert_eq!(
            normalize_email("dosen@if.itera.ac.id"),
            Some("dosen@if.itera.ac.id".to_string())
        );
        assert!(normalize_email("not-an-email").is_none());
        assert!(normalize_email("a b@student.itera.ac.id").is_none());
        assert!(normalize_email("user@.itera.ac.id").is_none());
        assert!(normalize_email("user@domain").is_none());
        assert!(normalize_email("<script>@student.itera.ac.id").is_none());
    }
}
