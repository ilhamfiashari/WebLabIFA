use super::load_user_access_rights;
use crate::{ApiError, AppState, identity, verify_mutation};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct WebDevFileEntry {
    pub name: String,
    pub content: String,
}

#[derive(FromRow)]
struct WebDevProjectRow {
    id: Uuid,
    title: String,
    mission_id: Option<String>,
    files_json: Value,
    updated_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct StudentWebDevProjectRow {
    id: Uuid,
    title: String,
    mission_id: Option<String>,
    files_json: Value,
    updated_at: DateTime<Utc>,
    owner_id: Uuid,
    owner_name: String,
    owner_email: String,
    class_id: String,
}

#[derive(FromRow)]
struct CompletedWebDevMissionRow {
    mission_id: String,
    score: i32,
    completed_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct StudentWebDevProjectsQuery {
    pub class_id: Option<String>,
    pub q: Option<String>,
}

#[derive(Deserialize)]
pub struct SaveWebDevProjectReq {
    pub id: Option<Uuid>,
    pub title: String,
    pub mission_id: Option<String>,
    #[serde(default)]
    pub files: Vec<WebDevFileEntry>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SubmitWebDevMissionReq {
    pub mission_id: String,
    #[serde(default)]
    pub files: Vec<WebDevFileEntry>,
    pub checks_passed: usize,
    pub checks_total: usize,
    #[serde(default)]
    pub render_ready: bool,
    #[serde(default)]
    pub api_tested: bool,
    #[serde(default)]
    pub sql_executed: bool,
}

#[derive(Clone, Copy)]
struct WebDevMissionRule {
    id: &'static str,
    title: &'static str,
    xp: i32,
    required_xp: i32,
    prerequisite_id: Option<&'static str>,
    required_tokens: &'static [&'static str],
    requires_api_test: bool,
    requires_sql: bool,
}

const WEBDEV_MISSION_RULES: &[WebDevMissionRule] = &[
    WebDevMissionRule {
        id: "webdev-p01-http",
        title: "P1 · Cara Kerja Web & HTTP",
        xp: 50,
        required_xp: 0,
        prerequisite_id: None,
        required_tokens: &["<header", "<button", "http"],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p02-html",
        title: "P2 · Mengenal HTML5 Semantik",
        xp: 50,
        required_xp: 50,
        prerequisite_id: Some("webdev-p01-http"),
        required_tokens: &["<nav", "<main", "<article", "<footer"],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p03-css",
        title: "P3 · Mengenal CSS Flexbox & Tema",
        xp: 60,
        required_xp: 100,
        prerequisite_id: Some("webdev-p02-html"),
        required_tokens: &["display", "flex", "padding", "border-radius"],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p04-form-media",
        title: "P4 · Tabel, Formulir, Layout & Media",
        xp: 60,
        required_xp: 160,
        prerequisite_id: Some("webdev-p03-css"),
        required_tokens: &["<table", "<form", "<input", "grid"],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p05-js-dom",
        title: "P5 · Pemrograman JavaScript & DOM",
        xp: 70,
        required_xp: 220,
        prerequisite_id: Some("webdev-p04-form-media"),
        required_tokens: &["addeventlistener", "getelementbyid", "console.log"],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p06-js-es6",
        title: "P6 · JavaScript Generasi Baru (ES6+)",
        xp: 70,
        required_xp: 290,
        prerequisite_id: Some("webdev-p05-js-dom"),
        required_tokens: &["const ", "=>", ".map(", "`"],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p07-react",
        title: "P7 · Kerangka Kerja React JS & State",
        xp: 80,
        required_xp: 360,
        prerequisite_id: Some("webdev-p06-js-es6"),
        required_tokens: &["usestate", "function app", "onclick"],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p08-uts",
        title: "P8 · Evaluasi UTS Frontend Terpadu",
        xp: 90,
        required_xp: 440,
        prerequisite_id: Some("webdev-p07-react"),
        required_tokens: &["<main", "display", "usestate", "map("],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p09-python",
        title: "P9 · Dasar Pemrograman Python",
        xp: 70,
        required_xp: 530,
        prerequisite_id: Some("webdev-p08-uts"),
        required_tokens: &["def ", "for ", "print("],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p10-oop-py",
        title: "P10 · OOP di Python",
        xp: 70,
        required_xp: 600,
        prerequisite_id: Some("webdev-p09-python"),
        required_tokens: &["class ", "__init__", "self."],
        requires_api_test: false,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p11-fastapi",
        title: "P11 · Kerangka Kerja FastAPI",
        xp: 80,
        required_xp: 670,
        prerequisite_id: Some("webdev-p10-oop-py"),
        required_tokens: &["fastapi", "@app.get", "@app.post"],
        requires_api_test: true,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p12-postgres",
        title: "P12 · Basis Data PostgreSQL",
        xp: 80,
        required_xp: 750,
        prerequisite_id: Some("webdev-p11-fastapi"),
        required_tokens: &["create table", "insert into", "select "],
        requires_api_test: false,
        requires_sql: true,
    },
    WebDevMissionRule {
        id: "webdev-p13-ai-web",
        title: "P13 · AI pada Aplikasi Web",
        xp: 90,
        required_xp: 830,
        prerequisite_id: Some("webdev-p12-postgres"),
        required_tokens: &["@app.post", "/api/ai", "fetch("],
        requires_api_test: true,
        requires_sql: false,
    },
    WebDevMissionRule {
        id: "webdev-p14-fullstack",
        title: "P14-P16 · Proyek Full-Stack & Demo",
        xp: 120,
        required_xp: 920,
        prerequisite_id: Some("webdev-p13-ai-web"),
        required_tokens: &["<main", "@app.get", "@app.post", "select ", "fetch("],
        requires_api_test: true,
        requires_sql: true,
    },
];

pub struct WebDevBadgeSpec {
    pub id: &'static str,
    pub key: &'static str,
    pub title: &'static str,
    pub detail: &'static str,
    pub xp: i32,
}

pub const WEBDEV_BADGE_SPECS: &[WebDevBadgeSpec] = &[
    WebDevBadgeSpec {
        id: "webdev-perintis",
        key: "badge:webdev-perintis",
        title: "Perintis Aplikasi Web",
        detail: "Menyelesaikan misi perdana Web Development Virtual Lab.",
        xp: 50,
    },
    WebDevBadgeSpec {
        id: "webdev-frontend",
        key: "badge:webdev-frontend",
        title: "Arsitek Frontend UI",
        detail: "Menguasai HTML5, CSS Flexbox/Grid, DOM JS, dan komponen React (P1-P8).",
        xp: 60,
    },
    WebDevBadgeSpec {
        id: "webdev-backend",
        key: "badge:webdev-backend",
        title: "Backend FastAPI & PostgreSQL",
        detail: "Membangun layanan Python OOP, REST FastAPI, dan skema PostgreSQL (P9-P12).",
        xp: 80,
    },
    WebDevBadgeSpec {
        id: "webdev-fullstack",
        key: "badge:webdev-fullstack",
        title: "Master Full-Stack Web App",
        detail: "Menuntaskan proyek integrasi AI, Client-Server, dan presentasi akhir Web (P13-P16).",
        xp: 120,
    },
];

fn find_mission_rule(id: &str) -> Option<&'static WebDevMissionRule> {
    WEBDEV_MISSION_RULES.iter().find(|r| r.id == id)
}

pub fn normalize_and_validate_webdev_files(
    raw: &[WebDevFileEntry],
) -> Result<Vec<WebDevFileEntry>, &'static str> {
    if raw.is_empty() {
        return Err("Minimal harus terdapat 1 file kode pada proyek Web.");
    }
    if raw.len() > 16 {
        return Err("Maksimal 16 file proyek diperbolehkan.");
    }
    let mut seen = HashSet::new();
    let mut cleaned = Vec::with_capacity(raw.len());
    let mut total_bytes = 0usize;

