pub mod config;
pub mod latihan;
pub mod oidc;
pub mod portal;
pub mod security_account;
pub mod seed;
pub mod simulator;
pub mod simulator_catalog;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Query, Request, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Redirect, Response},
    routing::{delete, get, post},
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use chrono::{DateTime, Utc};
use config::Config;
use openidconnect::{
    AuthorizationCode, CsrfToken, Nonce, PkceCodeChallenge, PkceCodeVerifier, Scope, TokenResponse,
    core::CoreAuthenticationFlow,
};
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool};
use std::sync::{Arc, Mutex};
use subtle::ConstantTimeEq;
use tracing::Instrument;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub pool: PgPool,
    pub oidc: Option<oidc::Oidc>,
    pub budget: Arc<Mutex<(std::time::Instant, u32)>>,
    pub auth_budget: Arc<Mutex<(std::time::Instant, u32)>>,
}

impl AppState {
    pub fn new(config: Config, pool: PgPool, oidc: Option<oidc::Oidc>) -> Self {
        Self {
            config,
            pool,
            oidc,
            budget: Arc::new(Mutex::new((std::time::Instant::now(), 0))),
            auth_budget: Arc::new(Mutex::new((std::time::Instant::now(), 0))),
        }
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route(
            "/api/health",
            get(|| async { Json(serde_json::json!({"status":"ok"})) }),
        )
        .route("/api/public/config", get(public_config))
        .route("/api/me", get(me))
        .route("/api/session/context", post(switch_context))
        .route("/api/auth/google/start", get(start))
        .route("/api/auth/google/callback", get(callback))
        .route("/api/auth/logout", post(logout))
        .route("/api/latihan", get(latihan::student_catalog))
        .route("/api/latihan/{id}/jawab", post(latihan::submit))
        .route("/api/latihan/{id}/petunjuk", post(latihan::reveal_hint))
        .route("/api/dosen/latihan", get(latihan::lecturer_catalog))
        .route("/api/labs/catalog", get(portal::get_labs_catalog))
        .route("/api/labs/{lab_id}", get(portal::get_lab_detail))
        .route("/api/labs/sessions", post(portal::start_or_resume_session))
        .route("/api/labs/sessions/{session_id}", get(portal::get_session))
        .route(
            "/api/labs/sessions/{session_id}/step",
            post(portal::update_session_step),
        )
        .route(
            "/api/labs/sessions/{session_id}/probe",
            post(portal::run_probe),
        )
        .route(
            "/api/labs/sessions/{session_id}/hint",
            post(portal::open_hint),
        )
        .route(
            "/api/labs/sessions/{session_id}/verify",
            post(portal::verify_session),
        )
        .route(
            "/api/labs/sessions/{session_id}/reflect",
            post(portal::submit_reflection),
        )
        .route(
            "/api/labs/sessions/{session_id}/reset",
            post(portal::reset_session),
        )
        .route("/api/dashboard/student", get(portal::student_dashboard))
        .route("/api/student/history", get(portal::student_history))
        .route("/api/student/leaderboard", get(portal::student_leaderboard))
        .route(
            "/api/dashboard/instructor",
            get(portal::instructor_dashboard),
        )
        .route("/api/dosen/assignments", post(portal::create_assignment))
        .route(
            "/api/dosen/sessions/{session_id}/feedback",
            post(portal::add_session_feedback),
        )
        .route("/api/dosen/export", get(portal::export_class_csv))
        .route("/api/dosen/labs", get(portal::instructor_labs_bank))
        .route("/api/dosen/seed", post(portal::dosen_trigger_seed))
        .route("/api/dashboard/admin", get(portal::admin_dashboard))
        .route("/api/admin/seed", post(portal::admin_trigger_seed))
        .route(
            "/api/admin/users/{user_id}/status",
            post(portal::admin_set_user_status),
        )
        .route("/api/admin/classes", post(portal::admin_create_class))
        .route(
            "/api/admin/catalog/{lab_id}/status",
            post(portal::admin_update_module_status),
        )
        .route(
            "/api/account/security",
            get(security_account::get_security_settings),
        )
        .route(
            "/api/account/security/preferences",
            post(security_account::update_email_preferences),
        )
        .route(
            "/api/account/security/totp/enroll",
            post(security_account::enroll_totp),
        )
        .route(
            "/api/account/security/totp/verify",
            post(security_account::verify_and_enable_totp),
        )
        .route(
            "/api/account/security/totp/disable",
            post(security_account::disable_totp),
        )
        .route(
            "/api/account/security/backup-codes/regenerate",
            post(security_account::regenerate_backup_codes),
        )
        .route(
            "/api/account/security/mfa/verify",
            post(security_account::verify_mfa_challenge),
        )
        .route(
            "/api/account/security/passkeys/challenge",
            post(security_account::challenge_passkey),
        )
        .route(
            "/api/account/security/passkeys",
            post(security_account::register_passkey),
        )
        .route(
            "/api/account/security/passkeys/{passkey_id}",
            delete(security_account::delete_passkey),
        )
        .route(
            "/api/account/sessions/{session_id}/revoke",
            post(security_account::revoke_my_session),
        )
        .route(
            "/api/account/presence",
            post(security_account::update_presence),
        )
        .route(
            "/api/notifications",
            get(security_account::list_notifications),
        )
        .route(
            "/api/notifications/read",
            post(security_account::mark_notifications_read),
        )
        .route(
            "/api/admin/security-monitor",
            get(security_account::admin_security_monitor),
        )
        .route(
            "/api/admin/sessions/{session_id}/revoke",
            post(security_account::admin_revoke_session),
        )
        .route(
            "/api/admin/anomalies/{anomaly_id}/ack",
            post(security_account::admin_ack_anomaly),
        )
        .route(
            "/api/openapi.json",
            get(|| async {
                Json(
                    serde_json::from_str::<serde_json::Value>(include_str!(
                        "../../docs/openapi.json"
                    ))
                    .expect("valid OpenAPI"),
                )
            }),
        )
        .method_not_allowed_fallback(|| async { ApiError(StatusCode::METHOD_NOT_ALLOWED) })
        .fallback(|| async { ApiError(StatusCode::NOT_FOUND) })
        .layer(DefaultBodyLimit::max(16 * 1024))
        .layer(tower::limit::ConcurrencyLimitLayer::new(64))
        .layer(tower_http::timeout::TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            std::time::Duration::from_secs(15),
        ))
        .layer(middleware::from_fn_with_state(state.clone(), controls))
        .with_state(state)
}

