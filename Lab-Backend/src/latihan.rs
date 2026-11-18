//! Bank latihan. Kunci jawaban hanya keluar melalui endpoint Dosen; jawaban
//! Mahasiswa diperiksa di server, termasuk syarat membuka langkah berikutnya.

use crate::{ApiError, AppState, Identity, identity, moodle, verify_mutation};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use axum_extra::extract::cookie::CookieJar;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{FromRow, PgPool};
use std::{
    collections::{HashMap, HashSet},
    sync::OnceLock,
};
use uuid::Uuid;

fn default_est_minutes() -> i32 {
    5
}

fn default_source_format() -> String {
    "builtin".to_string()
}

#[derive(Deserialize, Clone)]
pub struct Catalog {
    pub tracks: Vec<Track>,
    pub levels: Vec<Level>,
    pub exercises: Vec<Exercise>,
}
#[derive(Deserialize, Serialize, Clone)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub description: String,
}
#[derive(Deserialize, Serialize, Clone)]
pub struct Level {
    pub level: u8,
    pub name: String,
    pub points: i32,
}
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Choice {
    pub key: String,
    pub text: String,
}
#[derive(Debug, Deserialize, Clone)]
pub struct Exercise {
    pub id: String,
    pub track: String,
    pub level: u8,
    pub title: String,
    pub owasp: Option<String>,
    pub scenario: String,
    pub code: Option<String>,
    pub code_lang: Option<String>,
    pub question: String,
    pub kind: String,
    #[serde(default)]
    pub options: Vec<Choice>,
    pub answer: Vec<String>,
    pub hint: String,
    pub explanation: String,
    #[serde(default = "default_est_minutes")]
    pub estimated_minutes: i32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_source_format")]
    pub source_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PlatformSettings {
    pub active_tracks: serde_json::Value,
    pub enforce_sequential_unlock: bool,
    pub strict_deadline_lock: bool,
    pub block_concurrent_attempts: bool,
    pub max_import_questions: i32,
    pub allow_dosen_question_import: bool,
    pub allow_student_hints: bool,
    pub hide_answer_explanations_until_due: bool,
}

impl Default for PlatformSettings {
    fn default() -> Self {
        Self {
            active_tracks: json!(["web", "iot"]),
            enforce_sequential_unlock: true,
            strict_deadline_lock: true,
            block_concurrent_attempts: true,
            max_import_questions: 100,
            allow_dosen_question_import: true,
            allow_student_hints: true,
            hide_answer_explanations_until_due: false,
        }
    }
}

pub async fn load_platform_settings(pool: &PgPool) -> PlatformSettings {
    sqlx::query_as::<_, PlatformSettings>(
        "SELECT active_tracks,enforce_sequential_unlock,strict_deadline_lock,block_concurrent_attempts,max_import_questions,allow_dosen_question_import,allow_student_hints,hide_answer_explanations_until_due FROM platform_settings WHERE id='default'",
    )
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_default()
}

pub(crate) async fn record_role_tampering(pool: &PgPool, actor: &Identity, target: &str) {
    let summary = format!(
        "Percobaan akses tidak sah oleh {} ({}) ke {}",
        actor.email, actor.role, target
    );
    let _ = sqlx::query(
        "INSERT INTO security_anomalies(id,user_id,actor_email,kind,severity,summary) VALUES($1,$2,$3,'unauthorized_access','high',$4)",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&actor.email)
    .bind(summary)
    .execute(pool)
    .await;
}

static CATALOG: OnceLock<Catalog> = OnceLock::new();

pub fn catalog() -> &'static Catalog {
    CATALOG.get_or_init(|| {
        let catalog: Catalog = serde_json::from_str(include_str!("../content/latihan.json"))
            .expect("content/latihan.json valid");
        validate(&catalog).expect("bank latihan konsisten");
        catalog
    })
}

