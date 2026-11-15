//! Bank latihan. Kunci jawaban hanya keluar melalui endpoint Dosen; jawaban
//! Mahasiswa diperiksa di server, termasuk syarat membuka langkah berikutnya.

use crate::{ApiError, AppState, Identity, identity, verify_mutation};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use axum_extra::extract::cookie::CookieJar;
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::OnceLock,
};
use uuid::Uuid;

#[derive(Deserialize)]
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
#[derive(Deserialize, Serialize, Clone)]
pub struct Choice {
    pub key: String,
    pub text: String,
}
#[derive(Deserialize, Clone)]
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

fn student_view(rows: &HashMap<String, Row>) -> CatalogView {
    let c = catalog();
    let completed: HashSet<String> = rows
        .values()
        .filter(|r| r.completed)
        .map(|r| r.exercise_id.clone())
        .collect();
    CatalogView {
        levels: c.levels.clone(),
        tracks: c
            .tracks
            .iter()
            .map(|t| TrackView {
                track: t.clone(),
                exercises: ordered(c, &t.id)
                    .into_iter()
                    .map(|e| {
                        let row = rows.get(&e.id);
                        let done = completed.contains(&e.id);
                        let open = done || unlocked(c, &e.id, &completed);
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
                            content: open
                                .then(|| content(e, row.is_some_and(|r| r.hint_used), done)),
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

fn lecturer_view() -> CatalogView {
    let c = catalog();
    CatalogView {
        levels: c.levels.clone(),
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
    require(&actor, "mahasiswa")?;
    Ok(Json(student_view(&progress(&state, actor.id).await?)))
}

pub async fn lecturer_catalog(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<CatalogView>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require(&actor, "dosen")?;
    Ok(Json(lecturer_view()))
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
    user: Uuid,
    exercise: &Exercise,
) -> Result<Row, ApiError> {
    // Serialisasi permintaan paralel milik satu pengguna.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))")
        .bind(user)
        .execute(&mut **tx)
        .await?;
    let done: Vec<(String,)> = sqlx::query_as(
        "SELECT exercise_id FROM exercise_progress WHERE user_id=$1 AND completed_at IS NOT NULL",
    )
    .bind(user)
    .fetch_all(&mut **tx)
    .await?;
    let completed: HashSet<String> = done.into_iter().map(|r| r.0).collect();
    if !completed.contains(&exercise.id) && !unlocked(catalog(), &exercise.id, &completed) {
        return Err(ApiError(StatusCode::CONFLICT));
    }
    let row: Row = sqlx::query_as("INSERT INTO exercise_progress(user_id,exercise_id) VALUES($1,$2) ON CONFLICT(user_id,exercise_id) DO UPDATE SET updated_at=exercise_progress.updated_at RETURNING exercise_id,attempts,hint_used,points,completed_at IS NOT NULL AS completed")
        .bind(user).bind(&exercise.id).fetch_one(&mut **tx).await?;
    Ok(row)
}

fn find(id: &str) -> Result<&'static Exercise, ApiError> {
    catalog()
        .exercises
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
    require(&actor, "mahasiswa")?;
    let exercise = find(&id)?;
    if request.answer.trim().is_empty() || request.answer.len() > 200 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }
    let mut tx = state.pool.begin().await?;
    let row = lock_open(&mut tx, actor.id, exercise).await?;
    if row.completed {
        tx.commit().await?;
        return Ok(Json(AnswerResult {
            correct: true,
            earned: row.points,
            attempts: row.attempts,
            explanation: Some(exercise.explanation.clone()),
        }));
    }
    let attempts = row.attempts + 1;
    let correct = is_correct(exercise, &request.answer);
    let earned = if correct {
        award(
            level_points(catalog(), exercise.level),
            attempts,
            row.hint_used,
        )
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
        explanation: correct.then(|| exercise.explanation.clone()),
    }))
}

pub async fn reveal_hint(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require(&actor, "mahasiswa")?;
    let exercise = find(&id)?;
    let mut tx = state.pool.begin().await?;
    let row = lock_open(&mut tx, actor.id, exercise).await?;
    if !row.completed {
        sqlx::query("UPDATE exercise_progress SET hint_used=true,updated_at=now() WHERE user_id=$1 AND exercise_id=$2")
            .bind(actor.id).bind(&exercise.id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "hint": exercise.hint })))
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
        let lecturer = serde_json::to_value(lecturer_view()).unwrap();
        assert_eq!(
            lecturer["tracks"][0]["exercises"][0]["key"]["answers"][0],
            "b"
        );
    }
}