pub fn random_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}
pub fn hash(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}

pub struct ApiError(pub StatusCode);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (code, message) = match self.0 {
            StatusCode::BAD_REQUEST => (
                "BAD_REQUEST",
                "Permintaan tidak valid (400). Periksa parameter atau format input Anda.",
            ),
            StatusCode::UNAUTHORIZED => {
                ("UNAUTHORIZED", "Sesi tidak aktif. Silakan masuk kembali.")
            }
            StatusCode::FORBIDDEN => (
                "FORBIDDEN",
                "Permintaan ditolak atau tidak dapat diverifikasi. Muat ulang halaman.",
            ),
            StatusCode::NOT_FOUND => ("NOT_FOUND", "Halaman atau sumber daya tidak ditemukan."),
            StatusCode::METHOD_NOT_ALLOWED => (
                "METHOD_NOT_ALLOWED",
                "Metode HTTP tidak diizinkan untuk endpoint ini.",
            ),
            StatusCode::REQUEST_TIMEOUT => (
                "REQUEST_TIMEOUT",
                "Permintaan melebihi batas waktu. Coba lagi sebentar.",
            ),
            StatusCode::CONFLICT => ("CONFLICT", "Selesaikan langkah sebelumnya terlebih dahulu."),
            StatusCode::PAYLOAD_TOO_LARGE => {
                ("PAYLOAD_TOO_LARGE", "Ukuran permintaan terlalu besar.")
            }
            StatusCode::UNPROCESSABLE_ENTITY => (
                "VALIDATION_ERROR",
                "Data tidak valid, kosong, atau melebihi batas panjang.",
            ),
            StatusCode::TOO_MANY_REQUESTS => (
                "RATE_LIMITED",
                "Terlalu banyak permintaan. Coba lagi dalam satu menit.",
            ),
            _ => (
                "SERVICE_UNAVAILABLE",
                "Layanan sedang mengalami gangguan. Silakan coba lagi.",
            ),
        };
        (
            self.0,
            Json(serde_json::json!({
                "status": self.0.as_u16(),
                "code": code,
                "message": message,
            })),
        )
            .into_response()
    }
}
impl From<sqlx::Error> for ApiError {
    fn from(_: sqlx::Error) -> Self {
        tracing::error!(event = "database_operation_failed");
        Self(StatusCode::SERVICE_UNAVAILABLE)
    }
}