    for f in raw {
        let name = f.name.trim().replace(['/', '\\'], "");
        if name.is_empty() || name.len() > 64 || name.starts_with('.') {
            return Err("Nama file tidak valid.");
        }
        let valid_chars = name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
        if !valid_chars {
            return Err("Nama file hanya boleh huruf, angka, titik, garis bawah, atau hubung.");
        }
        let lower = name.to_ascii_lowercase();
        let allowed_ext = [
            ".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".py", ".sql", ".json", ".txt", ".http",
        ]
        .iter()
        .any(|ext| lower.ends_with(ext));
        if !allowed_ext {
            return Err(
                "Ekstensi file harus .html, .css, .js, .jsx, .ts, .py, .sql, .json, .http, atau .txt.",
            );
        }
        if f.content.len() > 32_768 {
            return Err("Ukuran satu file melebihi batas 32KB.");
        }
        total_bytes = total_bytes.saturating_add(f.content.len());
        if total_bytes > 262_144 {
            return Err("Total ukuran proyek Web melebihi batas 256KB.");
        }
        if !seen.insert(lower) {
            return Err("Terdapat nama file duplikat dalam proyek.");
        }
        cleaned.push(WebDevFileEntry {
            name,
            content: f.content.clone(),
        });
    }
    Ok(cleaned)
}

