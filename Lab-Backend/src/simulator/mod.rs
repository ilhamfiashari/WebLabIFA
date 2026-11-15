mod probes_a01_a04;
mod probes_a05;
mod probes_a06_a08;
mod probes_a09_a10;
mod probes_iot;
mod verify_rubric;

use probes_a01_a04::{sim_a01, sim_a02, sim_a03, sim_a04};
use probes_a05::{sim_a05_sqli, sim_a05_xss};
use probes_a06_a08::{sim_a06_coupon, sim_a07_auth, sim_a08_webhook};
use probes_a09_a10::{sim_a09_logging, sim_a10_checkout};
use probes_iot::{sim_iot_interlock, sim_iot_mqtt_acl, sim_iot_ota, sim_iot_replay};
pub use verify_rubric::{RubricInput, calculate_rubric, run_verification};

use crate::simulator_catalog::{LevelId, find_lab};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct ProbeInput {
    pub action: String,
    #[serde(default)]
    pub actor: String,
    #[serde(default)]
    pub target: String,
    #[serde(default)]
    pub payload: String,
    #[serde(default)]
    pub secondary: String,
    #[serde(default)]
    pub parallel: bool,
    #[serde(default)]
    pub advance_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct RequestPreview {
    pub method: String,
    pub path: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResponsePreview {
    pub status: u16,
    pub status_text: &'static str,
    pub headers: Vec<(String, String)>,
    pub body: String,
    pub correlation_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TraceStep {
    pub stage: String,
    pub component: String,
    pub decision: String,
    pub detail: String,
    pub tone: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProbeOutcome {
    pub request: RequestPreview,
    pub response: ResponsePreview,
    pub events: Vec<TraceStep>,
    pub visual_data: Value,
    pub baseline_captured: bool,
    pub exploit_proved: bool,
    pub is_legitimate: bool,
    pub updated_state: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationRow {
    pub case_id: String,
    pub category: String,
    pub scenario: String,
    pub input: String,
    pub expected: String,
    pub before_result: String,
    pub after_result: String,
    pub evidence: String,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct VerificationReport {
    pub rows: Vec<VerificationRow>,
    pub all_passed: bool,
    pub passed_count: usize,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct RubricBreakdown {
    pub pahami: i32,
    pub uji: i32,
    pub perbaiki: i32,
    pub verifikasi: i32,
    pub refleksi: i32,
    pub total: i32,
    pub passed: bool,
}

pub fn default_state(lab_id: &str, level: LevelId) -> Value {
    match lab_id {
        "a05-xss" => json!({ "comments": ["Selamat datang di forum praktikum keamanan!"] }),
        "a06-coupon" => json!({ "redeemed_by": [], "expired": false, "orders": [] }),
        "a07-auth" => {
            json!({ "attempts_by_ip": {}, "attempts_by_account": {}, "clock_min": 0, "used_tokens": [], "last_recovery_token": "rst-2026-rani" })
        }
        "a08-webhook" => {
            json!({ "order_status": "PENDING", "processed_events": [], "amount_paid": 0 })
        }
        "a09-logging" => json!({ "logs": [], "alerts": [], "sink_down": false }),
        "a10-checkout" => {
            json!({ "stock": 10, "orders": [], "idempotency": {}, "tx_mode": level.as_str() })
        }
        "iot-mqtt-acl" => json!({ "pump": "OFF", "moisture": 26, "broker_log": [] }),
        "iot-replay" => {
            json!({ "pump": "OFF", "clock_sec": 1000, "seen_nonces": ["n-1001"], "last_packet": { "cmd": "PUMP_ON", "ts": 1000, "nonce": "n-1001" } })
        }
        "iot-ota" => {
            json!({ "active_version": "v2.1.0", "min_version": "v2.1.0", "operational": true, "ota_log": [] })
        }
        "iot-interlock" => {
            json!({ "pump": "OFF", "moisture": 42, "online": true, "fault_latched": false })
        }
        _ => json!({ "level": level.as_str(), "probes": 0 }),
    }
}

pub(super) fn effective_patch<'a>(
    lab_id: &str,
    level: LevelId,
    selected: Option<&'a str>,
) -> &'a str {
    if level == LevelId::Impossible {
        return find_lab(lab_id)
            .and_then(|l| l.levels.iter().find(|lv| lv.level == LevelId::Impossible))
            .map_or("reference", |lv| lv.target_patch_id);
    }
    selected.unwrap_or("vulnerable")
}

pub(super) fn is_target_patch(lab_id: &str, patch: &str) -> bool {
    find_lab(lab_id)
        .and_then(|l| l.patch_options.iter().find(|p| p.id == patch))
        .is_some_and(|p| p.is_secure)
}

pub(super) fn status_text(code: u16) -> &'static str {
    match code {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        409 => "Conflict",
        422 => "Unprocessable Entity",
        429 => "Too Many Requests",
        500 => "Internal Server Error",
        502 => "Bad Gateway",
        _ => "Status",
    }
}

pub(super) fn trace(
    stage: &str,
    component: &str,
    decision: &str,
    detail: &str,
    tone: &'static str,
) -> TraceStep {
    TraceStep {
        stage: stage.into(),
        component: component.into(),
        decision: decision.into(),
        detail: detail.into(),
        tone,
    }
}

pub fn execute_probe(
    lab_id: &str,
    level: LevelId,
    selected_patch: Option<&str>,
    state: &Value,
    input: &ProbeInput,
) -> ProbeOutcome {
    let patch = effective_patch(lab_id, level, selected_patch);
    let cid = format!("req-{}", &Uuid::new_v4().to_string()[..8]);
    let mut next_state = state.clone();
    match lab_id {
        "a01-idor" => sim_a01(level, patch, &cid, next_state, input),
        "a02-misconfig" => sim_a02(level, patch, &cid, next_state, input),
        "a03-supply-chain" => sim_a03(level, patch, &cid, next_state, input),
        "a04-crypto" => sim_a04(level, patch, &cid, next_state, input),
        "a05-sqli" => sim_a05_sqli(level, patch, &cid, next_state, input),
        "a05-xss" => sim_a05_xss(level, patch, &cid, &mut next_state, input),
        "a06-coupon" => sim_a06_coupon(level, patch, &cid, &mut next_state, input),
        "a07-auth" => sim_a07_auth(level, patch, &cid, &mut next_state, input),
        "a08-webhook" => sim_a08_webhook(level, patch, &cid, &mut next_state, input),
        "a09-logging" => sim_a09_logging(level, patch, &cid, &mut next_state, input),
        "a10-checkout" => sim_a10_checkout(level, patch, &cid, &mut next_state, input),
        "iot-mqtt-acl" => sim_iot_mqtt_acl(level, patch, &cid, &mut next_state, input),
        "iot-replay" => sim_iot_replay(level, patch, &cid, &mut next_state, input),
        "iot-ota" => sim_iot_ota(level, patch, &cid, &mut next_state, input),
        "iot-interlock" => sim_iot_interlock(level, patch, &cid, &mut next_state, input),
        _ => ProbeOutcome {
            request: RequestPreview {
                method: "GET".into(),
                path: "/".into(),
                headers: vec![],
                body: String::new(),
            },
            response: ResponsePreview {
                status: 404,
                status_text: "Not Found",
                headers: vec![],
                body: "{}".into(),
                correlation_id: cid,
            },
            events: vec![],
            visual_data: json!({}),
            baseline_captured: false,
            exploit_proved: false,
            is_legitimate: false,
            updated_state: next_state,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulator_catalog::all_labs;

    #[test]
    fn all_60_lab_level_combinations_have_valid_controls_and_verification() {
        let labs = all_labs();
        let web_count = labs.iter().filter(|l| l.track == "web").count();
        let iot_count = labs.iter().filter(|l| l.track == "iot").count();
        assert_eq!(
            web_count, 11,
            "wajib minimal 11 lab Keamanan Web (A01-A10 dengan A05 terpisah)"
        );
        assert_eq!(iot_count, 4, "4 lab IoT Studio");

        for lab in labs {
            assert_eq!(lab.levels.len(), 4, "lab {} harus punya 4 level", lab.id);
            assert!(
                lab.code_stacks.len() >= 2,
                "lab {} harus punya >=2 stack pembanding",
                lab.id
            );
            let secure_patches: Vec<_> = lab.patch_options.iter().filter(|p| p.is_secure).collect();
            assert_eq!(
                secure_patches.len(),
                1,
                "lab {} harus punya 1 patch benar",
                lab.id
            );
            let secure_id = secure_patches[0].id;
            let decoy_id = lab.patch_options.iter().find(|p| !p.is_secure).unwrap().id;

            for lvl in LevelId::all() {
                let st = default_state(lab.id, lvl);
                // Patch benar harus meluluskan seluruh matriks verifikasi
                let pass_report = run_verification(lab.id, lvl, Some(secure_id), &st);
                assert!(
                    pass_report.all_passed,
                    "lab {} level {:?} gagal lulus dengan patch benar: {:?}",
                    lab.id, lvl, pass_report.rows
                );

                // Pada Easy..Hard, decoy patch wajib gagal verifikasi
                if lvl != LevelId::Impossible {
                    let fail_report = run_verification(lab.id, lvl, Some(decoy_id), &st);
                    assert!(
                        !fail_report.all_passed,
                        "lab {} level {:?} seharusnya gagal dengan decoy {}",
                        lab.id, lvl, decoy_id
                    );
                }
            }
        }
    }

    #[test]
    fn impossible_level_proves_audit_and_rejects_exploits() {
        for lab in all_labs() {
            let st = default_state(lab.id, LevelId::Impossible);
            let report = run_verification(lab.id, LevelId::Impossible, None, &st);
            assert!(report.all_passed, "Impossible audit gagal pada {}", lab.id);
        }
    }
}