fn budget_available(budget: &Mutex<(std::time::Instant, u32)>, limit: u32) -> bool {
    let Ok(mut window) = budget.lock() else {
        return false;
    };
    if window.0.elapsed().as_secs() >= 60 {
        *window = (std::time::Instant::now(), 0);
    }
    window.1 += 1;
    window.1 <= limit
}

async fn controls(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let id = Uuid::new_v4().to_string();
    let mut response = if budget_available(&state.budget, 2400) {
        next.run(request)
            .instrument(tracing::info_span!("request", request_id = %id))
            .await
    } else {
        ApiError(StatusCode::TOO_MANY_REQUESTS).into_response()
    };
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("default-src 'none'; frame-ancestors 'none'"),
    );
    headers.insert(
        "x-request-id",
        HeaderValue::from_str(&id).expect("uuid header"),
    );
    response
}

fn cookie(config: &Config, name: &'static str, value: String, seconds: i64) -> Cookie<'static> {
    Cookie::build((name, value))
        .http_only(true)
        .secure(config.secure())
        .same_site(SameSite::Lax)
        .path("/")
        .max_age(time::Duration::seconds(seconds))
        .build()
}

async fn public_config(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({"support_email":state.config.support_email}))
}

async fn start(State(state): State<AppState>, jar: CookieJar) -> Result<Response, ApiError> {
    if !budget_available(&state.auth_budget, 120) {
        return Err(ApiError(StatusCode::TOO_MANY_REQUESTS));
    }
    let Some(oidc) = &state.oidc else {
        return Ok(Redirect::to("/login?status=temporary").into_response());
    };
    let browser = random_token();
    let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
    let (url, csrf, nonce) = oidc
        .client
        .authorize_url(
            CoreAuthenticationFlow::AuthorizationCode,
            CsrfToken::new_random,
            Nonce::new_random,
        )
        .add_scope(Scope::new("email".into()))
        .add_scope(Scope::new("profile".into()))
        .set_pkce_challenge(challenge)
        .url();
    sqlx::query("INSERT INTO oidc_transactions (state_hash,browser_hash,nonce,pkce_verifier,expires_at) VALUES ($1,$2,$3,$4,now()+interval '5 minutes')")
        .bind(hash(csrf.secret())).bind(hash(&browser)).bind(nonce.secret()).bind(verifier.secret()).execute(&state.pool).await?;
    tracing::info!(event = "login_started");
    Ok((
        jar.add(cookie(
            &state.config,
            state.config.transaction_cookie(),
            browser,
            300,
        )),
        Redirect::to(url.as_str()),
    )
        .into_response())
}

#[derive(Deserialize)]
struct Callback {
    state: Option<String>,
    code: Option<String>,
    error: Option<String>,
}
#[derive(FromRow)]
struct Transaction {
    nonce: String,
    pkce_verifier: String,
    expires_at: DateTime<Utc>,
}

async fn callback(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Query(query): Query<Callback>,
) -> Response {
    let telemetry = security_account::extract_telemetry(&headers);
    let result = complete_login(&state, &jar, &headers, query).await;
    let jar = jar.add(cookie(
        &state.config,
        state.config.transaction_cookie(),
        String::new(),
        0,
    ));
    match result {
        Ok(token) => {
            tracing::info!(event = "login_completed");
            (
                jar.add(cookie(
                    &state.config,
                    state.config.session_cookie(),
                    token,
                    8 * 3600,
                )),
                Redirect::to("/lab"),
            )
                .into_response()
        }
        Err(status) => {
            tracing::info!(event = "login_rejected", reason = status);
            security_account::record_rejected_login_anomaly(&state.pool, status, &telemetry).await;
            (jar, Redirect::to(&format!("/login?status={status}"))).into_response()
        }
    }
}

