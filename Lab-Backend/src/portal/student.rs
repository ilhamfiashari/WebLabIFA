use super::*;
use crate::{
    ApiError, AppState, identity,
    simulator_catalog::{LevelId, all_labs, find_lab, owasp_categories},
};
use axum::{
    Json,
    extract::{Query, State},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::FromRow;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

#[derive(FromRow)]
struct AchievementRow {
    achievement_key: String,
    xp: i32,
}

#[derive(FromRow)]
pub(super) struct AssignmentRow {
    pub(super) id: Uuid,
    pub(super) class_id: String,
    pub(super) title: String,
    pub(super) lab_id: String,
    pub(super) track: String,
    pub(super) required_level: String,
    pub(super) due_at: DateTime<Utc>,
    pub(super) pass_threshold: i32,
    pub(super) allow_hints: bool,
    pub(super) description: String,
    pub(super) instructions: String,
    pub(super) rubric_json: Value,
    pub(super) attachment_url: Option<String>,
    pub(super) max_attempts: i32,
    pub(super) allow_late: bool,
}

pub async fn student_dashboard(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "mahasiswa")?;
    ensure_default_assignments(&state.pool, actor.id, &actor.role).await?;

    let sessions: Vec<sessions::FullSessionRow> = sqlx::query_as(
        "SELECT id,user_id,lab_id,level_id,scenario_version,current_step,selected_patch,hypothesis,diagnosis,hints_opened,baseline_recorded,exploit_proved,verification_passed,reflection_submitted,score,passed,state_json,verification_json,reflection_json,row_version,started_at,updated_at,completed_at FROM lab_sessions WHERE user_id=$1 ORDER BY updated_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let achievements: Vec<AchievementRow> = sqlx::query_as(
        "SELECT achievement_key,xp FROM lab_achievements WHERE user_id=$1 ORDER BY earned_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let total_xp: i32 = achievements.iter().map(|a| a.xp).sum();
    let passed_pairs: HashSet<(&str, &str)> = sessions
        .iter()
        .filter(|s| s.passed)
        .map(|s| (s.lab_id.as_str(), s.level_id.as_str()))
        .collect();

    let labs = all_labs();
    let completed_labs = labs
        .iter()
        .filter(|l| {
            LevelId::all()
                .iter()
                .all(|lv| passed_pairs.contains(&(l.id, lv.as_str())))
        })
        .count();

    let settings = crate::latihan::load_platform_settings(&state.pool).await;
    let assignments: Vec<AssignmentRow> = sqlx::query_as(
        "SELECT a.id,a.class_id,a.title,a.lab_id,a.track,a.required_level,a.due_at,a.pass_threshold,a.allow_hints,a.description,a.instructions,a.rubric_json,a.attachment_url,a.max_attempts,a.allow_late FROM assignments a JOIN class_memberships m ON m.class_id=a.class_id WHERE m.user_id=$1 ORDER BY a.due_at ASC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let assignments_done = assignments
        .iter()
        .filter(|a| passed_pairs.contains(&(a.lab_id.as_str(), a.required_level.as_str())))
        .count();

    let now = Utc::now();
    let assignments_json: Vec<Value> = assignments
        .iter()
        .map(|a| {
            let matching_all: Vec<_> = sessions
                .iter()
                .filter(|s| s.lab_id == a.lab_id && s.level_id == a.required_level)
                .collect();
            let matching = matching_all.first();
            let is_passed = passed_pairs.contains(&(a.lab_id.as_str(), a.required_level.as_str()));
            let attempts_used = matching_all.len() as i32;
            let overdue = now > a.due_at;
            let locked_by_deadline = !is_passed
                && is_assignment_locked_by_deadline(
                    a.due_at,
                    now,
                    a.allow_late,
                    settings.strict_deadline_lock,
                );
            let locked_by_attempts =
                !is_passed && a.max_attempts > 0 && attempts_used >= a.max_attempts;
            let status = if is_passed {
                "Tuntas"
            } else if locked_by_deadline {
                "Terlambat"
            } else if matching.is_some() {
                "Berjalan"
            } else {
                "Belum mulai"
            };
            let lab_meta = find_lab(&a.lab_id);
            json!({
                "id": a.id,
                "class_id": a.class_id,
                "title": a.title,
                "lab_id": a.lab_id,
                "lab_title": lab_meta.map(|l| l.title).unwrap_or(a.lab_id.as_str()),
                "track": a.track,
                "track_label": track_display_label(&a.track),
                "required_level": a.required_level,
                "due_at": a.due_at,
                "pass_threshold": a.pass_threshold,
                "allow_hints": a.allow_hints && settings.allow_student_hints,
                "description": a.description,
                "instructions": a.instructions,
                "rubric": a.rubric_json,
                "attachment_url": a.attachment_url,
                "max_attempts": a.max_attempts,
                "attempts_used": attempts_used,
                "allow_late": a.allow_late,
                "overdue": overdue,
                "locked_by_deadline": locked_by_deadline,
                "locked_by_attempts": locked_by_attempts,
                "best_score": matching_all.iter().filter_map(|s| s.score).max(),
                "status": status,
                "session_id": matching.map(|m| m.id),
            })
        })
        .collect();

    let owasp_map: Vec<Value> = owasp_categories()
        .iter()
        .map(|cat| {
            let cat_labs: Vec<_> = labs
                .iter()
                .filter(|l| l.owasp_code == Some(cat.code))
                .collect();
            let total_levels = cat_labs.len() * 4;
            let done_levels = cat_labs
                .iter()
                .flat_map(|l| {
                    LevelId::all()
                        .into_iter()
                        .map(move |lv| (l.id, lv.as_str()))
                })
                .filter(|pair| passed_pairs.contains(pair))
                .count();
            let has_running = sessions
                .iter()
                .any(|s| cat_labs.iter().any(|l| l.id == s.lab_id));
            let status = if done_levels == total_levels && total_levels > 0 {
                "Tuntas"
            } else if done_levels > 0 || has_running {
                "Berjalan"
            } else {
                "Belum mulai"
            };
            json!({
                "code": cat.code,
                "name": cat.name,
                "done_levels": done_levels,
                "total_levels": total_levels,
                "status": status,
            })
        })
        .collect();

    // Grafik perkembangan nilai (sesi yang sudah punya skor)
    let score_series: Vec<Value> = sessions
        .iter()
        .filter_map(|s| {
            s.score.map(|sc| {
                json!({
                    "session_id": s.id,
                    "lab_id": s.lab_id,
                    "level_id": s.level_id,
                    "score": sc,
                    "passed": s.passed,
                    "date": s.updated_at.format("%d %b").to_string(),
                })
            })
        })
        .take(10)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();

    // Aktivitas level pertama kali lulus per hari (7 hari terakhir)
    let mut daily_counts: HashMap<String, i32> = HashMap::new();
    for s in sessions.iter().filter(|s| s.passed) {
        if let Some(dt) = s.completed_at {
            let key = dt.format("%d %b").to_string();
            *daily_counts.entry(key).or_insert(0) += 1;
        }
    }
    let today = Utc::now();
    let activity_series: Vec<Value> = (0..7)
        .rev()
        .map(|d| {
            let day = today - chrono::Duration::days(d);
            let label = day.format("%d %b").to_string();
            let val = daily_counts.get(&label).copied().unwrap_or(0);
            json!({ "label": label, "value": val })
        })
        .collect();

    let badges = vec![
        json!({ "id": "bukti-pertama", "title": "Bukti Pertama", "detail": "Lulus verifikasi & refleksi lab pertama.", "earned": achievements.iter().any(|a| a.achievement_key == "badge:bukti-pertama") }),
        json!({ "id": "perbaikan-teruji", "title": "Perbaikan Teruji", "detail": "Menerapkan kontrol patch server yang lolos regresi.", "earned": achievements.iter().any(|a| a.achievement_key == "badge:perbaikan-teruji") }),
        json!({ "id": "auditor-kontrol", "title": "Auditor Kontrol", "detail": "Menuntaskan level Impossible dengan audit penuh.", "earned": achievements.iter().any(|a| a.achievement_key == "badge:auditor-kontrol") }),
    ];

    Ok(Json(json!({
        "kpis": {
            "labs_completed": completed_labs,
            "labs_total": labs.len(),
            "levels_passed": passed_pairs.len(),
            "levels_total": labs.len() * 4,
            "assignments_done": assignments_done,
            "assignments_total": assignments.len(),
            "xp": total_xp,
        },
        "continue_session": sessions.first().map(|s| json!({
            "id": s.id,
            "lab_id": s.lab_id,
            "lab_title": find_lab(&s.lab_id).map_or(s.lab_id.as_str(), |l| l.title),
            "level_id": s.level_id,
            "current_step": s.current_step,
            "updated_at": s.updated_at,
        })),
        "activity_series": activity_series,
        "score_series": score_series,
        "owasp_map": owasp_map,
        "assignments": assignments_json,
        "badges": badges,
        "recent_sessions": sessions.iter().take(5).map(|s| json!({
            "id": s.id,
            "lab_id": s.lab_id,
            "lab_title": find_lab(&s.lab_id).map_or(s.lab_id.as_str(), |l| l.title),
            "level_id": s.level_id,
            "current_step": s.current_step,
            "score": s.score,
            "passed": s.passed,
            "updated_at": s.updated_at,
        })).collect::<Vec<_>>(),
    })))
}

pub async fn student_history(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "mahasiswa")?;

    let sessions: Vec<sessions::FullSessionRow> = sqlx::query_as(
        "SELECT id,user_id,lab_id,level_id,scenario_version,current_step,selected_patch,hypothesis,diagnosis,hints_opened,baseline_recorded,exploit_proved,verification_passed,reflection_submitted,score,passed,state_json,verification_json,reflection_json,row_version,started_at,updated_at,completed_at FROM lab_sessions WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let items: Vec<Value> = sessions
        .into_iter()
        .map(|s| {
            let lab = find_lab(&s.lab_id);
            json!({
                "id": s.id,
                "lab_id": s.lab_id,
                "lab_title": lab.map_or(s.lab_id.as_str(), |l| l.title),
                "owasp_code": lab.and_then(|l| l.owasp_code),
                "level_id": s.level_id,
                "current_step": s.current_step,
                "selected_patch": s.selected_patch,
                "score": s.score,
                "passed": s.passed,
                "verification": s.verification_json,
                "reflection": s.reflection_json,
                "updated_at": s.updated_at,
                "completed_at": s.completed_at,
            })
        })
        .collect();

    Ok(Json(json!({ "items": items })))
}

#[derive(Deserialize)]
pub struct StudentLeaderboardQuery {
    pub class_id: Option<String>,
}

/// Peringkat mahasiswa lintas kelas yang mengaktifkan leaderboard.
pub async fn student_leaderboard(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<StudentLeaderboardQuery>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "mahasiswa")?;
    ensure_default_assignments(&state.pool, actor.id, &actor.role).await?;

    let classes: Vec<instructor::ClassRow> = sqlx::query_as(
        "SELECT id,name,course,semester,timezone,leaderboard_enabled,active FROM classes WHERE active=true AND leaderboard_enabled=true ORDER BY id",
    )
    .fetch_all(&state.pool)
    .await?;

    if classes.is_empty() {
        return Ok(Json(json!({
            "classes": [],
            "selected_class": "ALL",
            "my_rank": { "rank": null, "total_students": 0, "xp": 0, "avg_score": 0.0, "levels_passed": 0, "badges_count": 0 },
            "entries": [],
        })));
    }

    let req_class = q.class_id.as_deref().unwrap_or("ALL");
    let selected_class = if req_class == "ALL" || !classes.iter().any(|c| c.id == req_class) {
        "ALL".to_string()
    } else {
        req_class.to_string()
    };

    let target_ids: Vec<String> = if selected_class == "ALL" {
        classes.iter().map(|c| c.id.clone()).collect()
    } else {
        vec![selected_class.clone()]
    };

    let rows: Vec<instructor::StudentProgressRow> = sqlx::query_as(
        "SELECT s.id AS session_id,u.id AS user_id,m.class_id,u.name,u.email,s.lab_id,s.level_id,s.current_step,s.score,s.passed,s.reflection_submitted,s.updated_at FROM class_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN lab_sessions s ON s.user_id=u.id WHERE m.class_id=ANY($1) AND m.role_in_class='mahasiswa' AND u.active=true ORDER BY u.name,s.updated_at DESC",
    )
    .bind(&target_ids)
    .fetch_all(&state.pool)
    .await?;

    let xp_rows: Vec<instructor::StudentXpRow> = sqlx::query_as(
        "SELECT a.user_id, COALESCE(SUM(a.xp),0)::bigint AS total_xp, COUNT(*) FILTER (WHERE a.achievement_key LIKE 'badge:%')::bigint AS badges_count FROM lab_achievements a JOIN class_memberships m ON m.user_id=a.user_id WHERE m.class_id=ANY($1) AND m.role_in_class='mahasiswa' GROUP BY a.user_id",
    )
    .bind(&target_ids)
    .fetch_all(&state.pool)
    .await?;
    let xp_map: HashMap<Uuid, (i64, i64)> = xp_rows
        .into_iter()
        .map(|r| (r.user_id, (r.total_xp, r.badges_count)))
        .collect();

    let entries = instructor::build_leaderboard(&rows, &xp_map, Some(actor.id), false);
    let total_students = entries.len();
    let my_rank = entries
        .iter()
        .find(|e| e.get("is_self").and_then(|v| v.as_bool()) == Some(true))
        .map(|e| {
            json!({
                "rank": e["rank"],
                "total_students": total_students,
                "xp": e["xp"],
                "avg_score": e["avg_score"],
                "levels_passed": e["levels_passed"],
                "badges_count": e["badges_count"],
            })
        })
        .unwrap_or_else(|| {
            json!({
                "rank": null,
                "total_students": total_students,
                "xp": 0,
                "avg_score": 0.0,
                "levels_passed": 0,
                "badges_count": 0,
            })
        });

    Ok(Json(json!({
        "classes": classes.iter().map(|c| json!({
            "id": c.id,
            "name": c.name,
            "course": c.course,
        })).collect::<Vec<_>>(),
        "selected_class": selected_class,
        "my_rank": my_rank,
        "entries": entries,
    })))
}
