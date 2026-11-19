mod admin;
mod catalog;
mod instructor;
mod iot_projects;
mod sessions;
mod student;
mod webdev_projects;

pub use admin::*;
pub use catalog::*;
pub use instructor::*;
pub use iot_projects::*;
pub use sessions::*;
pub use student::*;
pub use webdev_projects::*;

use crate::{ApiError, Identity, simulator_catalog::LevelId};
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

pub(super) fn require_role(actor: &Identity, role: &str) -> Result<(), ApiError> {
    if actor.role == role {
        Ok(())
    } else {
        Err(ApiError(StatusCode::FORBIDDEN))
    }
}

/// Pastikan kelas & tugas dasar tersedia pada lingkungan demo/lokal tanpa menimpa perubahan operator.
pub(super) async fn ensure_default_assignments(
    pool: &PgPool,
    actor_id: Uuid,
    actor_role: &str,
) -> Result<(), ApiError> {
    let count: (i64,) = sqlx::query_as("SELECT count(*) FROM assignments")
        .fetch_one(pool)
        .await?;
    if count.0 == 0 {
        let samples = [
            ("Tugas 1 · Audit IDOR Pesanan", "a01-idor", "medium", 7),
            (
                "Tugas 2 · SQL Injection & Parameterized Query",
                "a05-sqli",
                "medium",
                14,
            ),
            (
                "Tugas 3 · Stored XSS & Output Encoding",
                "a05-xss",
                "easy",
                21,
            ),
            (
                "Tugas 4 · ESP32-C3: Kontrol GPIO, LED & Resistor",
                "iot-esp32-gpio",
                "easy",
                28,
            ),
        ];
        for (title, lab_id, lvl, days) in samples {
            sqlx::query("INSERT INTO assignments(id,class_id,title,lab_id,required_level,due_at,pass_threshold,allow_hints) VALUES($1,'IF-3A',$2,$3,$4,now()+($5 || ' days')::interval,80,true) ON CONFLICT DO NOTHING")
                .bind(Uuid::new_v4())
                .bind(title)
                .bind(lab_id)
                .bind(lvl)
                .bind(days.to_string())
                .execute(pool)
                .await?;
        }
    }
    let memberships: (i64,) =
        sqlx::query_as("SELECT count(*) FROM class_memberships WHERE user_id=$1")
            .bind(actor_id)
            .fetch_one(pool)
            .await?;
    if memberships.0 == 0 && (actor_role == "mahasiswa" || actor_role == "dosen") {
        let role_in_class = if actor_role == "dosen" {
            "dosen"
        } else {
            "mahasiswa"
        };
        sqlx::query("INSERT INTO class_memberships(class_id,user_id,role_in_class) VALUES('IF-3A',$1,$2) ON CONFLICT DO NOTHING")
            .bind(actor_id)
            .bind(role_in_class)
            .execute(pool)
            .await?;
        if actor_role == "dosen" {
            for cid in ["IF-3B", "IF-4A"] {
                sqlx::query("INSERT INTO class_memberships(class_id,user_id,role_in_class) VALUES($1,$2,'dosen') ON CONFLICT DO NOTHING")
                    .bind(cid)
                    .bind(actor_id)
                    .execute(pool)
                    .await?;
            }
        }
    }
    Ok(())
}

pub(super) async fn verify_lecturer_class(
    pool: &PgPool,
    user_id: Uuid,
    class_id: &str,
) -> Result<(), ApiError> {
    let ok: Option<(String,)> = sqlx::query_as(
        "SELECT class_id FROM class_memberships WHERE user_id=$1 AND class_id=$2 AND role_in_class='dosen'",
    )
    .bind(user_id)
    .bind(class_id)
    .fetch_optional(pool)
    .await?;
    if ok.is_some() {
        Ok(())
    } else {
        Err(ApiError(StatusCode::FORBIDDEN))
    }
}

pub fn sanitize_csv_cell(input: &str) -> String {
    let clean = input.replace(['\r', '\n'], " ");
    let prefixed = if clean.starts_with(['=', '+', '-', '@', '\t']) {
        format!("'{clean}")
    } else {
        clean
    };
    let escaped = prefixed.replace('"', "\"\"");
    format!("\"{escaped}\"")
}

pub(super) fn track_display_label(track: &str) -> &'static str {
    if track == "iot" {
        "IoT"
    } else {
        "Cyber Security"
    }
}

pub(super) fn sanitize_attachment_url(raw: &str) -> Result<Option<String>, ()> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.len() > 500 || trimmed.chars().any(|c| c.is_control()) {
        return Err(());
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("https://") || lower.starts_with("http://") {
        Ok(Some(trimmed.to_string()))
    } else {
        Err(())
    }
}

pub(super) fn is_assignment_locked_by_deadline(
    due_at: DateTime<Utc>,
    now: DateTime<Utc>,
    allow_late: bool,
    strict_deadline_lock: bool,
) -> bool {
    strict_deadline_lock && !allow_late && now > due_at
}