async fn complete_login(
    state: &AppState,
    jar: &CookieJar,
    headers: &HeaderMap,
    query: Callback,
) -> Result<String, &'static str> {
    let oidc = state.oidc.as_ref().ok_or("temporary")?;
    let csrf = query
        .state
        .as_deref()
        .filter(|v| v.len() <= 256)
        .ok_or("expired")?;
    let browser = jar
        .get(state.config.transaction_cookie())
        .ok_or("expired")?;
    // DELETE ... RETURNING atomically consumes even expired or cancelled transactions.
    let transaction = sqlx::query_as::<_, Transaction>("DELETE FROM oidc_transactions WHERE state_hash=$1 AND browser_hash=$2 RETURNING nonce,pkce_verifier,expires_at")
        .bind(hash(csrf)).bind(hash(browser.value())).fetch_optional(&state.pool).await.map_err(|_| "temporary")?.ok_or("expired")?;
    if transaction.expires_at <= Utc::now() {
        return Err("expired");
    }
    if let Some(error) = query.error {
        return Err(if error == "access_denied" {
            "cancelled"
        } else {
            "temporary"
        });
    }
    let code = query
        .code
        .filter(|v| !v.is_empty() && v.len() <= 4096)
        .ok_or("expired")?;
    let tokens = oidc
        .client
        .exchange_code(AuthorizationCode::new(code))
        .map_err(|_| "temporary")?
        .set_pkce_verifier(PkceCodeVerifier::new(transaction.pkce_verifier))
        .request_async(&oidc.http)
        .await
        .map_err(|_| "temporary")?;
    let id_token = tokens.id_token().ok_or("temporary")?;
    let claims = id_token
        .claims(
            &oidc.client.id_token_verifier(),
            &Nonce::new(transaction.nonce),
        )
        .map_err(|_| "expired")?;
    let subject = claims.subject().as_str();
    let email = claims
        .email()
        .filter(|_| claims.email_verified() == Some(true))
        .ok_or("unauthorized")?
        .as_str()
        .to_ascii_lowercase();
    let name = claims
        .name()
        .and_then(|n| n.get(None))
        .map(|n| n.as_str())
        .unwrap_or("Mahasiswa");
    if subject.len() > 255 || email.len() > 320 || name.len() > 512 {
        return Err("temporary");
    }
    let hd = claims.additional_claims().hd.as_deref();
    if state.config.workspace_domain.is_none()
        && state.config.email_allowed(&email)
        && let Some(domain) = hd
    {
        tracing::warn!(
            event = "workspace_configuration_required",
            workspace_domain = domain
        );
    }
    if !state.config.eligible(&email, hd) {
        return Err("unauthorized");
    }
    let mut tx = state.pool.begin().await.map_err(|_| "temporary")?;
    let user: (Uuid, bool) = sqlx::query_as("INSERT INTO users (id,issuer,subject,name,email,workspace_domain) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (issuer,subject) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,workspace_domain=EXCLUDED.workspace_domain WHERE users.active RETURNING id,access_initialized")
        .bind(Uuid::new_v4()).bind(&state.config.issuer).bind(subject).bind(name).bind(&email).bind(hd).fetch_optional(&mut *tx).await.map_err(|_| "temporary")?.ok_or("unauthorized")?;
    let privileged = state.config.email_allowed(&email);
    if privileged {
        let binding: (Uuid,) = sqlx::query_as("INSERT INTO privileged_bindings(email,user_id) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING user_id")
            .bind(&email).bind(user.0).fetch_one(&mut *tx).await.map_err(|_| "temporary")?;
        if binding.0 != user.0 {
            return Err("unauthorized");
        }
    }
    if !user.1 {
        sqlx::query("DELETE FROM user_roles WHERE user_id=$1")
            .bind(user.0)
            .execute(&mut *tx)
            .await
            .map_err(|_| "temporary")?;
        let roles = if privileged {
            vec!["dosen", "admin"]
        } else {
            vec!["mahasiswa"]
        };
        for role in roles {
            sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)")
                .bind(user.0)
                .bind(role)
                .execute(&mut *tx)
                .await
                .map_err(|_| "temporary")?;
        }
        sqlx::query("UPDATE users SET access_initialized=true WHERE id=$1")
            .bind(user.0)
            .execute(&mut *tx)
            .await
            .map_err(|_| "temporary")?;
        sqlx::query(
            "INSERT INTO access_events(id,user_id,event) VALUES($1,$2,'access_initialized')",
        )
        .bind(Uuid::new_v4())
        .bind(user.0)
        .execute(&mut *tx)
        .await
        .map_err(|_| "temporary")?;
    }
    let role: Option<(String,)> = sqlx::query_as("SELECT role FROM user_roles WHERE user_id=$1 AND role=ANY($2) ORDER BY CASE role WHEN 'dosen' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1")
        .bind(user.0).bind(if privileged { vec!["dosen", "admin"] } else { vec!["mahasiswa"] }).fetch_optional(&mut *tx).await.map_err(|_| "temporary")?;
    let role = role.ok_or("unauthorized")?.0;
    if let Some(old) = jar.get(state.config.session_cookie()) {
        sqlx::query("DELETE FROM sessions WHERE token_hash=$1")
            .bind(hash(old.value()))
            .execute(&mut *tx)
            .await
            .map_err(|_| "temporary")?;
    }
    let telemetry = security_account::extract_telemetry(headers);
    let session_id = Uuid::new_v4();
    let initial_path = home_route(&role);
    let token = random_token();
    sqlx::query("INSERT INTO sessions (token_hash,session_id,user_id,csrf_token,expires_at,active_role,ip_address,user_agent,device_label,location_label,current_path) VALUES ($1,$2,$3,$4,now()+interval '8 hours',$5,$6,$7,$8,$9,$10)")
        .bind(hash(&token))
        .bind(session_id)
        .bind(user.0)
        .bind(random_token())
        .bind(&role)
        .bind(&telemetry.ip_address)
        .bind(&telemetry.user_agent)
        .bind(&telemetry.device_label)
        .bind(&telemetry.location_label)
        .bind(initial_path)
        .execute(&mut *tx)
        .await
        .map_err(|_| "temporary")?;
    tx.commit().await.map_err(|_| "temporary")?;
    security_account::evaluate_login_anomalies(
        &state.pool,
        user.0,
        &email,
        session_id,
        &role,
        &telemetry,
    )
    .await;
    Ok(token)
}

