use super::*;
use crate::{
    ApiError, AppState, Identity, identity,
    simulator::{
        ProbeInput, RubricInput, calculate_rubric, default_state, execute_probe, run_verification,
    },
    simulator_catalog::{LevelId, find_lab},
    verify_mutation,
};
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

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartSessionRequest {
    pub lab_id: String,
    pub level_id: String,
    #[serde(default)]
    pub force_new: bool,
}

#[derive(FromRow)]
pub(super) struct FullSessionRow {
    pub(super) id: Uuid,
    pub(super) user_id: Uuid,
    pub(super) lab_id: String,
    pub(super) level_id: String,
    pub(super) scenario_version: String,
    pub(super) current_step: String,
    pub(super) selected_patch: Option<String>,
    pub(super) hypothesis: Option<String>,
    pub(super) diagnosis: Option<String>,
    pub(super) hints_opened: i32,
    pub(super) baseline_recorded: bool,
    pub(super) exploit_proved: bool,
    pub(super) verification_passed: bool,
    pub(super) reflection_submitted: bool,
    pub(super) score: Option<i32>,
    pub(super) passed: bool,
    pub(super) state_json: Value,
    pub(super) verification_json: Value,
    pub(super) reflection_json: Value,
    pub(super) row_version: i32,
    pub(super) started_at: DateTime<Utc>,
    pub(super) updated_at: DateTime<Utc>,
    pub(super) completed_at: Option<DateTime<Utc>>,
}

pub async fn start_or_resume_session(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(req): Json<StartSessionRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let lab = find_lab(&req.lab_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let level = LevelId::parse(&req.level_id).ok_or(ApiError(StatusCode::UNPROCESSABLE_ENTITY))?;

    if actor.role == "mahasiswa" {
        let mod_status: Option<(String,)> =
            sqlx::query_as("SELECT status FROM lab_modules WHERE lab_id=$1")
                .bind(lab.id)
                .fetch_optional(&state.pool)
                .await?;
        if let Some((status,)) = mod_status
            && (status == "Draft" || status == "Rencana")
        {
            return Err(ApiError(StatusCode::FORBIDDEN));
        }
    }

    if actor.role == "mahasiswa"
        && let Some(prev) = previous_level(level)
    {
        let prev_passed: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM lab_sessions WHERE user_id=$1 AND lab_id=$2 AND level_id=$3 AND passed=true LIMIT 1",
        )
        .bind(actor.id)
        .bind(lab.id)
        .bind(prev.as_str())
        .fetch_optional(&state.pool)
        .await?;
        if prev_passed.is_none() {
            return Err(ApiError(StatusCode::CONFLICT));
        }
    }

    if !req.force_new {
        let existing: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM lab_sessions WHERE user_id=$1 AND lab_id=$2 AND level_id=$3 ORDER BY updated_at DESC LIMIT 1",
        )
        .bind(actor.id)
        .bind(lab.id)
        .bind(level.as_str())
        .fetch_optional(&state.pool)
        .await?;
        if let Some((id,)) = existing {
            return Ok(Json(json!({ "session_id": id, "resumed": true })));
        }
    }

    let id = Uuid::new_v4();
    let init_state = default_state(lab.id, level);
    let init_patch = if level == LevelId::Impossible {
        lab.levels
            .iter()
            .find(|l| l.level == LevelId::Impossible)
            .map(|l| l.target_patch_id)
    } else {
        None
    };

    sqlx::query(
        "INSERT INTO lab_sessions(id,user_id,lab_id,level_id,selected_patch,state_json) VALUES($1,$2,$3,$4,$5,$6)",
    )
    .bind(id)
    .bind(actor.id)
    .bind(lab.id)
    .bind(level.as_str())
    .bind(init_patch)
    .bind(&init_state)
    .execute(&state.pool)
    .await?;

    Ok(Json(json!({ "session_id": id, "resumed": false })))
}