pub fn validate(c: &Catalog) -> Result<(), String> {
    let mut ids = HashSet::new();
    let tracks: HashSet<_> = c.tracks.iter().map(|t| t.id.as_str()).collect();
    let levels: HashSet<_> = c.levels.iter().map(|l| l.level).collect();
    for e in &c.exercises {
        if !ids.insert(e.id.as_str()) {
            return Err(format!("id ganda {}", e.id));
        }
        if !tracks.contains(e.track.as_str()) || !levels.contains(&e.level) {
            return Err(format!("jalur/level tidak dikenal {}", e.id));
        }
        if e.answer.is_empty() || e.id.len() > 64 {
            return Err(format!("jawaban kosong {}", e.id));
        }
        match e.kind.as_str() {
            "pilihan" => {
                let keys: HashSet<_> = e.options.iter().map(|o| o.key.as_str()).collect();
                if e.options.len() < 2
                    || keys.len() != e.options.len()
                    || e.answer.len() != 1
                    || !keys.contains(e.answer[0].as_str())
                {
                    return Err(format!("opsi tidak valid {}", e.id));
                }
            }
            "isian" => {
                if !e.options.is_empty() || e.answer.iter().any(|a| normalize(a) != *a) {
                    return Err(format!("isian harus ternormalisasi {}", e.id));
                }
            }
            _ => return Err(format!("jenis tidak dikenal {}", e.id)),
        }
    }
    for t in &c.tracks {
        for l in &c.levels {
            if !c
                .exercises
                .iter()
                .any(|e| e.track == t.id && e.level == l.level)
            {
                return Err(format!("level {} kosong pada {}", l.level, t.id));
            }
        }
    }
    Ok(())
}

/// Huruf kecil, spasi dirapikan, tanda kutip pembungkus dibuang.
pub fn normalize(answer: &str) -> String {
    answer
        .trim()
        .trim_matches(|c| c == '"' || c == '\'' || c == '`')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

pub fn is_correct(exercise: &Exercise, answer: &str) -> bool {
    let answer = normalize(answer);
    exercise.answer.contains(&answer)
}

/// Urutan latihan pada satu jalur: level menaik, lalu urutan di berkas.
fn ordered<'a>(c: &'a Catalog, track: &str) -> Vec<&'a Exercise> {
    let mut list: Vec<_> = c.exercises.iter().filter(|e| e.track == track).collect();
    list.sort_by_key(|e| e.level);
    list
}

/// Latihan terbuka bila semua latihan sebelumnya pada jalur yang sama sudah selesai.
/// Konsekuensinya, level berikutnya baru terbuka setelah seluruh level sebelumnya lulus.
pub fn unlocked(c: &Catalog, id: &str, completed: &HashSet<String>) -> bool {
    let Some(target) = c.exercises.iter().find(|e| e.id == id) else {
        return false;
    };
    ordered(c, &target.track)
        .into_iter()
        .take_while(|e| e.id != id)
        .all(|e| completed.contains(&e.id))
}

/// Poin dasar level, setengah bila memakai petunjuk, berkurang 10% per percobaan salah, minimum 20%.
pub fn award(base: i32, attempts: i32, hint_used: bool) -> i32 {
    let start = if hint_used { base / 2 } else { base };
    let penalty = (attempts.max(1) - 1) * base / 10;
    (start - penalty).max(base / 5).max(1)
}

fn level_points(c: &Catalog, level: u8) -> i32 {
    c.levels
        .iter()
        .find(|l| l.level == level)
        .map_or(10, |l| l.points)
}

#[derive(Serialize)]
pub struct ExerciseView {
    id: String,
    level: u8,
    title: String,
    owasp: Option<String>,
    points: i32,
    status: &'static str,
    estimated_minutes: i32,
    tags: Vec<String>,
    source_format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<Content>,
    #[serde(skip_serializing_if = "Option::is_none")]
    progress: Option<ProgressView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    key: Option<AnswerKey>,
}
#[derive(Serialize)]
struct Content {
    scenario: String,
    code: Option<String>,
    code_lang: Option<String>,
    question: String,
    kind: String,
    options: Vec<Choice>,
    hint: Option<String>,
    explanation: Option<String>,
}
#[derive(Serialize)]
struct ProgressView {
    attempts: i32,
    hint_used: bool,
    earned: i32,
}
#[derive(Serialize)]
struct AnswerKey {
    answers: Vec<String>,
}
#[derive(Serialize)]
pub struct TrackView {
    #[serde(flatten)]
    track: Track,
    exercises: Vec<ExerciseView>,
}
#[derive(Serialize)]
pub struct CatalogView {
    levels: Vec<Level>,
    tracks: Vec<TrackView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    policy: Option<CatalogPolicyView>,
}