#[derive(Serialize, FromRow)]
pub struct Identity {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub role: String,
    pub allowed_roles: Vec<String>,
    #[sqlx(skip)]
    pub home_route: String,
    #[serde(skip)]
    pub workspace_domain: Option<String>,
    pub csrf_token: String,
    pub expires_at: DateTime<Utc>,
}

pub(crate) async fn identity(state: &AppState, jar: &CookieJar) -> Result<Identity, ApiError> {
    let token = jar
        .get(state.config.session_cookie())
        .ok_or(ApiError(StatusCode::UNAUTHORIZED))?;
    let token_hash = hash(token.value());
    let identity = sqlx::query_as::<_, Identity>("WITH active AS (UPDATE sessions s SET last_seen_at=now() FROM users u WHERE s.token_hash=$1 AND s.expires_at>now() AND s.last_seen_at>now()-interval '30 minutes' AND u.id=s.user_id AND u.active AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role=s.active_role) RETURNING s.user_id,s.csrf_token,s.expires_at,s.active_role) SELECT u.id,u.name,u.email,u.workspace_domain,a.active_role AS role,ARRAY(SELECT r.role FROM user_roles r WHERE r.user_id=u.id ORDER BY r.role) AS allowed_roles,a.csrf_token,a.expires_at FROM active a JOIN users u ON u.id=a.user_id")
        .bind(&token_hash).fetch_optional(&state.pool).await?;
    if let Some(mut identity) = identity
        && state
            .config
            .eligible(&identity.email, identity.workspace_domain.as_deref())
    {
        let privileged = state.config.email_allowed(&identity.email);
        identity.allowed_roles.retain(|role| {
            if privileged {
                role == "dosen" || role == "admin"
            } else {
                role == "mahasiswa"
            }
        });
        if !identity.allowed_roles.contains(&identity.role) {
            sqlx::query("DELETE FROM sessions WHERE token_hash=$1")
                .bind(&token_hash)
                .execute(&state.pool)
                .await?;
            return Err(ApiError(StatusCode::UNAUTHORIZED));
        }
        identity.home_route = home_route(&identity.role).into();
        return Ok(identity);
    }
    sqlx::query("DELETE FROM sessions WHERE token_hash=$1")
        .bind(&token_hash)
        .execute(&state.pool)
        .await?;
    Err(ApiError(StatusCode::UNAUTHORIZED))
}

async fn me(State(state): State<AppState>, jar: CookieJar) -> Result<Json<Identity>, ApiError> {
    Ok(Json(identity(&state, &jar).await?))
}