fn evaluate_mission_access(
    role: &str,
    mission_id: &str,
    completed: &HashSet<String>,
    student_xp: i32,
    can_access_studio: bool,
) -> (bool, Option<String>) {
    if role == "dosen" {
        return (true, None);
    }
    if !can_access_studio {
        return (
            false,
            Some(
                "Hak akses Web Dev Virtual Lab sedang dikunci oleh Admin untuk akun Anda."
                    .to_string(),
            ),
        );
    }
    let Some(rule) = find_mission_rule(mission_id) else {
        return (false, Some("Misi tidak ditemukan.".to_string()));
    };
    if let Some(prev_id) = rule.prerequisite_id
        && !completed.contains(prev_id)
        && let Some(prev_rule) = find_mission_rule(prev_id)
    {
        return (
            false,
            Some(format!(
                "Selesaikan terlebih dahulu \"{}\" untuk membuka misi ini.",
                prev_rule.title
            )),
        );
    }
    if student_xp < rule.required_xp {
        return (
            false,
            Some(format!(
                "Butuh minimal {} XP Experience (saat ini {} XP) untuk membuka misi ini.",
                rule.required_xp, student_xp
            )),
        );
    }
    (true, None)
}

fn verify_mission_payload(
    rule: &WebDevMissionRule,
    req: &SubmitWebDevMissionReq,
    files: &[WebDevFileEntry],
) -> Result<String, &'static str> {
    if !req.render_ready {
        return Err("Jalankan preview aplikasi Web terlebih dahulu sebelum mengumpulkan.");
    }
    if req.checks_total == 0 || req.checks_passed < req.checks_total {
        return Err("Seluruh checklist evaluasi misi harus lulus terlebih dahulu.");
    }
    if rule.requires_api_test && !req.api_tested {
        return Err("Uji endpoint REST API / FastAPI di panel preview kanan terlebih dahulu.");
    }
    if rule.requires_sql && !req.sql_executed {
        return Err("Eksekusi skema & query PostgreSQL pada tab Database terlebih dahulu.");
    }

    let combined = files
        .iter()
        .map(|f| format!("// FILE:{}\n{}", f.name, f.content))
        .collect::<Vec<_>>()
        .join("\n");
    if combined.trim().len() < 16 {
        return Err("Kode proyek terlalu singkat untuk memenuhi target misi.");
    }
    let lower_all = combined.to_ascii_lowercase();
    for tok in rule.required_tokens {
        if !lower_all.contains(&tok.to_ascii_lowercase()) {
            return Err("Kode belum mengimplementasikan konstruksi wajib pada misi ini.");
        }
    }
    Ok(combined)
}

