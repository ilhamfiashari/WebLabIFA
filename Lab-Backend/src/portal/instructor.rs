use super::*;
use crate::{
    ApiError, AppState, identity, seed,
    simulator_catalog::{LevelId, all_labs, find_lab, owasp_categories},
    verify_mutation,
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::FromRow;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct InstructorQuery {
    pub class_id: Option<String>,
}

#[derive(FromRow)]
pub(super) struct ClassRow {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) course: String,
    pub(super) semester: String,
    pub(super) timezone: String,
    pub(super) leaderboard_enabled: bool,
    pub(super) active: bool,
}

#[derive(FromRow)]
pub(super) struct StudentProgressRow {
    pub(super) session_id: Option<Uuid>,
    pub(super) user_id: Uuid,
    pub(super) class_id: String,
    pub(super) name: String,
    pub(super) email: String,
    pub(super) lab_id: Option<String>,
    pub(super) level_id: Option<String>,
    pub(super) current_step: Option<String>,
    pub(super) score: Option<i32>,
    pub(super) passed: Option<bool>,
    pub(super) reflection_submitted: Option<bool>,
    pub(super) updated_at: Option<DateTime<Utc>>,
}

#[derive(FromRow)]
pub(super) struct StudentXpRow {
    pub(super) user_id: Uuid,
    pub(super) total_xp: i64,
    pub(super) badges_count: i64,
}

/// Bangun daftar peringkat leaderboard yang konsisten untuk dashboard Dosen dan Mahasiswa.
pub(super) fn build_leaderboard(
    rows: &[StudentProgressRow],
    xp_map: &HashMap<Uuid, (i64, i64)>,
    viewer_id: Option<Uuid>,
    include_email: bool,
) -> Vec<Value> {
    struct LeaderAgg {
        user_id: Uuid,
        name: String,
        email: String,
        class_id: String,
        total_xp: i64,
        badges_count: i64,
        levels_passed: usize,
        web_passed: usize,
        iot_passed: usize,
        scores: Vec<i32>,
        last_active_at: Option<DateTime<Utc>>,
    }
    let mut agg_map: HashMap<Uuid, LeaderAgg> = HashMap::new();
    for r in rows {
        let (xp, badges) = xp_map.get(&r.user_id).copied().unwrap_or((0, 0));
        let entry = agg_map.entry(r.user_id).or_insert_with(|| LeaderAgg {
            user_id: r.user_id,
            name: r.name.clone(),
            email: r.email.clone(),
            class_id: r.class_id.clone(),
            total_xp: xp,
            badges_count: badges,
            levels_passed: 0,
            web_passed: 0,
            iot_passed: 0,
            scores: Vec::new(),
            last_active_at: r.updated_at,
        });
        if r.passed == Some(true) {
            entry.levels_passed += 1;
            if let Some(lid) = r.lab_id.as_deref()
                && let Some(lab) = find_lab(lid)
            {
                if lab.track == "iot" {
                    entry.iot_passed += 1;
                } else {
                    entry.web_passed += 1;
                }
            }
        }
        if let Some(sc) = r.score {
            entry.scores.push(sc);
        }
        if let Some(dt) = r.updated_at
            && entry.last_active_at.is_none_or(|cur| dt > cur)
        {
            entry.last_active_at = Some(dt);
        }
    }
    let mut leaders: Vec<LeaderAgg> = agg_map.into_values().collect();
    leaders.sort_by(|a, b| {
        let avg_a = if a.scores.is_empty() {
            0.0
        } else {
            a.scores.iter().sum::<i32>() as f64 / a.scores.len() as f64
        };
        let avg_b = if b.scores.is_empty() {
            0.0
        } else {
            b.scores.iter().sum::<i32>() as f64 / b.scores.len() as f64
        };
        b.total_xp
            .cmp(&a.total_xp)
            .then_with(|| b.levels_passed.cmp(&a.levels_passed))
            .then_with(|| avg_b.total_cmp(&avg_a))
            .then_with(|| a.name.cmp(&b.name))
    });
    leaders
        .into_iter()
        .enumerate()
        .map(|(idx, l)| {
            let avg = if l.scores.is_empty() {
                0.0
            } else {
                ((l.scores.iter().sum::<i32>() as f64 / l.scores.len() as f64) * 10.0).round()
                    / 10.0
            };
            let nim = l
                .email
                .strip_suffix("@student.itera.ac.id")
                .map(String::from);
            let is_self = viewer_id == Some(l.user_id);
            let email_val = if include_email || is_self {
                l.email.clone()
            } else {
                nim.as_deref()
                    .map(|n| format!("{n}@student.itera.ac.id"))
                    .unwrap_or_else(|| "mahasiswa@itera.ac.id".to_string())
            };
            json!({
                "rank": idx + 1,
                "user_id": l.user_id,
                "name": l.name,
                "email": email_val,
                "nim": nim,
                "class_id": l.class_id,
                "xp": l.total_xp,
                "total_xp": l.total_xp,
                "badges_count": l.badges_count,
                "levels_passed": l.levels_passed,
                "web_passed": l.web_passed,
                "iot_passed": l.iot_passed,
                "sessions_completed": l.levels_passed,
                "avg_score": avg,
                "graded_count": l.scores.len(),
                "last_active": l.last_active_at,
                "is_self": is_self,
            })
        })
        .collect()
}