// ---------------------------------------------------------------------------
// Katalog & Detail Lab (Mahasiswa / Dosen)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct CatalogQuery {
    pub q: Option<String>,
    pub track: Option<String>,
    pub category: Option<String>,
}

#[derive(FromRow)]
pub(super) struct ModuleRow {
    pub(super) lab_id: String,
    status: String,
    pub(super) version: String,
}

#[derive(FromRow)]
pub(super) struct SessionSummaryRow {
    pub(super) id: Uuid,
    pub(super) lab_id: String,
    pub(super) level_id: String,
    pub(super) current_step: String,
    pub(super) score: Option<i32>,
    pub(super) passed: bool,
    pub(super) updated_at: DateTime<Utc>,
}

pub(super) fn previous_level(level: LevelId) -> Option<LevelId> {
    match level {
        LevelId::Easy => None,
        LevelId::Medium => Some(LevelId::Easy),
        LevelId::Hard => Some(LevelId::Medium),
        LevelId::Impossible => Some(LevelId::Hard),
    }
}

pub(super) fn level_unlock_status(
    role: &str,
    lab_id: &str,
    level: LevelId,
    sessions: &[SessionSummaryRow],
) -> (bool, Option<String>) {
    if role == "dosen" || role == "admin" {
        return (true, None);
    }
    match previous_level(level) {
        None => (true, None),
        Some(prev) => {
            let prev_passed = sessions
                .iter()
                .any(|s| s.lab_id == lab_id && s.level_id == prev.as_str() && s.passed);
            if prev_passed {
                (true, None)
            } else {
                (
                    false,
                    Some(format!(
                        "Selesaikan level {} terlebih dahulu untuk membuka level {}.",
                        prev.label(),
                        level.label()
                    )),
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_cells_block_formula_injection_and_quote_safely() {
        assert_eq!(sanitize_csv_cell("=CMD()"), "\"'=CMD()\"");
        assert_eq!(sanitize_csv_cell("+1+1"), "\"'+1+1\"");
        assert_eq!(sanitize_csv_cell("@SUM(A1)"), "\"'@SUM(A1)\"");
        assert_eq!(sanitize_csv_cell("-2+3"), "\"'-2+3\"");
        assert_eq!(
            sanitize_csv_cell("hello, \"world\""),
            "\"hello, \"\"world\"\"\""
        );
        assert_eq!(sanitize_csv_cell("Rani"), "\"Rani\"");
    }

    #[test]
    fn lecturer_unlocks_all_levels_while_student_unlocks_progressively() {
        let now = Utc::now();
        let no_sessions: Vec<SessionSummaryRow> = vec![];
        for lv in LevelId::all() {
            assert!(level_unlock_status("dosen", "a05-sqli", lv, &no_sessions).0);
            assert!(level_unlock_status("admin", "a05-sqli", lv, &no_sessions).0);
        }

        assert!(level_unlock_status("mahasiswa", "a05-sqli", LevelId::Easy, &no_sessions).0);
        assert!(!level_unlock_status("mahasiswa", "a05-sqli", LevelId::Medium, &no_sessions).0);
        assert!(!level_unlock_status("mahasiswa", "a05-sqli", LevelId::Hard, &no_sessions).0);
        assert!(!level_unlock_status("mahasiswa", "a05-sqli", LevelId::Impossible, &no_sessions).0);

        let easy_passed = vec![SessionSummaryRow {
            id: Uuid::new_v4(),
            lab_id: "a05-sqli".into(),
            level_id: "easy".into(),
            current_step: "refleksi".into(),
            score: Some(95),
            passed: true,
            updated_at: now,
        }];
        assert!(level_unlock_status("mahasiswa", "a05-sqli", LevelId::Medium, &easy_passed).0);
        assert!(!level_unlock_status("mahasiswa", "a05-sqli", LevelId::Hard, &easy_passed).0);
        assert!(!level_unlock_status("mahasiswa", "a01-idor", LevelId::Medium, &easy_passed).0);
    }

    #[test]
    fn sanitizes_assignment_urls_and_enforces_deadline_lock() {
        assert_eq!(sanitize_attachment_url("").unwrap(), None);
        assert_eq!(
            sanitize_attachment_url("  https://owasp.org/Top10/  ").unwrap(),
            Some("https://owasp.org/Top10/".to_string())
        );
        assert!(sanitize_attachment_url("javascript:alert(1)").is_err());
        assert!(sanitize_attachment_url("data:text/html,<script>1</script>").is_err());

        assert_eq!(track_display_label("web"), "Cyber Security");
        assert_eq!(track_display_label("iot"), "IoT");

        let now = Utc::now();
        let past = now - chrono::Duration::hours(2);
        let future = now + chrono::Duration::hours(2);
        assert!(is_assignment_locked_by_deadline(past, now, false, true));
        assert!(!is_assignment_locked_by_deadline(past, now, true, true));
        assert!(!is_assignment_locked_by_deadline(past, now, false, false));
        assert!(!is_assignment_locked_by_deadline(future, now, false, true));
    }
}