async fn load_webdev_progress(
    pool: &sqlx::PgPool,
    user_id: Uuid,
) -> Result<(Vec<CompletedWebDevMissionRow>, HashSet<String>, i32), ApiError> {
    let completions: Vec<CompletedWebDevMissionRow> = sqlx::query_as(
        "SELECT mission_id, score, completed_at FROM webdev_mission_completions WHERE user_id = $1 ORDER BY completed_at ASC",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let completed_set: HashSet<String> = completions.iter().map(|c| c.mission_id.clone()).collect();
    let total_xp: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(xp), 0)::bigint FROM lab_achievements WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    Ok((completions, completed_set, total_xp as i32))
}

pub async fn list_webdev_projects(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    let rights = load_user_access_rights(&state.pool, actor.id, &actor.allowed_roles).await;

    let rows: Vec<WebDevProjectRow> = sqlx::query_as(
        "SELECT id, title, mission_id, files_json, updated_at FROM webdev_projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 30",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let (completions, completed_ids, portal_xp) =
        load_webdev_progress(&state.pool, actor.id).await?;

    let webdev_xp: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(xp), 0)::bigint FROM lab_achievements WHERE user_id = $1 AND (achievement_key LIKE 'webdev:%' OR achievement_key LIKE 'badge:webdev-%')",
    )
    .bind(actor.id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let mission_states: Vec<Value> = WEBDEV_MISSION_RULES
        .iter()
        .enumerate()
        .map(|(order, rule)| {
            let (unlocked, lock_reason) = evaluate_mission_access(
                &actor.role,
                rule.id,
                &completed_ids,
                portal_xp,
                rights.can_access_web_labs,
            );
            json!({
                "mission_id": rule.id,
                "order": order + 1,
                "title": rule.title,
                "xp": rule.xp,
                "required_xp": rule.required_xp,
                "unlocked": unlocked,
                "completed": completed_ids.contains(rule.id),
                "lock_reason": lock_reason,
            })
        })
        .collect();

    let ach_rows: Vec<(String,)> = sqlx::query_as(
        "SELECT achievement_key FROM lab_achievements WHERE user_id = $1 AND achievement_key LIKE 'badge:webdev-%' ORDER BY earned_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;
    let earned_set: HashSet<String> = ach_rows.into_iter().map(|a| a.0).collect();

    let achievements: Vec<Value> = WEBDEV_BADGE_SPECS
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

    let projects: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            let files: Vec<WebDevFileEntry> =
                serde_json::from_value(r.files_json).unwrap_or_default();
            json!({
                "id": r.id,
                "title": r.title,
                "mission_id": r.mission_id,
                "files": files,
                "updated_at": r.updated_at,
            })
        })
        .collect();

    let completed_missions: Vec<Value> = completions
        .into_iter()
        .map(|m| {
            json!({
                "mission_id": m.mission_id,
                "score": m.score,
                "completed_at": m.completed_at,
            })
        })
        .collect();

    Ok(Json(json!({
        "projects": projects,
        "completed_missions": completed_missions,
        "mission_states": mission_states,
        "achievements": achievements,
        "portal_xp": portal_xp,
        "webdev_xp": webdev_xp,
        "access": {
            "can_access_web_labs": rights.can_access_web_labs || actor.role == "dosen",
            "can_submit_assignments": rights.can_submit_assignments || actor.role == "dosen",
            "is_instructor": actor.role == "dosen",
        }
    })))
}