pub async fn instructor_dashboard(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<InstructorQuery>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "dosen")?;
    ensure_default_assignments(&state.pool, actor.id, &actor.role).await?;

    let assigned_classes: Vec<ClassRow> = sqlx::query_as(
        "SELECT c.id,c.name,c.course,c.semester,c.timezone,c.leaderboard_enabled,c.active FROM classes c JOIN class_memberships m ON m.class_id=c.id WHERE m.user_id=$1 AND m.role_in_class='dosen' ORDER BY c.id",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    if assigned_classes.is_empty() {
        return Ok(Json(json!({
            "classes": [],
            "selected_class": null,
            "kpis": { "students_enrolled": 0, "active_students": 0, "assignments_passed": 0, "assignments_total": 0, "avg_score": null },
            "assignments": [],
            "student_rows": [],
            "score_histogram": [],
            "leaderboard": [],
            "weekly_activity": [],
            "track_breakdown": { "web_sessions": 0, "iot_sessions": 0, "web_passed": 0, "iot_passed": 0, "web_avg": null, "iot_avg": null },
            "owasp_mastery": [],
            "failing_checks": [],
        })));
    }

    let req_class = q.class_id.as_deref().unwrap_or("");
    let all_mode = req_class == "ALL";
    let selected_class = if all_mode {
        "ALL".to_string()
    } else if assigned_classes.iter().any(|c| c.id == req_class) {
        req_class.to_string()
    } else {
        assigned_classes[0].id.clone()
    };

    let target_class_ids: Vec<String> = if all_mode {
        assigned_classes.iter().map(|c| c.id.clone()).collect()
    } else {
        verify_lecturer_class(&state.pool, actor.id, &selected_class).await?;
        vec![selected_class.clone()]
    };

    let assignments: Vec<student::AssignmentRow> = sqlx::query_as(
        "SELECT id,class_id,title,lab_id,required_level,due_at,pass_threshold FROM assignments WHERE class_id=ANY($1) ORDER BY due_at ASC",
    )
    .bind(&target_class_ids)
    .fetch_all(&state.pool)
    .await?;

    let rows: Vec<StudentProgressRow> = sqlx::query_as(
        "SELECT s.id AS session_id,u.id AS user_id,m.class_id,u.name,u.email,s.lab_id,s.level_id,s.current_step,s.score,s.passed,s.reflection_submitted,s.updated_at FROM class_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN lab_sessions s ON s.user_id=u.id WHERE m.class_id=ANY($1) AND m.role_in_class='mahasiswa' ORDER BY u.name,s.updated_at DESC",
    )
    .bind(&target_class_ids)
    .fetch_all(&state.pool)
    .await?;

    let xp_rows: Vec<StudentXpRow> = sqlx::query_as(
        "SELECT a.user_id, COALESCE(SUM(a.xp),0)::bigint AS total_xp, COUNT(*) FILTER (WHERE a.achievement_key LIKE 'badge:%')::bigint AS badges_count FROM lab_achievements a JOIN class_memberships m ON m.user_id=a.user_id WHERE m.class_id=ANY($1) AND m.role_in_class='mahasiswa' GROUP BY a.user_id",
    )
    .bind(&target_class_ids)
    .fetch_all(&state.pool)
    .await?;
    let xp_map: HashMap<Uuid, (i64, i64)> = xp_rows
        .into_iter()
        .map(|r| (r.user_id, (r.total_xp, r.badges_count)))
        .collect();

    let unique_students: HashSet<Uuid> = rows.iter().map(|r| r.user_id).collect();
    let active_students: HashSet<Uuid> = rows
        .iter()
        .filter(|r| r.session_id.is_some())
        .map(|r| r.user_id)
        .collect();
    let graded_scores: Vec<i32> = rows.iter().filter_map(|r| r.score).collect();
    let avg_score = if graded_scores.is_empty() {
        None
    } else {
        Some(graded_scores.iter().sum::<i32>() as f64 / graded_scores.len() as f64)
    };

    let mut buckets = [0i32; 4];
    let mut ungraded = 0i32;
    let mut web_sessions_total = 0i32;
    let mut iot_sessions_total = 0i32;
    let mut web_passed_total = 0i32;
    let mut iot_passed_total = 0i32;
    let mut web_scores: Vec<i32> = Vec::new();
    let mut iot_scores: Vec<i32> = Vec::new();

    for r in &rows {
        if r.session_id.is_some() {
            match r.score {
                Some(0..=59) => buckets[0] += 1,
                Some(60..=79) => buckets[1] += 1,
                Some(80..=89) => buckets[2] += 1,
                Some(90..=100) => buckets[3] += 1,
                _ => ungraded += 1,
            }
            if let Some(lid) = r.lab_id.as_deref()
                && let Some(lab) = find_lab(lid)
            {
                if lab.track == "iot" {
                    iot_sessions_total += 1;
                    if r.passed == Some(true) {
                        iot_passed_total += 1;
                    }
                    if let Some(sc) = r.score {
                        iot_scores.push(sc);
                    }
                } else {
                    web_sessions_total += 1;
                    if r.passed == Some(true) {
                        web_passed_total += 1;
                    }
                    if let Some(sc) = r.score {
                        web_scores.push(sc);
                    }
                }
            }
        }
    }

    // Agregasi status per tugas
    let assignment_progress: Vec<Value> = assignments
        .iter()
        .map(|a| {
            let mut not_started = 0;
            let mut running = 0;
            let mut passed = 0;
            for sid in &unique_students {
                let s = rows.iter().find(|r| {
                    r.user_id == *sid
                        && r.lab_id.as_deref() == Some(&a.lab_id)
                        && r.level_id.as_deref() == Some(&a.required_level)
                });
                match s {
                    Some(r) if r.passed == Some(true) => passed += 1,
                    Some(_) => running += 1,
                    None => not_started += 1,
                }
            }
            json!({
                "id": a.id,
                "title": a.title,
                "lab_id": a.lab_id,
                "required_level": a.required_level,
                "due_at": a.due_at,
                "pass_threshold": a.pass_threshold,
                "not_started": not_started,
                "running": running,
                "passed": passed,
                "denominator": unique_students.len(),
            })
        })
        .collect();

    let leaderboard_json = build_leaderboard(&rows, &xp_map, None, true);

    // Tren aktivitas 7 hari terakhir
    let mut day_total: HashMap<String, i32> = HashMap::new();
    let mut day_passed: HashMap<String, i32> = HashMap::new();
    for r in &rows {
        if let Some(dt) = r.updated_at {
            let key = dt.format("%d %b").to_string();
            *day_total.entry(key.clone()).or_insert(0) += 1;
            if r.passed == Some(true) {
                *day_passed.entry(key).or_insert(0) += 1;
            }
        }
    }
    let today = Utc::now();
    let weekly_activity: Vec<Value> = (0..7)
        .rev()
        .map(|d| {
            let day = today - chrono::Duration::days(d);
            let label = day.format("%d %b").to_string();
            let sess = day_total.get(&label).copied().unwrap_or(0);
            json!({
                "label": label,
                "value": sess,
                "sessions": sess,
                "passed": day_passed.get(&label).copied().unwrap_or(0),
            })
        })
        .collect();

    // Penguasaan kategori OWASP & IoT oleh kelas
    let mut owasp_mastery: Vec<Value> = owasp_categories()
        .iter()
        .map(|cat| {
            let mut passed_count = 0usize;
            let mut total_attempts = 0usize;
            for r in &rows {
                if r.lab_id
                    .as_deref()
                    .and_then(find_lab)
                    .and_then(|l| l.owasp_code)
                    == Some(cat.code)
                {
                    total_attempts += 1;
                    if r.passed == Some(true) {
                        passed_count += 1;
                    }
                }
            }
            json!({
                "code": cat.code,
                "title": cat.name,
                "name": cat.name,
                "passed_count": passed_count,
                "total_attempts": total_attempts,
            })
        })
        .collect();
    owasp_mastery.push(json!({
        "code": "IoT",
        "title": "IoT Studio Security",
        "name": "IoT Studio Security",
        "passed_count": iot_passed_total,
        "total_attempts": iot_sessions_total,
    }));

    let avg_vec = |vals: &[i32]| -> Option<f64> {
        if vals.is_empty() {
            None
        } else {
            Some(((vals.iter().sum::<i32>() as f64 / vals.len() as f64) * 10.0).round() / 10.0)
        }
    };

    Ok(Json(json!({
        "classes": assigned_classes.iter().map(|c| json!({
            "id": c.id, "name": c.name, "course": c.course, "semester": c.semester, "timezone": c.timezone,
        })).collect::<Vec<_>>(),
        "selected_class": selected_class,
        "kpis": {
            "students_enrolled": unique_students.len(),
            "active_students": active_students.len(),
            "assignments_passed": rows.iter().filter(|r| r.passed == Some(true)).count(),
            "assignments_total": assignments.len() * unique_students.len().max(1),
            "avg_score": avg_score.map(|v| (v * 10.0).round() / 10.0),
        },
        "assignments": assignment_progress,
        "score_histogram": [
            { "label": "0–59", "count": buckets[0] },
            { "label": "60–79", "count": buckets[1] },
            { "label": "80–89", "count": buckets[2] },
            { "label": "90–100", "count": buckets[3] },
        ],
        "ungraded_count": ungraded,
        "leaderboard": leaderboard_json,
        "weekly_activity": weekly_activity,
        "track_breakdown": {
            "web_sessions": web_sessions_total,
            "iot_sessions": iot_sessions_total,
            "web_passed": web_passed_total,
            "iot_passed": iot_passed_total,
            "web_avg": avg_vec(&web_scores),
            "iot_avg": avg_vec(&iot_scores),
        },
        "owasp_mastery": owasp_mastery,
        "student_rows": rows.iter().map(|r| {
            let track = r.lab_id.as_deref().and_then(find_lab).map(|l| l.track);
            json!({
                "session_id": r.session_id,
                "user_id": r.user_id,
                "class_id": r.class_id,
                "track": track,
                "name": r.name,
                "email": r.email,
                "lab_id": r.lab_id,
                "level_id": r.level_id,
                "current_step": r.current_step,
                "score": r.score,
                "passed": r.passed.unwrap_or(false),
                "reflection_submitted": r.reflection_submitted.unwrap_or(false),
                "updated_at": r.updated_at,
            })
        }).collect::<Vec<_>>(),
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateAssignmentRequest {
    pub class_id: String,
    pub title: String,
    pub lab_id: String,
    pub required_level: String,
    pub due_in_days: i64,
    pub pass_threshold: i32,
}

pub async fn create_assignment(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<CreateAssignmentRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "dosen")?;
    verify_lecturer_class(&state.pool, actor.id, &req.class_id).await?;
    if find_lab(&req.lab_id).is_none()
        || LevelId::parse(&req.required_level).is_none()
        || req.title.trim().is_empty()
        || req.title.len() > 140
        || !(1..=100).contains(&req.pass_threshold)
        || !(1..=180).contains(&req.due_in_days)
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO assignments(id,class_id,title,lab_id,required_level,due_at,pass_threshold,created_by) VALUES($1,$2,$3,$4,$5,now()+($6 || ' days')::interval,$7,$8)",
    )
    .bind(id)
    .bind(&req.class_id)
    .bind(req.title.trim())
    .bind(&req.lab_id)
    .bind(&req.required_level)
    .bind(req.due_in_days.to_string())
    .bind(req.pass_threshold)
    .bind(actor.id)
    .execute(&state.pool)
    .await?;

    Ok(Json(
        json!({ "id": id, "class_id": req.class_id, "title": req.title.trim() }),
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FeedbackRequest {
    pub comment: String,
}

pub async fn add_session_feedback(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(req): Json<FeedbackRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "dosen")?;
    if req.comment.trim().is_empty() || req.comment.len() > 1000 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }
    let row = sessions::load_owned_session(&state.pool, &actor, session_id).await?;
    let shared: Option<(String,)> = sqlx::query_as(
        "SELECT m1.class_id FROM class_memberships m1 JOIN class_memberships m2 ON m1.class_id=m2.class_id WHERE m1.user_id=$1 AND m1.role_in_class='dosen' AND m2.user_id=$2 AND m2.role_in_class='mahasiswa' LIMIT 1",
    )
    .bind(actor.id)
    .bind(row.user_id)
    .fetch_optional(&state.pool)
    .await?;
    if shared.is_none() {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }

    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO lab_feedback(id,session_id,lecturer_id,comment) VALUES($1,$2,$3,$4)")
        .bind(id)
        .bind(session_id)
        .bind(actor.id)
        .bind(req.comment.trim())
        .execute(&state.pool)
        .await?;

    Ok(Json(json!({ "id": id, "comment": req.comment.trim() })))
}

pub async fn export_class_csv(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<InstructorQuery>,
) -> Result<Response, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "dosen")?;
    let class_id = q
        .class_id
        .ok_or(ApiError(StatusCode::UNPROCESSABLE_ENTITY))?;

    let rows: Vec<StudentProgressRow> = if class_id == "ALL" {
        let assigned: Vec<(String,)> = sqlx::query_as(
            "SELECT class_id FROM class_memberships WHERE user_id=$1 AND role_in_class='dosen'",
        )
        .bind(actor.id)
        .fetch_all(&state.pool)
        .await?;
        let cids: Vec<String> = assigned.into_iter().map(|c| c.0).collect();
        if cids.is_empty() {
            vec![]
        } else {
            sqlx::query_as(
                "SELECT s.id AS session_id,u.id AS user_id,m.class_id,u.name,u.email,s.lab_id,s.level_id,s.current_step,s.score,s.passed,s.reflection_submitted,s.updated_at FROM class_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN lab_sessions s ON s.user_id=u.id WHERE m.class_id=ANY($1) AND m.role_in_class='mahasiswa' ORDER BY m.class_id,u.name,s.updated_at DESC",
            )
            .bind(&cids)
            .fetch_all(&state.pool)
            .await?
        }
    } else {
        verify_lecturer_class(&state.pool, actor.id, &class_id).await?;
        sqlx::query_as(
            "SELECT s.id AS session_id,u.id AS user_id,m.class_id,u.name,u.email,s.lab_id,s.level_id,s.current_step,s.score,s.passed,s.reflection_submitted,s.updated_at FROM class_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN lab_sessions s ON s.user_id=u.id WHERE m.class_id=$1 AND m.role_in_class='mahasiswa' ORDER BY u.name,s.updated_at DESC",
        )
        .bind(&class_id)
        .fetch_all(&state.pool)
        .await?
    };

    let mut out = String::from("Kelas,Nama,Email,Lab,Level,Status,Nilai,Pembaruan\n");
    for r in rows {
        let status = if r.passed == Some(true) {
            "Lulus"
        } else if r.session_id.is_some() {
            "Berjalan"
        } else {
            "Belum mulai"
        };
        let line = [
            sanitize_csv_cell(&r.class_id),
            sanitize_csv_cell(&r.name),
            sanitize_csv_cell(&r.email),
            sanitize_csv_cell(r.lab_id.as_deref().unwrap_or("-")),
            sanitize_csv_cell(r.level_id.as_deref().unwrap_or("-")),
            sanitize_csv_cell(status),
            sanitize_csv_cell(&r.score.map_or_else(|| "-".into(), |v| v.to_string())),
            sanitize_csv_cell(&r.updated_at.map_or_else(|| "-".into(), |d| d.to_rfc3339())),
        ]
        .join(",");
        out.push_str(&line);
        out.push('\n');
    }

    Ok((
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/csv; charset=utf-8"),
            ),
            (
                header::CONTENT_DISPOSITION,
                HeaderValue::from_static("attachment; filename=\"laporan-kelas-ifa.csv\""),
            ),
        ],
        out,
    )
        .into_response())
}

pub async fn dosen_trigger_seed(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "dosen")?;
    let report = seed::seed_demo_data(&state.pool, Some(actor.id)).await?;
    Ok(Json(report.to_json()))
}

pub async fn admin_trigger_seed(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    require_role(&actor, "admin")?;
    let report = seed::seed_demo_data(&state.pool, Some(actor.id)).await?;
    Ok(Json(report.to_json()))
}

pub async fn instructor_labs_bank(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    require_role(&actor, "dosen")?;
    let labs: Vec<Value> = all_labs()
        .iter()
        .map(|l| {
            json!({
                "id": l.id,
                "track": l.track,
                "owasp_code": l.owasp_code,
                "title": l.title,
                "subtitle": l.subtitle,
                "cwe_id": l.cwe_id,
                "wstg_ref": l.wstg_ref,
                "asvs_ref": l.asvs_ref,
                "code_stacks": l.code_stacks,
                "patch_options": l.patch_options,
                "hints": l.hints,
                "levels": l.levels,
                "reflection": l.reflection,
            })
        })
        .collect();
    Ok(Json(json!({ "labs": labs })))
}