#[derive(Serialize)]
struct CatalogPolicyView {
    enforce_sequential_unlock: bool,
    allow_student_hints: bool,
    hide_answer_explanations_until_due: bool,
    allow_dosen_question_import: bool,
    max_import_questions: i32,
}

fn content(e: &Exercise, hint: bool, explanation: bool) -> Content {
    Content {
        scenario: e.scenario.clone(),
        code: e.code.clone(),
        code_lang: e.code_lang.clone(),
        question: e.question.clone(),
        kind: e.kind.clone(),
        options: e.options.clone(),
        hint: hint.then(|| e.hint.clone()),
        explanation: explanation.then(|| e.explanation.clone()),
    }
}

#[derive(sqlx::FromRow)]
struct Row {
    exercise_id: String,
    attempts: i32,
    hint_used: bool,
    points: i32,
    completed: bool,
}

async fn progress(state: &AppState, user: Uuid) -> Result<HashMap<String, Row>, ApiError> {
    let rows: Vec<Row> = sqlx::query_as("SELECT exercise_id,attempts,hint_used,points,completed_at IS NOT NULL AS completed FROM exercise_progress WHERE user_id=$1")
        .bind(user).fetch_all(&state.pool).await?;
    Ok(rows
        .into_iter()
        .map(|r| (r.exercise_id.clone(), r))
        .collect())
}

fn require(actor: &Identity, role: &str) -> Result<(), ApiError> {
    if actor.role == role {
        Ok(())
    } else {
        Err(ApiError(StatusCode::FORBIDDEN))
    }
}

fn track_enabled(settings: &PlatformSettings, track_id: &str) -> bool {
    let arr = settings.active_tracks.as_array();
    let Some(list) = arr else {
        return true;
    };
    list.iter().any(|v| v.as_str() == Some(track_id))
}

#[derive(FromRow)]
struct DbQuestionRow {
    id: String,
    track: String,
    level: i16,
    title: String,
    owasp: Option<String>,
    estimated_minutes: i32,
    scenario: String,
    code: Option<String>,
    code_lang: Option<String>,
    question: String,
    kind: String,
    options_json: Value,
    answers_json: Value,
    hint: String,
    explanation: String,
    tags: Vec<String>,
    source_format: String,
}

async fn load_merged_catalog(pool: &PgPool) -> Catalog {
    let mut merged = catalog().clone();
    let Ok(db_rows) = sqlx::query_as::<_, DbQuestionRow>(
        "SELECT id,track,level,title,owasp,estimated_minutes,scenario,code,code_lang,question,kind,options_json,answers_json,hint,explanation,tags,source_format FROM question_bank_items WHERE published=true ORDER BY level ASC, created_at ASC",
    )
    .fetch_all(pool)
    .await
    else {
        return merged;
    };

    let mut seen: HashSet<String> = merged.exercises.iter().map(|e| e.id.clone()).collect();
    for r in db_rows {
        if seen.contains(&r.id) {
            continue;
        }
        let options: Vec<Choice> = serde_json::from_value(r.options_json).unwrap_or_default();
        let answers: Vec<String> = serde_json::from_value(r.answers_json).unwrap_or_default();
        if answers.is_empty() {
            continue;
        }
        seen.insert(r.id.clone());
        merged.exercises.push(Exercise {
            id: r.id,
            track: r.track,
            level: (r.level.clamp(1, 4)) as u8,
            title: r.title,
            owasp: r.owasp,
            scenario: r.scenario,
            code: r.code,
            code_lang: r.code_lang,
            question: r.question,
            kind: r.kind,
            options,
            answer: answers,
            hint: r.hint,
            explanation: r.explanation,
            estimated_minutes: r.estimated_minutes.clamp(1, 120),
            tags: r.tags,
            source_format: r.source_format,
        });
    }
    merged
}