pub async fn list_student_webdev_projects(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(query): Query<StudentWebDevProjectsQuery>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    if actor.role != "dosen" {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let rights = load_user_access_rights(&state.pool, actor.id, &actor.allowed_roles).await;
    if !rights.can_view_class_analytics {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    let class_filter = query
        .class_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "ALL")
        .map(str::to_string);
    let q_filter = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s.to_ascii_lowercase()));

    let rows: Vec<StudentWebDevProjectRow> = sqlx::query_as(
        "SELECT p.id, p.title, p.mission_id, p.files_json, p.updated_at,
                u.id AS owner_id, u.name AS owner_name, u.email AS owner_email,
                COALESCE(cm.class_id, 'Tanpa Kelas') AS class_id
         FROM webdev_projects p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN LATERAL (
             SELECT class_id FROM class_memberships WHERE user_id = u.id ORDER BY joined_at ASC LIMIT 1
         ) cm ON true
         WHERE u.role = 'mahasiswa'
           AND ($1::text IS NULL OR cm.class_id = $1)
           AND ($2::text IS NULL OR LOWER(p.title) LIKE $2 OR LOWER(u.name) LIKE $2 OR LOWER(u.email) LIKE $2 OR LOWER(p.files_json::text) LIKE $2)
         ORDER BY p.updated_at DESC
         LIMIT 60",
    )
    .bind(class_filter.as_deref())
    .bind(q_filter.as_deref())
    .fetch_all(&state.pool)
    .await?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            let files: Vec<WebDevFileEntry> =
                serde_json::from_value(r.files_json).unwrap_or_default();
            json!({
                "id": r.id,
                "title": r.title,
                "mission_id": r.mission_id,
                "files": files,
                "updated_at": r.updated_at,
                "owner_id": r.owner_id,
                "owner_name": r.owner_name,
                "owner_email": r.owner_email,
                "class_id": r.class_id,
            })
        })
        .collect();

    Ok(Json(json!({ "projects": items })))
}

pub async fn save_webdev_project(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<SaveWebDevProjectReq>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let rights = load_user_access_rights(&state.pool, actor.id, &actor.allowed_roles).await;
    if actor.role == "mahasiswa" && !rights.can_access_web_labs {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    let title = req.title.trim();
    if title.is_empty() || title.len() > 140 {
        return Err(ApiError(StatusCode::BAD_REQUEST));
    }
    let validated_files = normalize_and_validate_webdev_files(&req.files)
        .map_err(|_| ApiError(StatusCode::BAD_REQUEST))?;
    let files_val = serde_json::to_value(&validated_files)
        .map_err(|_| ApiError(StatusCode::INTERNAL_SERVER_ERROR))?;

    let proj_id = req.id.unwrap_or_else(Uuid::new_v4);
    let mut tx = state.pool.begin().await?;

    let exists: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM webdev_projects WHERE id=$1 AND user_id=$2")
            .bind(proj_id)
            .bind(actor.id)
            .fetch_optional(&mut *tx)
            .await?;

    if exists.is_some() {
        sqlx::query(
            "UPDATE webdev_projects SET title=$1, mission_id=$2, files_json=$3, updated_at=now() WHERE id=$4 AND user_id=$5",
        )
        .bind(title)
        .bind(req.mission_id.as_deref())
        .bind(&files_val)
        .bind(proj_id)
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO webdev_projects(id, user_id, title, mission_id, files_json) VALUES($1, $2, $3, $4, $5)",
        )
        .bind(proj_id)
        .bind(actor.id)
        .bind(title)
        .bind(req.mission_id.as_deref())
        .bind(&files_val)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(json!({
        "id": proj_id,
        "title": title,
        "mission_id": req.mission_id,
        "files": validated_files,
        "saved": true
    })))
}

pub async fn delete_webdev_project(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let res = sqlx::query("DELETE FROM webdev_projects WHERE id=$1 AND user_id=$2")
        .bind(project_id)
        .bind(actor.id)
        .execute(&state.pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(ApiError(StatusCode::NOT_FOUND));
    }
    Ok(Json(json!({ "deleted": true, "id": project_id })))
}