/// Permintaan yang mengubah data wajib membawa Origin exact dan token CSRF sesi.
pub(crate) async fn verify_mutation(
    state: &AppState,
    jar: &CookieJar,
    headers: &HeaderMap,
) -> Result<Identity, ApiError> {
    if headers.get(header::ORIGIN).and_then(|v| v.to_str().ok())
        != Some(state.config.base_url.as_str())
    {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let actor = identity(state, jar).await?;
    let supplied = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !bool::from(
        hash(supplied)
            .as_bytes()
            .ct_eq(hash(&actor.csrf_token).as_bytes()),
    ) {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    Ok(actor)
}

fn home_route(role: &str) -> &'static str {
    match role {
        "dosen" => "/lab/dosen",
        "admin" => "/lab/admin",
        _ => "/lab",
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ContextRequest {
    role: String,
}

async fn switch_context(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(request): Json<ContextRequest>,
) -> Result<Response, ApiError> {
    let actor = verify_mutation(&state, &jar, &headers).await?;
    if !actor.allowed_roles.contains(&request.role) {
        return Err(ApiError(StatusCode::FORBIDDEN));
    }
    let old = jar
        .get(state.config.session_cookie())
        .ok_or(ApiError(StatusCode::UNAUTHORIZED))?;
    let token = random_token();
    let mut tx = state.pool.begin().await?;
    let rotated: Option<(DateTime<Utc>,)> = sqlx::query_as("UPDATE sessions SET token_hash=$1,csrf_token=$2,active_role=$3 WHERE token_hash=$4 AND EXISTS(SELECT 1 FROM user_roles WHERE user_id=sessions.user_id AND role=$3) RETURNING expires_at")
        .bind(hash(&token)).bind(random_token()).bind(&request.role).bind(hash(old.value())).fetch_optional(&mut *tx).await?;
    let expires = rotated.ok_or(ApiError(StatusCode::UNAUTHORIZED))?.0;
    sqlx::query(
        "INSERT INTO access_events(id,user_id,event,role) VALUES($1,$2,'context_switched',$3)",
    )
    .bind(Uuid::new_v4())
    .bind(actor.id)
    .bind(&request.role)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    security_account::record_context_switch_event(&state.pool, &actor, &request.role, &headers)
        .await;
    Ok((
        jar.add(cookie(
            &state.config,
            state.config.session_cookie(),
            token,
            (expires - Utc::now()).num_seconds().max(0),
        )),
        Json(serde_json::json!({"home_route":home_route(&request.role)})),
    )
        .into_response())
}

async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
) -> Result<Response, ApiError> {
    verify_mutation(&state, &jar, &headers).await?;
    let token = jar
        .get(state.config.session_cookie())
        .ok_or(ApiError(StatusCode::UNAUTHORIZED))?;
    sqlx::query("DELETE FROM sessions WHERE token_hash=$1")
        .bind(hash(token.value()))
        .execute(&state.pool)
        .await?;
    tracing::info!(event = "logout_completed");
    Ok((
        jar.add(cookie(
            &state.config,
            state.config.session_cookie(),
            String::new(),
            0,
        )),
        StatusCode::NO_CONTENT,
    )
        .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cookie_attributes_match_https_host_policy_and_development_is_separate() {
        let mut config = Config {
            environment: "production".into(),
            base_url: "https://lab.ilhamfirmanashari.my.id".into(),
            bind: "127.0.0.1:3000".parse().unwrap(),
            database_url: String::new(),
            issuer: "https://accounts.google.com".into(),
            client_id: String::new(),
            client_secret: String::new(),
            allowed_emails: vec![
                "firman.ashari@if.itera.ac.id".into(),
                "ilhamfirman39@gmail.com".into(),
            ],
            student_emails: vec![],
            workspace_domain: None,
            support_email: Some("lab@example.test".into()),
        };
        let secure = cookie(&config, config.session_cookie(), "opaque".into(), 28800);
        assert_eq!(secure.name(), "__Host-ifa_session");
        assert_eq!(secure.secure(), Some(true));
        assert_eq!(secure.http_only(), Some(true));
        assert_eq!(secure.same_site(), Some(SameSite::Lax));
        assert_eq!(secure.path(), Some("/"));
        assert!(secure.domain().is_none());
        assert_eq!(secure.max_age(), Some(time::Duration::hours(8)));
        let cleared = cookie(&config, config.session_cookie(), String::new(), 0);
        assert_eq!(cleared.max_age(), Some(time::Duration::ZERO));
        config.environment = "development".into();
        config.base_url = "http://localhost:5173".into();
        let dev = cookie(&config, config.session_cookie(), "opaque".into(), 28800);
        assert_eq!(dev.name(), "ifa_session_dev");
        assert_eq!(dev.secure(), Some(false));
    }
}