#[cfg(test)]
fn student_view(rows: &HashMap<String, Row>) -> CatalogView {
    student_view_with_catalog(catalog(), &PlatformSettings::default(), rows)
}

fn student_view_with_catalog(
    c: &Catalog,
    settings: &PlatformSettings,
    rows: &HashMap<String, Row>,
) -> CatalogView {
    let completed: HashSet<String> = rows
        .values()
        .filter(|r| r.completed)
        .map(|r| r.exercise_id.clone())
        .collect();
    CatalogView {
        levels: c.levels.clone(),
        policy: Some(CatalogPolicyView {
            enforce_sequential_unlock: settings.enforce_sequential_unlock,
            allow_student_hints: settings.allow_student_hints,
            hide_answer_explanations_until_due: settings.hide_answer_explanations_until_due,
            allow_dosen_question_import: settings.allow_dosen_question_import,
            max_import_questions: settings.max_import_questions,
        }),
        tracks: c
            .tracks
            .iter()
            .filter(|t| track_enabled(settings, &t.id))
            .map(|t| TrackView {
                track: t.clone(),
                exercises: ordered(c, &t.id)
                    .into_iter()
                    .map(|e| {
                        let row = rows.get(&e.id);
                        let done = completed.contains(&e.id);
                        let open = done
                            || !settings.enforce_sequential_unlock
                            || unlocked(c, &e.id, &completed);
                        let show_hint =
                            settings.allow_student_hints && row.is_some_and(|r| r.hint_used);
                        let show_explain = done && !settings.hide_answer_explanations_until_due;
                        ExerciseView {
                            id: e.id.clone(),
                            level: e.level,
                            title: e.title.clone(),
                            owasp: e.owasp.clone(),
                            points: level_points(c, e.level),
                            status: if done {
                                "selesai"
                            } else if open {
                                "terbuka"
                            } else {
                                "terkunci"
                            },
                            estimated_minutes: e.estimated_minutes,
                            tags: e.tags.clone(),
                            source_format: e.source_format.clone(),
                            content: open.then(|| content(e, show_hint, show_explain)),
                            progress: row.map(|r| ProgressView {
                                attempts: r.attempts,
                                hint_used: r.hint_used,
                                earned: r.points,
                            }),
                            key: None,
                        }
                    })
                    .collect(),
            })
            .collect(),
    }
}

fn lecturer_view_with_catalog(c: &Catalog, settings: &PlatformSettings) -> CatalogView {
    CatalogView {
        levels: c.levels.clone(),
        policy: Some(CatalogPolicyView {
            enforce_sequential_unlock: settings.enforce_sequential_unlock,
            allow_student_hints: settings.allow_student_hints,
            hide_answer_explanations_until_due: settings.hide_answer_explanations_until_due,
            allow_dosen_question_import: settings.allow_dosen_question_import,
            max_import_questions: settings.max_import_questions,
        }),
        tracks: c
            .tracks
            .iter()
            .map(|t| TrackView {
                track: t.clone(),
                exercises: ordered(c, &t.id)
                    .into_iter()
                    .map(|e| ExerciseView {
                        id: e.id.clone(),
                        level: e.level,
                        title: e.title.clone(),
                        owasp: e.owasp.clone(),
                        points: level_points(c, e.level),
                        status: "terbuka",
                        estimated_minutes: e.estimated_minutes,
                        tags: e.tags.clone(),
                        source_format: e.source_format.clone(),
                        content: Some(content(e, true, true)),
                        progress: None,
                        key: Some(AnswerKey {
                            answers: e.answer.clone(),
                        }),
                    })
                    .collect(),
            })
            .collect(),
    }
}