pub async fn submit_webdev_mission(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<SubmitWebDevMissionReq>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if !matches!(actor.role.as_str(), "mahasiswa" | "dosen") {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    let validated_files = normalize_and_validate_webdev_files(&req.files)
        .map_err(|_| ApiError(StatusCode::BAD_REQUEST))?;

    let Some(rule) = find_mission_rule(&req.mission_id) else {
        return Err(ApiError(StatusCode::NOT_FOUND));
    };

    if actor.role == "mahasiswa" {
        let rights = load_user_access_rights(&state.pool, actor.id, &actor.allowed_roles).await;
        if !rights.can_access_web_labs || !rights.can_submit_assignments {
            return Err(ApiError(StatusCode::FORBIDDEN));
        }

        let (_, completed_ids, portal_xp) = load_webdev_progress(&state.pool, actor.id).await?;
        let (unlocked, lock_reason) = evaluate_mission_access(
            &actor.role,
            rule.id,
            &completed_ids,
            portal_xp,
            rights.can_access_web_labs,
        );
        if !unlocked {
            let summary = format!(
                "Percobaan lompat misi Web Dev {} ditolak server: {}",
                rule.id,
                lock_reason.unwrap_or_else(|| "pengalaman XP/prasyarat belum cukup".to_string())
            );
            let _ = sqlx::query(
                "INSERT INTO security_anomalies(id,user_id,actor_email,kind,severity,summary) VALUES($1,$2,$3,'webdev_progression_bypass_attempt','medium',$4)",
            )
            .bind(Uuid::new_v4())
            .bind(actor.id)
            .bind(&actor.email)
            .bind(&summary)
            .execute(&state.pool)
            .await;
            return Err(ApiError(StatusCode::FORBIDDEN));
        }
    }

    let combined_code = match verify_mission_payload(rule, &req, &validated_files) {
        Ok(combined) => combined,
        Err(reason) => {
            if actor.role == "mahasiswa"
                && req.checks_total > 0
                && req.checks_passed >= req.checks_total
            {
                let summary = format!(
                    "Klaim lulus misi Web Dev {} ditolak server: {}",
                    rule.id, reason
                );
                let _ = sqlx::query(
                    "INSERT INTO security_anomalies(id,user_id,actor_email,kind,severity,summary) VALUES($1,$2,$3,'webdev_submission_tampering','medium',$4)",
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
    };

    let score = 100;
    let code_hash = format!("{:x}", Sha256::digest(combined_code.as_bytes()));
    let mut tx = state.pool.begin().await?;

    sqlx::query(
        "INSERT INTO webdev_mission_completions(user_id, mission_id, score, code_sha256, completed_at) VALUES($1, $2, $3, $4, now()) ON CONFLICT (user_id, mission_id) DO UPDATE SET score=GREATEST(webdev_mission_completions.score, EXCLUDED.score), code_sha256=EXCLUDED.code_sha256, completed_at=now()",
    )
    .bind(actor.id)
    .bind(rule.id)
    .bind(score)
    .bind(&code_hash)
    .execute(&mut *tx)
    .await?;

    let mut xp_awarded = 0;
    let mut newly_unlocked: Vec<&'static str> = Vec::new();
    if actor.role == "mahasiswa" {
        let ach_key = format!("webdev:{}", rule.id);
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
            "SELECT count(DISTINCT mission_id) FROM webdev_mission_completions WHERE user_id=$1",
        )
        .bind(actor.id)
        .fetch_one(&mut *tx)
        .await?;

        let mut unlock_keys: Vec<&'static str> = vec!["badge:webdev-perintis"];
        if total_done.0 >= 4 {
            unlock_keys.push("badge:webdev-frontend");
        }
        if total_done.0 >= 11 {
            unlock_keys.push("badge:webdev-backend");
        }
        if total_done.0 >= WEBDEV_MISSION_RULES.len() as i64 {
            unlock_keys.push("badge:webdev-fullstack");
        }

        for bkey in unlock_keys {
            if let Some(spec) = WEBDEV_BADGE_SPECS.iter().find(|s| s.key == bkey) {
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
        "INSERT INTO platform_audit_logs(id, actor_id, kind, title, target, result) VALUES($1, $2, 'Praktikum Web Dev', 'Verifikasi Misi Web Dev Server-Side', $3, 'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(rule.title)
    .execute(&mut *tx)
    .await
    .ok();

    tx.commit().await?;

    let (_, updated_completed_ids, updated_portal_xp) =
        load_webdev_progress(&state.pool, actor.id).await?;
    let rights = load_user_access_rights(&state.pool, actor.id, &actor.allowed_roles).await;
    let updated_states: Vec<Value> = WEBDEV_MISSION_RULES
        .iter()
        .enumerate()
        .map(|(order, r)| {
            let (unlocked, lock_reason) = evaluate_mission_access(
                &actor.role,
                r.id,
                &updated_completed_ids,
                updated_portal_xp,
                rights.can_access_web_labs,
            );
            json!({
                "mission_id": r.id,
                "order": order + 1,
                "title": r.title,
                "xp": r.xp,
                "required_xp": r.required_xp,
                "unlocked": unlocked,
                "completed": updated_completed_ids.contains(r.id),
                "lock_reason": lock_reason,
            })
        })
        .collect();

    Ok(Json(json!({
        "mission_id": rule.id,
        "score": score,
        "passed": true,
        "xp_awarded": xp_awarded,
        "portal_xp": updated_portal_xp,
        "newly_unlocked": newly_unlocked,
        "mission_states": updated_states,
        "verified_by_server": true,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lecturer_unlocks_all_14_webdev_missions_while_student_needs_xp() {
        let mut completed = HashSet::new();
        let (p1_ok, _) =
            evaluate_mission_access("mahasiswa", "webdev-p01-http", &completed, 0, true);
        let (p2_locked, p2_msg) =
            evaluate_mission_access("mahasiswa", "webdev-p02-html", &completed, 0, true);
        assert!(p1_ok);
        assert!(!p2_locked);
        assert!(p2_msg.unwrap().contains("P1"));

        // Prasyarat P1 lulus tetapi XP belum cukup
        completed.insert("webdev-p01-http".into());
        let (p2_low_xp, msg_xp) =
            evaluate_mission_access("mahasiswa", "webdev-p02-html", &completed, 20, true);
        assert!(!p2_low_xp);
        assert!(msg_xp.unwrap().contains("50 XP"));

        // XP dan prasyarat terpenuhi -> P2 terbuka
        let (p2_ready, _) =
            evaluate_mission_access("mahasiswa", "webdev-p02-html", &completed, 100, true);
        assert!(p2_ready);

        // Dosen selalu terbuka seluruh 14 misi
        let empty = HashSet::new();
        for rule in WEBDEV_MISSION_RULES {
            let (doc_ok, _) = evaluate_mission_access("dosen", rule.id, &empty, 0, true);
            assert!(doc_ok, "Dosen harus terbuka {}", rule.id);
        }
    }

    #[test]
    fn validates_webdev_extensions_and_payload_checks() {
        let valid = vec![
            WebDevFileEntry {
                name: "index.html".into(),
                content: "<main><article>Hi</article></main>".into(),
            },
            WebDevFileEntry {
                name: "api.py".into(),
                content: "from fastapi import FastAPI\napp = FastAPI()\n@app.get(\"/x\")\ndef a(): return {}\n@app.post(\"/x\")\ndef b(): return {}\n".into(),
            },
        ];
        assert_eq!(
            normalize_and_validate_webdev_files(&valid).unwrap().len(),
            2
        );

        let blocked = vec![WebDevFileEntry {
            name: "bad.exe".into(),
            content: "mz".into(),
        }];
        assert!(normalize_and_validate_webdev_files(&blocked).is_err());

        let r11 = find_mission_rule("webdev-p11-fastapi").unwrap();
        let un_tested = SubmitWebDevMissionReq {
            mission_id: "webdev-p11-fastapi".into(),
            files: valid.clone(),
            checks_passed: 3,
            checks_total: 3,
            render_ready: true,
            api_tested: false,
            sql_executed: false,
        };
        assert!(verify_mission_payload(r11, &un_tested, &valid).is_err());

        let tested = SubmitWebDevMissionReq {
            api_tested: true,
            ..un_tested
        };
        assert!(verify_mission_payload(r11, &tested, &valid).is_ok());
    }
}
