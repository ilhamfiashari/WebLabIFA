use super::*;
use crate::{
    ApiError, AppState, identity,
    simulator_catalog::{LevelId, all_labs, find_lab, owasp_categories},
};
use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use axum_extra::extract::cookie::CookieJar;
use serde_json::{Value, json};
use std::collections::HashMap;

pub async fn get_labs_catalog(
    State(state): State<AppState>,
    jar: CookieJar,
    Query(q): Query<CatalogQuery>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    let gamification_enabled = actor.role == "mahasiswa";
    let modules: Vec<ModuleRow> = sqlx::query_as("SELECT lab_id,status,version FROM lab_modules")
        .fetch_all(&state.pool)
        .await?;
    let mod_map: HashMap<String, (String, String)> = modules
        .into_iter()
        .map(|m| (m.lab_id, (m.status, m.version)))
        .collect();

    let sessions: Vec<SessionSummaryRow> = sqlx::query_as(
        "SELECT id,lab_id,level_id,current_step,score,passed,updated_at FROM lab_sessions WHERE user_id=$1 ORDER BY updated_at DESC",
    )
    .bind(actor.id)
    .fetch_all(&state.pool)
    .await?;

    let search = q.q.unwrap_or_default().trim().to_ascii_lowercase();
    let track_filter = q.track.unwrap_or_default();
    let cat_filter = q.category.unwrap_or_default();

    let labs_json: Vec<Value> = all_labs()
        .iter()
        .filter(|l| track_filter.is_empty() || l.track == track_filter)
        .filter(|l| cat_filter.is_empty() || l.owasp_code == Some(cat_filter.as_str()))
        .filter(|l| {
            search.is_empty()
                || l.title.to_ascii_lowercase().contains(&search)
                || l.subtitle.to_ascii_lowercase().contains(&search)
                || l.owasp_code
                    .unwrap_or("")
                    .to_ascii_lowercase()
                    .contains(&search)
                || l.cwe_id.to_ascii_lowercase().contains(&search)
        })
        .map(|l| {
            let (pub_status, version) = mod_map
                .get(l.id)
                .cloned()
                .unwrap_or_else(|| ("Terbit".into(), "1.0.0".into()));
            let levels_progress: Vec<Value> = LevelId::all()
                .iter()
                .map(|lv| {
                    let s_list: Vec<_> = sessions
                        .iter()
                        .filter(|s| s.lab_id == l.id && s.level_id == lv.as_str())
                        .collect();
                    let passed = s_list.iter().any(|s| s.passed);
                    let best_score = s_list.iter().filter_map(|s| s.score).max();
                    let active = s_list.first();
                    let (unlocked, unlock_requirement) =
                        level_unlock_status(&actor.role, l.id, *lv, &sessions);
                    json!({
                        "level": lv.as_str(),
                        "label": lv.label(),
                        "xp": if gamification_enabled { lv.base_xp() } else { 0 },
                        "passed": passed,
                        "unlocked": unlocked,
                        "unlock_requirement": unlock_requirement,
                        "best_score": best_score,
                        "active_session_id": active.map(|a| a.id),
                        "current_step": active.map(|a| a.current_step.as_str()),
                    })
                })
                .collect();
            let passed_levels = levels_progress
                .iter()
                .filter(|x| x["passed"].as_bool() == Some(true))
                .count();
            json!({
                "id": l.id,
                "track": l.track,
                "owasp_code": l.owasp_code,
                "title": l.title,
                "subtitle": l.subtitle,
                "objective": l.objective,
                "cwe_id": l.cwe_id,
                "wstg_ref": l.wstg_ref,
                "asvs_ref": l.asvs_ref,
                "estimated_minutes": l.estimated_minutes,
                "prerequisite": l.prerequisite,
                "publication_status": pub_status,
                "version": version,
                "passed_levels": passed_levels,
                "total_levels": 4,
                "levels": levels_progress,
            })
        })
        .collect();

    Ok(Json(json!({
        "gamification_enabled": gamification_enabled,
        "categories": owasp_categories(),
        "labs": labs_json,
        "recent_session": sessions.first().map(|s| json!({
            "id": s.id,
            "lab_id": s.lab_id,
            "level_id": s.level_id,
            "current_step": s.current_step,
            "updated_at": s.updated_at,
        })),
    })))
}

pub async fn get_lab_detail(
    State(state): State<AppState>,
    jar: CookieJar,
    Path(lab_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let actor = identity(&state, &jar).await?;
    let lab = find_lab(&lab_id).ok_or(ApiError(StatusCode::NOT_FOUND))?;
    let is_reviewer = actor.role == "dosen" || actor.role == "admin";
    let gamification_enabled = actor.role == "mahasiswa";

    let sessions: Vec<SessionSummaryRow> = sqlx::query_as(
        "SELECT id,lab_id,level_id,current_step,score,passed,updated_at FROM lab_sessions WHERE user_id=$1 AND lab_id=$2 ORDER BY updated_at DESC",
    )
    .bind(actor.id)
    .bind(&lab_id)
    .fetch_all(&state.pool)
    .await?;

    let levels_json: Vec<Value> = lab
        .levels
        .iter()
        .map(|lv| {
            let matching: Vec<_> = sessions
                .iter()
                .filter(|s| s.level_id == lv.level.as_str())
                .collect();
            let passed = matching.iter().any(|s| s.passed);
            let latest = matching.first();
            let (unlocked, unlock_requirement) =
                level_unlock_status(&actor.role, lab.id, lv.level, &sessions);
            json!({
                "level": lv.level.as_str(),
                "label": lv.level.label(),
                "xp": if gamification_enabled { lv.level.base_xp() } else { 0 },
                "title": lv.title,
                "scenario": lv.scenario,
                "initial_control": lv.initial_control,
                "expected_baseline": lv.expected_baseline,
                "expected_exploit": lv.expected_exploit,
                "passed": passed,
                "unlocked": unlocked,
                "unlock_requirement": unlock_requirement,
                "best_score": matching.iter().filter_map(|s| s.score).max(),
                "active_session_id": latest.map(|s| s.id),
                "current_step": latest.map(|s| s.current_step.as_str()),
            })
        })
        .collect();

    Ok(Json(json!({
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
        "estimated_minutes": lab.estimated_minutes,
        "prerequisite": lab.prerequisite,
        "fixture_actors": lab.fixture_actors,
        "trust_nodes": lab.trust_nodes,
        "trust_edges": lab.trust_edges,
        "code_stacks": lab.code_stacks,
        "levels": levels_json,
        "gamification_enabled": gamification_enabled,
        "solution_unlocked": is_reviewer || sessions.iter().any(|s| s.passed),
        "official_summary": if is_reviewer || sessions.iter().any(|s| s.passed) { Some(lab.reflection.official_summary) } else { None },
    })))
}