pub async fn student_catalog(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<CatalogView>, ApiError> {
    let actor = identity(&state, &jar).await?;
    if require(&actor, "mahasiswa").is_err() {
        record_role_tampering(&state.pool, &actor, "/api/latihan").await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let settings = load_platform_settings(&state.pool).await;
    let c = load_merged_catalog(&state.pool).await;
    let rows = progress(&state, actor.id).await?;
    Ok(Json(student_view_with_catalog(&c, &settings, &rows)))
}

pub async fn lecturer_catalog(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<CatalogView>, ApiError> {
    let actor = identity(&state, &jar).await?;
    if require(&actor, "dosen").is_err() {
        record_role_tampering(&state.pool, &actor, "/api/dosen/latihan").await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let settings = load_platform_settings(&state.pool).await;
    let c = load_merged_catalog(&state.pool).await;
    Ok(Json(lecturer_view_with_catalog(&c, &settings)))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AnswerRequest {
    answer: String,
}

#[derive(Serialize)]
pub struct AnswerResult {
    correct: bool,
    earned: i32,
    attempts: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    explanation: Option<String>,
}

/// Mengunci baris progres dan memastikan latihan sudah terbuka dalam transaksi yang sama.
async fn lock_open(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    c: &Catalog,
    settings: &PlatformSettings,
    user: Uuid,
    exercise: &Exercise,
) -> Result<Row, ApiError> {
    if !track_enabled(settings, &exercise.track) {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    // Serialisasi permintaan paralel milik satu pengguna.
    if settings.block_concurrent_attempts {
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))")
            .bind(user)
            .execute(&mut **tx)
            .await?;
    }
    let done: Vec<(String,)> = sqlx::query_as(
        "SELECT exercise_id FROM exercise_progress WHERE user_id=$1 AND completed_at IS NOT NULL",
    )
    .bind(user)
    .fetch_all(&mut **tx)
    .await?;
    let completed: HashSet<String> = done.into_iter().map(|r| r.0).collect();
    if settings.enforce_sequential_unlock
        && !completed.contains(&exercise.id)
        && !unlocked(c, &exercise.id, &completed)
    {
        return Err(ApiError(StatusCode::CONFLICT));
    }
    let row: Row = sqlx::query_as("INSERT INTO exercise_progress(user_id,exercise_id) VALUES($1,$2) ON CONFLICT(user_id,exercise_id) DO UPDATE SET updated_at=exercise_progress.updated_at RETURNING exercise_id,attempts,hint_used,points,completed_at IS NOT NULL AS completed")
        .bind(user).bind(&exercise.id).fetch_one(&mut **tx).await?;
    Ok(row)
}

#[cfg(test)]
fn find(id: &str) -> Result<&'static Exercise, ApiError> {
    catalog()
        .exercises
        .iter()
        .find(|e| e.id == id)
        .ok_or(ApiError(StatusCode::NOT_FOUND))
}

fn find_in<'a>(c: &'a Catalog, id: &str) -> Result<&'a Exercise, ApiError> {
    c.exercises
        .iter()
        .find(|e| e.id == id)
        .ok_or(ApiError(StatusCode::NOT_FOUND))
}

pub async fn submit(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(request): Json<AnswerRequest>,
) -> Result<Json<AnswerResult>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if require(&actor, "mahasiswa").is_err() {
        record_role_tampering(&state.pool, &actor, &format!("/api/latihan/{id}/jawab")).await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let settings = load_platform_settings(&state.pool).await;
    let c = load_merged_catalog(&state.pool).await;
    let exercise = find_in(&c, &id)?;
    if request.answer.trim().is_empty() || request.answer.len() > 200 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }
    let mut tx = state.pool.begin().await?;
    let row = lock_open(&mut tx, &c, &settings, actor.id, exercise).await?;
    if row.completed {
        tx.commit().await?;
        return Ok(Json(AnswerResult {
            correct: true,
            earned: row.points,
            attempts: row.attempts,
            explanation: (!settings.hide_answer_explanations_until_due)
                .then(|| exercise.explanation.clone()),
        }));
    }
    let attempts = row.attempts + 1;
    let correct = is_correct(exercise, &request.answer);
    let earned = if correct {
        award(level_points(&c, exercise.level), attempts, row.hint_used)
    } else {
        0
    };
    sqlx::query("UPDATE exercise_progress SET attempts=$3,points=$4,completed_at=CASE WHEN $5 THEN now() END,updated_at=now() WHERE user_id=$1 AND exercise_id=$2")
        .bind(actor.id).bind(&exercise.id).bind(attempts).bind(earned).bind(correct).execute(&mut *tx).await?;
    tx.commit().await?;
    tracing::info!(event = "exercise_attempted", exercise = %exercise.id, correct);
    Ok(Json(AnswerResult {
        correct,
        earned,
        attempts,
        explanation: (correct && !settings.hide_answer_explanations_until_due)
            .then(|| exercise.explanation.clone()),
    }))
}