pub(super) async fn load_owned_session(
    pool: &PgPool,
    actor: &Identity,
    session_id: Uuid,
) -> Result<FullSessionRow, ApiError> {
    let row: FullSessionRow = sqlx::query_as(
        "SELECT id,user_id,lab_id,level_id,scenario_version,current_step,selected_patch,hypothesis,diagnosis,hints_opened,baseline_recorded,exploit_proved,verification_passed,reflection_submitted,score,passed,state_json,verification_json,reflection_json,row_version,started_at,updated_at,completed_at FROM lab_sessions WHERE id=$1",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?
    .ok_or(ApiError(StatusCode::NOT_FOUND))?;

    if row.user_id != actor.id && actor.role != "dosen" && actor.role != "admin" {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    Ok(row)
}

pub(super) fn format_session_payload(
    row: &FullSessionRow,
    is_reviewer: bool,
    gamification_enabled: bool,
) -> Result<Value, ApiError> {
    let lab = find_lab(&row.lab_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let level = LevelId::parse(&row.level_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let level_spec = lab
        .levels
        .iter()
        .find(|l| l.level == level)
        .ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let unlock_solutions = is_reviewer || row.passed;

    let unlocked_hints: Vec<&str> = if is_reviewer {
        lab.hints.to_vec()
    } else {
        lab.hints
            .iter()
            .take(row.hints_opened.clamp(0, 3) as usize)
            .copied()
            .collect()
    };

    let patch_options: Vec<Value> = lab
        .patch_options
        .iter()
        .map(|p| {
            json!({
                "id": p.id,
                "label": p.label,
                "summary": p.summary,
                // Jangan membocorkan kunci is_secure ke Mahasiswa sebelum lulus atau dipilih/diverifikasi
                "is_secure": if unlock_solutions { Some(p.is_secure) } else { None },
                "feedback": if unlock_solutions || row.selected_patch.as_deref() == Some(p.id) && row.verification_passed { Some(p.feedback) } else { None },
            })
        })
        .collect();

    Ok(json!({
        "session": {
            "id": row.id,
            "lab_id": row.lab_id,
            "level_id": row.level_id,
            "level_label": level.label(),
            "xp_reward": if gamification_enabled { level.base_xp() } else { 0 },
            "gamification_enabled": gamification_enabled,
            "scenario_version": row.scenario_version,
            "current_step": row.current_step,
            "selected_patch": row.selected_patch,
            "hypothesis": row.hypothesis,
            "diagnosis": row.diagnosis,
            "hints_opened": row.hints_opened,
            "baseline_recorded": row.baseline_recorded,
            "exploit_proved": row.exploit_proved,
            "verification_passed": row.verification_passed,
            "reflection_submitted": row.reflection_submitted,
            "score": row.score,
            "passed": row.passed,
            "state": row.state_json,
            "verification": row.verification_json,
            "reflection": row.reflection_json,
            "row_version": row.row_version,
            "started_at": row.started_at,
            "updated_at": row.updated_at,
            "completed_at": row.completed_at,
        },
        "lab": {
            "id": lab.id,
            "track": lab.track,
            "owasp_code": lab.owasp_code,
            "title": lab.title,
            "subtitle": lab.subtitle,
            "objective": lab.objective,
            "context": lab.context,
            "cwe_id": lab.cwe_id,
            "wstg_ref": lab.wstg_ref,
            "asvs_ref": lab.asvs_ref,
            "fixture_actors": lab.fixture_actors,
            "trust_nodes": lab.trust_nodes,
            "trust_edges": lab.trust_edges,
            "code_stacks": lab.code_stacks,
            "patch_options": patch_options,
            "unlocked_hints": unlocked_hints,
            "total_hints": 3,
            "level_spec": {
                "title": level_spec.title,
                "scenario": level_spec.scenario,
                "initial_control": level_spec.initial_control,
                "pahami_prompt": level_spec.pahami_prompt,
                "hypothesis_options": level_spec.hypothesis_options,
                "probe_instruction": level_spec.probe_instruction,
                "diagnosis_options": level_spec.diagnosis_options,
                "expected_baseline": level_spec.expected_baseline,
                "expected_exploit": level_spec.expected_exploit,
                "correct_hypothesis": if unlock_solutions { Some(level_spec.correct_hypothesis) } else { None },
                "correct_diagnosis": if unlock_solutions { Some(level_spec.correct_diagnosis) } else { None },
            },
            "reflection_spec": {
                "root_cause_prompt": lab.reflection.root_cause_prompt,
                "evidence_prompt": lab.reflection.evidence_prompt,
                "transfer_question": lab.reflection.transfer_question,
                "official_summary": if unlock_solutions { Some(lab.reflection.official_summary) } else { None },
                "key_takeaways": if unlock_solutions { Some(&lab.reflection.key_takeaways) } else { None },
            },
        }
    }))
}

pub async fn get_session(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(session_id): Path<Uuid>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    let row = load_owned_session(&state.pool, &actor, session_id).await?;
    if row.user_id != actor.id && actor.role == "dosen" {
        // Pastikan mahasiswa berada di kelas yang ditugaskan ke dosen
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
    }
    Ok(Json(format_session_payload(
        &row,
        actor.role == "dosen" || actor.role == "admin",
        actor.role == "mahasiswa",
    )?))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StepUpdateRequest {
    pub row_version: i32,
    pub current_step: Option<String>,
    pub hypothesis: Option<String>,
    pub diagnosis: Option<String>,
    pub selected_patch: Option<String>,
}

pub async fn update_session_step(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(req): Json<StepUpdateRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let row = load_owned_session(&state.pool, &actor, session_id).await?;
    if row.user_id != actor.id {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let lab = find_lab(&row.lab_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    if let Some(ref patch) = req.selected_patch
        && !lab.patch_options.iter().any(|p| p.id == patch)
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }
    if let Some(ref step) = req.current_step
        && !matches!(
            step.as_str(),
            "pahami" | "uji" | "perbaiki" | "verifikasi" | "refleksi"
        )
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let next_step = req.current_step.unwrap_or(row.current_step);
    let next_hyp = req.hypothesis.or(row.hypothesis);
    let next_diag = req.diagnosis.or(row.diagnosis);
    let next_patch = if row.level_id == "impossible" {
        row.selected_patch
    } else {
        req.selected_patch.or(row.selected_patch)
    };

    let updated: Option<(i32,)> = sqlx::query_as(
        "UPDATE lab_sessions SET current_step=$1,hypothesis=$2,diagnosis=$3,selected_patch=$4,row_version=row_version+1,updated_at=now() WHERE id=$5 AND user_id=$6 AND row_version=$7 RETURNING row_version",
    )
    .bind(&next_step)
    .bind(&next_hyp)
    .bind(&next_diag)
    .bind(&next_patch)
    .bind(session_id)
    .bind(actor.id)
    .bind(req.row_version)
    .fetch_optional(&state.pool)
    .await?;

    let (new_ver,) = updated.ok_or(ApiError(StatusCode::CONFLICT))?;
    Ok(Json(
        json!({ "row_version": new_ver, "current_step": next_step, "selected_patch": next_patch }),
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProbeRequest {
    pub row_version: i32,
    pub input: ProbeInput,
}

pub async fn run_probe(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(req): Json<ProbeRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if req.input.payload.len() > 1000 || req.input.target.len() > 200 {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }
    let row = load_owned_session(&state.pool, &actor, session_id).await?;
    if row.user_id != actor.id {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let level = LevelId::parse(&row.level_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let outcome = execute_probe(
        &row.lab_id,
        level,
        row.selected_patch.as_deref(),
        &row.state_json,
        &req.input,
    );

    let baseline_recorded = row.baseline_recorded || outcome.baseline_captured;
    // Pada level Impossible, bukti kontrol tercapai bila pengguna menjalankan aksi sah maupun percobaan yang ditolak dengan benar.
    let exploit_proved = row.exploit_proved
        || outcome.exploit_proved
        || (level == LevelId::Impossible && outcome.response.status >= 400);

    let updated: Option<(i32,)> = sqlx::query_as(
        "UPDATE lab_sessions SET state_json=$1,baseline_recorded=$2,exploit_proved=$3,row_version=row_version+1,updated_at=now() WHERE id=$4 AND user_id=$5 AND row_version=$6 RETURNING row_version",
    )
    .bind(&outcome.updated_state)
    .bind(baseline_recorded)
    .bind(exploit_proved)
    .bind(session_id)
    .bind(actor.id)
    .bind(req.row_version)
    .fetch_optional(&state.pool)
    .await?;

    let (new_ver,) = updated.ok_or(ApiError(StatusCode::CONFLICT))?;
    Ok(Json(json!({
        "row_version": new_ver,
        "baseline_recorded": baseline_recorded,
        "exploit_proved": exploit_proved,
        "outcome": outcome,
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HintRequest {
    pub row_version: i32,
}

pub async fn open_hint(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(req): Json<HintRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let row = load_owned_session(&state.pool, &actor, session_id).await?;
    if row.user_id != actor.id {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let lab = find_lab(&row.lab_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let next_count = (row.hints_opened + 1).min(3);

    let updated: Option<(i32,)> = sqlx::query_as(
        "UPDATE lab_sessions SET hints_opened=$1,row_version=row_version+1,updated_at=now() WHERE id=$2 AND user_id=$3 AND row_version=$4 RETURNING row_version",
    )
    .bind(next_count)
    .bind(session_id)
    .bind(actor.id)
    .bind(req.row_version)
    .fetch_optional(&state.pool)
    .await?;

    let (new_ver,) = updated.ok_or(ApiError(StatusCode::CONFLICT))?;
    let unlocked: Vec<&str> = lab
        .hints
        .iter()
        .take(next_count as usize)
        .copied()
        .collect();
    Ok(Json(
        json!({ "row_version": new_ver, "hints_opened": next_count, "unlocked_hints": unlocked }),
    ))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct VerifyRequest {
    pub row_version: i32,
}

pub async fn verify_session(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(req): Json<VerifyRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let row = load_owned_session(&state.pool, &actor, session_id).await?;
    if row.user_id != actor.id {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let level = LevelId::parse(&row.level_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let report = run_verification(
        &row.lab_id,
        level,
        row.selected_patch.as_deref(),
        &default_state(&row.lab_id, level),
    );
    let ver_json = serde_json::to_value(&report.rows)
        .map_err(|_| ApiError(StatusCode::INTERNAL_SERVER_ERROR))?;

    let updated: Option<(i32,)> = sqlx::query_as(
        "UPDATE lab_sessions SET verification_passed=$1,verification_json=$2,current_step=CASE WHEN $1 THEN 'verifikasi' ELSE current_step END,row_version=row_version+1,updated_at=now() WHERE id=$3 AND user_id=$4 AND row_version=$5 RETURNING row_version",
    )
    .bind(report.all_passed)
    .bind(&ver_json)
    .bind(session_id)
    .bind(actor.id)
    .bind(req.row_version)
    .fetch_optional(&state.pool)
    .await?;

    let (new_ver,) = updated.ok_or(ApiError(StatusCode::CONFLICT))?;
    Ok(Json(json!({
        "row_version": new_ver,
        "report": report,
    })))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReflectRequest {
    pub row_version: i32,
    pub root_cause: String,
    pub evidence: String,
    pub transfer: String,
}

pub async fn submit_reflection(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(req): Json<ReflectRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if req.root_cause.trim().len() < 8
        || req.evidence.trim().len() < 8
        || req.transfer.trim().len() < 8
        || req.root_cause.len() > 2000
        || req.evidence.len() > 2000
        || req.transfer.len() > 2000
    {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY));
    }

    let mut tx = state.pool.begin().await?;
    let row: FullSessionRow = sqlx::query_as(
        "SELECT id,user_id,lab_id,level_id,scenario_version,current_step,selected_patch,hypothesis,diagnosis,hints_opened,baseline_recorded,exploit_proved,verification_passed,reflection_submitted,score,passed,state_json,verification_json,reflection_json,row_version,started_at,updated_at,completed_at FROM lab_sessions WHERE id=$1 FOR UPDATE",
    )
    .bind(session_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(ApiError(StatusCode::NOT_FOUND))?;

    if row.user_id != actor.id {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    if row.row_version != req.row_version {
        return Err(ApiError(StatusCode::CONFLICT));
    }

    let lab = find_lab(&row.lab_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let level = LevelId::parse(&row.level_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let level_spec = lab
        .levels
        .iter()
        .find(|l| l.level == level)
        .ok_or(ApiError(StatusCode::NOT_FOUND))?;

    let hyp_ok = row
        .hypothesis
        .as_deref()
        .and_then(|h| h.parse::<usize>().ok())
        .is_some_and(|idx| idx == level_spec.correct_hypothesis);
    let diag_ok = row
        .diagnosis
        .as_deref()
        .and_then(|d| d.parse::<usize>().ok())
        .is_some_and(|idx| idx == level_spec.correct_diagnosis);
    let patch_secure = level == LevelId::Impossible
        || row
            .selected_patch
            .as_deref()
            .is_some_and(|pid| lab.patch_options.iter().any(|p| p.id == pid && p.is_secure));

    let rubric = calculate_rubric(RubricInput {
        baseline_recorded: row.baseline_recorded,
        hypothesis_ok: hyp_ok,
        exploit_proved: row.exploit_proved,
        diagnosis_ok: diag_ok,
        patch_secure,
        verification_passed: row.verification_passed,
        reflection_submitted: true,
        threshold: 80,
    });

    let refl_json = json!({
        "root_cause": req.root_cause.trim(),
        "evidence": req.evidence.trim(),
        "transfer": req.transfer.trim(),
        "rubric": rubric,
    });

    let updated: (i32,) = sqlx::query_as(
        "UPDATE lab_sessions SET reflection_submitted=true,reflection_json=$1,score=$2,passed=$3,current_step='refleksi',completed_at=CASE WHEN $3 AND completed_at IS NULL THEN now() ELSE completed_at END,row_version=row_version+1,updated_at=now() WHERE id=$4 RETURNING row_version",
    )
    .bind(&refl_json)
    .bind(rubric.total)
    .bind(rubric.passed)
    .bind(session_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut newly_awarded_xp = 0;
    let mut unlocked_badges: Vec<&'static str> = vec![];
    if rubric.passed && actor.role == "mahasiswa" {
        let key = format!("lab:{}:{}", lab.id, level.as_str());
        let xp = level.base_xp();
        let inserted: Option<(String,)> = sqlx::query_as(
            "INSERT INTO lab_achievements(user_id,achievement_key,xp) VALUES($1,$2,$3) ON CONFLICT(user_id,achievement_key) DO NOTHING RETURNING achievement_key",
        )
        .bind(actor.id)
        .bind(&key)
        .bind(xp)
        .fetch_optional(&mut *tx)
        .await?;
        if inserted.is_some() {
            newly_awarded_xp += xp;
        }

        // Lencana berbasis kompetensi (idempoten via PK)
        let mut badge_keys = vec![("badge:bukti-pertama", "Bukti Pertama", 20)];
        if patch_secure {
            badge_keys.push(("badge:perbaikan-teruji", "Perbaikan Teruji", 30));
        }
        if level == LevelId::Impossible {
            badge_keys.push(("badge:auditor-kontrol", "Auditor Kontrol", 50));
        }
        for (bkey, btitle, bxp) in badge_keys {
            let b_ins: Option<(String,)> = sqlx::query_as(
                "INSERT INTO lab_achievements(user_id,achievement_key,xp) VALUES($1,$2,$3) ON CONFLICT(user_id,achievement_key) DO NOTHING RETURNING achievement_key",
            )
            .bind(actor.id)
            .bind(bkey)
            .bind(bxp)
            .fetch_optional(&mut *tx)
            .await?;
            if b_ins.is_some() {
                newly_awarded_xp += bxp;
                unlocked_badges.push(btitle);
            }
        }
    }

    tx.commit().await?;

    Ok(Json(json!({
        "row_version": updated.0,
        "rubric": rubric,
        "xp_awarded_now": newly_awarded_xp,
        "badges_unlocked_now": unlocked_badges,
        "official_summary": if rubric.passed { Some(lab.reflection.official_summary) } else { None },
        "key_takeaways": if rubric.passed { Some(&lab.reflection.key_takeaways) } else { None },
    })))
}

pub async fn reset_session(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
    Json(req): Json<HintRequest>,
) -> Result<Json<Value>, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    let row = load_owned_session(&state.pool, &actor, session_id).await?;
    if row.user_id != actor.id {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let level = LevelId::parse(&row.level_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let fresh_state = default_state(&row.lab_id, level);
    let init_patch = if level == LevelId::Impossible {
        row.selected_patch
    } else {
        None
    };

    let updated: Option<(i32,)> = sqlx::query_as(
        "UPDATE lab_sessions SET current_step='pahami',selected_patch=$1,baseline_recorded=false,exploit_proved=false,verification_passed=false,state_json=$2,verification_json='[]'::jsonb,row_version=row_version+1,updated_at=now() WHERE id=$3 AND user_id=$4 AND row_version=$5 RETURNING row_version",
    )
    .bind(&init_patch)
    .bind(&fresh_state)
    .bind(session_id)
    .bind(actor.id)
    .bind(req.row_version)
    .fetch_optional(&state.pool)
    .await?;

    let (new_ver,) = updated.ok_or(ApiError(StatusCode::CONFLICT))?;
    Ok(Json(
        json!({ "row_version": new_ver, "state": fresh_state }),
    ))
}