pub async fn reveal_hint(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if require(&actor, "mahasiswa").is_err() {
        record_role_tampering(&state.pool, &actor, &format!("/api/latihan/{id}/petunjuk")).await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let settings = load_platform_settings(&state.pool).await;
    if !settings.allow_student_hints {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let c = load_merged_catalog(&state.pool).await;
    let exercise = find_in(&c, &id)?;
    let mut tx = state.pool.begin().await?;
    let row = lock_open(&mut tx, &c, &settings, actor.id, exercise).await?;
    if !row.completed {
        sqlx::query("UPDATE exercise_progress SET hint_used=true,updated_at=now() WHERE user_id=$1 AND exercise_id=$2")
            .bind(actor.id).bind(&exercise.id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(Json(json!({ "hint": exercise.hint })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ImportQuestionsRequest {
    pub format: Option<moodle::ImportFormat>,
    pub track: String,
    pub default_level: Option<u8>,
    pub content: String,
    #[serde(default)]
    pub dry_run: bool,
}

pub async fn import_questions(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<ImportQuestionsRequest>,
) -> Result<Response, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if require(&actor, "dosen").is_err() {
        record_role_tampering(&state.pool, &actor, "/api/dosen/latihan/import").await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let settings = load_platform_settings(&state.pool).await;
    if !settings.allow_dosen_question_import {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let fmt = req.format.unwrap_or(moodle::ImportFormat::Auto);
    let max_q = settings.max_import_questions.clamp(10, 500) as usize;
    let parsed = match moodle::parse_import(
        &req.content,
        fmt,
        &req.track,
        req.default_level.unwrap_or(1),
        max_q,
    ) {
        Ok(res) => res,
        Err(msg) => {
            return Ok((
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "status": 422, "code": "VALIDATION_ERROR", "message": msg })),
            )
                .into_response());
        }
    };

    let (items, detected_fmt) = parsed;
    let previews: Vec<moodle::ParsedQuestionPreview> = items
        .iter()
        .map(|ex| moodle::ParsedQuestionPreview {
            title: ex.title.clone(),
            track: ex.track.clone(),
            level: ex.level,
            kind: ex.kind.clone(),
            question: ex.question.clone(),
            options_count: ex.options.len(),
            answer_preview: ex.answer.clone(),
            tags: ex.tags.clone(),
            source_format: ex.source_format.clone(),
        })
        .collect();

    if req.dry_run {
        return Ok(Json(json!({
            "dry_run": true,
            "format": detected_fmt,
            "track": items.first().map(|x| x.track.as_str()).unwrap_or("web"),
            "count": previews.len(),
            "previews": previews,
        }))
        .into_response());
    }

    let mut tx = state.pool.begin().await?;
    for ex in &items {
        let diff_label = match ex.level {
            1 => "Mudah",
            2 => "Menengah",
            3 => "Sulit",
            _ => "Ahli",
        };
        let opts_json = serde_json::to_value(&ex.options).unwrap_or_else(|_| json!([]));
        let ans_json = serde_json::to_value(&ex.answer).unwrap_or_else(|_| json!([]));
        sqlx::query(
            "INSERT INTO question_bank_items(id,track,level,title,owasp,difficulty_label,estimated_minutes,scenario,code,code_lang,question,kind,options_json,answers_json,hint,explanation,tags,source_format,published,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,$19)",
        )
        .bind(&ex.id)
        .bind(&ex.track)
        .bind(ex.level as i16)
        .bind(&ex.title)
        .bind(&ex.owasp)
        .bind(diff_label)
        .bind(ex.estimated_minutes)
        .bind(&ex.scenario)
        .bind(&ex.code)
        .bind(&ex.code_lang)
        .bind(&ex.question)
        .bind(&ex.kind)
        .bind(opts_json)
        .bind(ans_json)
        .bind(&ex.hint)
        .bind(&ex.explanation)
        .bind(&ex.tags)
        .bind(&ex.source_format)
        .bind(actor.id)
        .execute(&mut *tx)
        .await?;
    }

    let target_label = format!("{} soal ({detected_fmt})", items.len());
    sqlx::query(
        "INSERT INTO platform_audit_logs(id,actor_id,kind,title,target,result) VALUES($1,$2,'Publikasi','Impor Bank Soal Moodle LMS',$3,'Berhasil')",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&target_label)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(Json(json!({
        "dry_run": false,
        "imported": items.len(),
        "format": detected_fmt,
        "previews": previews,
    }))
    .into_response())
}

#[derive(Deserialize)]
pub struct ExportQuery {
    pub format: Option<String>,
    pub track: Option<String>,
}

pub async fn export_questions(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<ExportQuery>,
) -> Result<Response, ApiError> {
    let actor = identity(&state, &jar).await?;
    if require(&actor, "dosen").is_err() {
        record_role_tampering(&state.pool, &actor, "/api/dosen/latihan/export").await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let c = load_merged_catalog(&state.pool).await;
    let track_filter = q.track.as_deref().unwrap_or("all");
    let items: Vec<Exercise> = c
        .exercises
        .into_iter()
        .filter(|e| track_filter == "all" || e.track == track_filter)
        .collect();

    let fmt = q.format.as_deref().unwrap_or("moodle_xml");
    match fmt {
        "gift" | "moodle_gift" => Ok((
            [
                (
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("text/plain; charset=utf-8"),
                ),
                (
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_static(
                        "attachment; filename=\"ifa-lab-bank-soal-moodle.gift.txt\"",
                    ),
                ),
            ],
            moodle::export_moodle_gift(&items),
        )
            .into_response()),
        "json" => Ok((
            [
                (
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json; charset=utf-8"),
                ),
                (
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_static("attachment; filename=\"ifa-lab-bank-soal.json\""),
                ),
            ],
            serde_json::to_string_pretty(&json!({
                "tracks": c.tracks,
                "exercises": items.iter().map(|e| json!({
                    "id": e.id,
                    "title": e.title,
                    "track": e.track,
                    "level": e.level,
                    "owasp": e.owasp,
                    "scenario": e.scenario,
                    "question": e.question,
                    "kind": e.kind,
                    "options": e.options,
                    "answer": e.answer,
                    "hint": e.hint,
                    "explanation": e.explanation,
                    "tags": e.tags,
                    "source_format": e.source_format,
                })).collect::<Vec<_>>()
            }))
            .unwrap_or_default(),
        )
            .into_response()),
        _ => Ok((
            [
                (
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/xml; charset=utf-8"),
                ),
                (
                    header::CONTENT_DISPOSITION,
                    HeaderValue::from_static(
                        "attachment; filename=\"ifa-lab-bank-soal-moodle.xml\"",
                    ),
                ),
            ],
            moodle::export_moodle_xml(&items),
        )
            .into_response()),
    }
}

pub async fn delete_question(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if require(&actor, "dosen").is_err() {
        record_role_tampering(&state.pool, &actor, &format!("/api/dosen/latihan/{id}")).await;
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let deleted: Option<(String,)> =
        sqlx::query_as("DELETE FROM question_bank_items WHERE id=$1 RETURNING id")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await?;
    if deleted.is_none() {
        return Err(ApiError(StatusCode::NOT_FOUND));
    }
    Ok(Json(json!({ "deleted": id })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_catalog_is_consistent() {
        let c = catalog();
        assert_eq!(c.tracks.len(), 2);
        assert_eq!(c.exercises.len(), 24);
    }

    #[test]
    fn answers_are_normalized_and_exact() {
        let e = find("web-1-3").ok().unwrap();
        assert!(is_correct(e, "  X-Frame-Options "));
        assert!(is_correct(e, "\"Content-Security-Policy\""));
        assert!(!is_correct(e, "x-frame"));
        let choice = find("web-1-1").ok().unwrap();
        assert!(is_correct(choice, "B"));
        assert!(!is_correct(choice, "b c"));
    }

    #[test]
    fn steps_and_levels_unlock_in_order() {
        let c = catalog();
        let mut done = HashSet::new();
        assert!(unlocked(c, "web-1-1", &done));
        assert!(!unlocked(c, "web-1-2", &done));
        assert!(unlocked(c, "iot-1-1", &done), "jalur lain berdiri sendiri");
        done.insert("web-1-1".to_string());
        done.insert("web-1-2".to_string());
        assert!(
            !unlocked(c, "web-2-1", &done),
            "level 2 menunggu level 1 tuntas"
        );
        done.insert("web-1-3".to_string());
        assert!(unlocked(c, "web-2-1", &done));
        assert!(!unlocked(c, "web-3-1", &done));
        assert!(!unlocked(c, "tidak-ada", &done));
    }

    #[test]
    fn points_drop_with_hint_and_retries_but_keep_floor() {
        assert_eq!(award(20, 1, false), 20);
        assert_eq!(award(20, 1, true), 10);
        assert_eq!(award(20, 3, false), 16);
        assert_eq!(award(20, 50, true), 4);
        assert_eq!(award(10, 9, false), 2);
    }

    #[test]
    fn student_view_hides_answers_and_locked_content() {
        let view = serde_json::to_value(student_view(&HashMap::new())).unwrap();
        let text = view.to_string();
        for track in view["tracks"].as_array().unwrap() {
            for exercise in track["exercises"].as_array().unwrap() {
                assert!(exercise.get("key").is_none(), "kunci jawaban bocor");
            }
        }
        assert!(!text.contains("\"answers\""));
        assert!(!text.contains(&find("web-1-1").ok().unwrap().explanation));
        assert!(
            !text.contains(&find("web-1-2").ok().unwrap().scenario),
            "latihan terkunci tidak membocorkan isi"
        );
        let first = &view["tracks"][0]["exercises"][0];
        assert_eq!(first["status"], "terbuka");
        assert!(first["content"]["hint"].is_null());
        assert_eq!(view["tracks"][0]["exercises"][1]["status"], "terkunci");
        let lecturer = serde_json::to_value(lecturer_view_with_catalog(
            catalog(),
            &PlatformSettings::default(),
        ))
        .unwrap();
        assert_eq!(
            lecturer["tracks"][0]["exercises"][0]["key"]["answers"][0],
            "b"
        );
    }

    #[test]
    fn admin_settings_control_track_visibility_unlock_and_explanations() {
        let settings = PlatformSettings {
            active_tracks: json!(["web"]),
            enforce_sequential_unlock: false,
            hide_answer_explanations_until_due: true,
            allow_student_hints: false,
            ..Default::default()
        };

        let mut rows = HashMap::new();
        rows.insert(
            "web-1-1".to_string(),
            Row {
                exercise_id: "web-1-1".to_string(),
                attempts: 1,
                hint_used: true,
                points: 10,
                completed: true,
            },
        );
        let view =
            serde_json::to_value(student_view_with_catalog(catalog(), &settings, &rows)).unwrap();
        assert_eq!(view["tracks"].as_array().unwrap().len(), 1);
        assert_eq!(view["tracks"][0]["id"], "web");
        assert_eq!(view["tracks"][0]["exercises"][1]["status"], "terbuka");
        assert!(view["tracks"][0]["exercises"][0]["content"]["explanation"].is_null());
        assert!(view["tracks"][0]["exercises"][0]["content"]["hint"].is_null());
    }
}
