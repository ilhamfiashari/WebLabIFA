use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use ifa_lab_api::{AppState, config::Config, hash, random_token, router};
use sqlx::{PgPool, postgres::PgPoolOptions};
use tower::ServiceExt;
use uuid::Uuid;

fn config() -> Config {
    Config {
        environment: "test".into(),
        base_url: "http://localhost:5173".into(),
        bind: "127.0.0.1:3000".parse().unwrap(),
        database_url: "postgres://unused".into(),
        issuer: "https://accounts.google.com".into(),
        client_id: "fixture".into(),
        client_secret: "fixture".into(), // pragma: allowlist secret -- test fixture
        allowed_emails: vec!["rani@example.test".into(), "bima@example.test".into()],
        student_emails: vec!["uji.mahasiswa@gmail.com".into()],
        workspace_domain: Some("itera.test".into()),
        support_email: None,
    }
}

#[tokio::test]
async fn unauthenticated_routes_fail_closed_and_have_no_store() {
    let pool = PgPoolOptions::new()
        .connect_lazy("postgres://unused@localhost/unused")
        .unwrap();
    let app = router(AppState::new(config(), pool, None));
    for path in ["/api/me", "/api/not-a-route"] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            if path == "/api/me" {
                StatusCode::UNAUTHORIZED
            } else {
                StatusCode::NOT_FOUND
            }
        );
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert!(response.headers().contains_key("x-request-id"));
    }
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/auth/logout")
                .method("POST")
                .header("origin", "https://evil.test")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[test]
fn production_rejects_local_provider_and_wrong_domain() {
    let mut c = config();
    c.environment = "production".into();
    assert!(c.validate().is_err());
    c.base_url = "https://lab.ilhamfirmanashari.my.id".into();
    c.support_email = Some("lab@example.test".into());
    c.allowed_emails = vec![
        "firman.ashari@if.itera.ac.id".into(),
        "ilhamfirman39@gmail.com".into(),
    ];
    assert!(c.validate().is_ok());
    assert_eq!(c.session_cookie(), "__Host-ifa_session");
    c.issuer = "http://localhost:9090".into();
    assert!(c.validate().is_err());
    c.environment = "development".into();
    c.base_url = "http://localhost:5173".into();
    assert!(c.validate().is_err());
    c.environment = "test".into();
    c.allowed_emails = vec!["rani@example.test".into(), "bima@example.test".into()];
    assert!(c.validate().is_ok());
}

#[test]
fn allowlist_is_exact_and_case_insensitive() {
    let c = config();
    assert!(c.email_allowed("RANI@EXAMPLE.TEST"));
    assert!(!c.email_allowed("orang-lain@example.test"));

    let mut production = c;
    production.environment = "production".into();
    production.base_url = "https://lab.ilhamfirmanashari.my.id".into();
    production.support_email = Some("firman.ashari@if.itera.ac.id".into());
    production.allowed_emails = vec![
        "firman.ashari@if.itera.ac.id".into(),
        "ilhamfirman39@gmail.com".into(),
        "orang-lain@example.com".into(),
    ];
    assert!(production.validate().is_err());
}

#[test]
fn student_policy_requires_exact_ascii_nim_and_verified_workspace() {
    use ifa_lab_api::config::student_nim;
    let c = config();
    assert_eq!(
        student_nim("123140051@student.itera.ac.id"),
        Some("123140051")
    );
    assert!(c.eligible("123140051@STUDENT.ITERA.AC.ID", Some("itera.test")));
    for email in [
        "123141051@student.itera.ac.id",
        "123140051+alias@student.itera.ac.id",
        "123140051@student.itera.ac.id.evil.test",
        " 123140051@student.itera.ac.id",
        "１２３140051@student.itera.ac.id",
        "1231400510@student.itera.ac.id",
        "12314005@student.itera.ac.id",
    ] {
        assert!(!c.eligible(email, Some("itera.test")), "{email}");
    }
    assert!(!c.eligible("123140051@student.itera.ac.id", None));
    assert!(!c.eligible("123140051@student.itera.ac.id", Some("wrong.test")));
    let mut unconfigured = c;
    unconfigured.workspace_domain = None;
    assert!(!unconfigured.eligible("123140051@student.itera.ac.id", Some("itera.test")));
}

#[tokio::test]
#[ignore = "requires disposable PostgreSQL and scripts/oidc-fixture.mjs on loopback:9090"]
async fn expired_oidc_transaction_is_consumed_and_rejected() {
    let pool =
        PgPool::connect(&std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL required"))
            .await
            .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    let mut c = config();
    c.issuer = "http://127.0.0.1:9090".into();
    c.client_id = "ifa-fixture".into();
    c.client_secret = "fixture-secret".into(); // pragma: allowlist secret -- test fixture
    let oidc = ifa_lab_api::oidc::Oidc::discover(&c).await.unwrap();
    let state = random_token();
    let browser = random_token();
    sqlx::query("INSERT INTO oidc_transactions(state_hash,browser_hash,nonce,pkce_verifier,expires_at) VALUES($1,$2,'nonce','verifier',now()-interval '1 second')")
        .bind(hash(&state)).bind(hash(&browser)).execute(&pool).await.unwrap();
    let app = router(AppState::new(c, pool.clone(), Some(oidc)));
    let request = || {
        Request::builder()
            .uri(format!(
                "/api/auth/google/callback?state={state}&code=unused"
            ))
            .header("cookie", format!("ifa_oidc_dev={browser}"))
            .body(Body::empty())
            .unwrap()
    };
    let response = app.clone().oneshot(request()).await.unwrap();
    assert_eq!(response.status(), StatusCode::SEE_OTHER);
    assert_eq!(response.headers()["location"], "/login?status=expired");
    let count: (i64,) =
        sqlx::query_as("SELECT count(*) FROM oidc_transactions WHERE state_hash=$1")
            .bind(hash(&state))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count.0, 0);
    assert_eq!(
        app.oneshot(request()).await.unwrap().headers()["location"],
        "/login?status=expired"
    );
}

// Explicit opt-in: CI invokes ignored tests against a real, disposable PostgreSQL database.
#[tokio::test]
#[ignore = "requires disposable PostgreSQL and scripts/oidc-fixture.mjs on loopback:9090"]
async fn disabled_account_rejects_login_and_revokes_all_sessions() {
    let pool =
        PgPool::connect(&std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL required"))
            .await
            .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    let mut c = config();
    c.base_url = "http://127.0.0.1:5173".into();
    c.issuer = "http://127.0.0.1:9090".into();
    c.client_id = "ifa-fixture".into();
    c.client_secret = "fixture-secret".into(); // pragma: allowlist secret -- test fixture
    let user = Uuid::new_v4();
    let scenario = format!("inactive_account_{user}");
    let email = format!("{scenario}@example.test");
    c.allowed_emails.push(email.clone());
    let oidc = ifa_lab_api::oidc::Oidc::discover(&c).await.unwrap();
    sqlx::query(
        "INSERT INTO users(id,issuer,subject,name,email,active) VALUES($1,$2,$3,'Rani',$4,false)",
    )
    .bind(user)
    .bind(&c.issuer)
    .bind(&scenario)
    .bind(email)
    .execute(&pool)
    .await
    .unwrap();
    let app = router(AppState::new(c, pool.clone(), Some(oidc)));

    async fn login(app: &axum::Router, scenario: &str) -> axum::response::Response {
        let start = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/auth/google/start")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let cookie = start.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .split(';')
            .next()
            .unwrap();
        let mut url = url::Url::parse(start.headers()["location"].to_str().unwrap()).unwrap();
        url.query_pairs_mut().append_pair("scenario", scenario);
        let provider = openidconnect::reqwest::Client::builder()
            .redirect(openidconnect::reqwest::redirect::Policy::none())
            .build()
            .unwrap()
            .get(url)
            .send()
            .await
            .unwrap();
        let callback = url::Url::parse(provider.headers()["location"].to_str().unwrap()).unwrap();
        let uri = format!("{}?{}", callback.path(), callback.query().unwrap());
        app.clone()
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .header("cookie", cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap()
    }

    let denied = login(&app, &scenario).await;
    assert_eq!(denied.headers()["location"], "/login?status=unauthorized");
    let active: (bool,) = sqlx::query_as("SELECT active FROM users WHERE id=$1")
        .bind(user)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!active.0); // Upsert must not reactivate a disabled account.
    let sessions: (i64,) = sqlx::query_as("SELECT count(*) FROM sessions WHERE user_id=$1")
        .bind(user)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(sessions.0, 0);

    sqlx::query("UPDATE users SET active=true WHERE id=$1")
        .bind(user)
        .execute(&pool)
        .await
        .unwrap();
    let accepted = login(&app, &scenario).await;
    assert_eq!(accepted.headers()["location"], "/lab");
    let session_cookie = accepted
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|h| h.to_str().ok())
        .find(|h| h.starts_with("ifa_session_dev="))
        .unwrap()
        .split(';')
        .next()
        .unwrap();
    sqlx::query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,'fixture',now()+interval '1 hour')")
        .bind(hash(&random_token())).bind(user).execute(&pool).await.unwrap();
    sqlx::query("UPDATE users SET active=false WHERE id=$1")
        .bind(user)
        .execute(&pool)
        .await
        .unwrap();
    let remaining: (i64,) = sqlx::query_as("SELECT count(*) FROM sessions WHERE user_id=$1")
        .bind(user)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(remaining.0, 0);
    for enabled in [false, true] {
        sqlx::query("UPDATE users SET active=$1 WHERE id=$2")
            .bind(enabled)
            .bind(user)
            .execute(&pool)
            .await
            .unwrap();
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/me")
                    .header("cookie", session_cookie)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
    sqlx::query("DELETE FROM user_roles WHERE user_id=$1 AND role='admin'")
        .bind(user)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(login(&app, &scenario).await.headers()["location"], "/lab");
    let revoked: (i64,) =
        sqlx::query_as("SELECT count(*) FROM user_roles WHERE user_id=$1 AND role='admin'")
            .bind(user)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(revoked.0, 0); // Subsequent logins must not restore revoked grants.
    sqlx::query("DELETE FROM privileged_bindings WHERE user_id=$1")
        .bind(user)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM users WHERE id=$1")
        .bind(user)
        .execute(&pool)
        .await
        .unwrap();
}

// Explicit opt-in: CI invokes ignored tests against a real, disposable PostgreSQL database.
#[tokio::test]
#[ignore = "requires TEST_DATABASE_URL pointing to a disposable PostgreSQL database"]
async fn postgres_session_lifecycle_and_atomic_transaction_consumption() {
    let pool =
        PgPool::connect(&std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL required"))
            .await
            .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    let user = Uuid::new_v4();
    sqlx::query("INSERT INTO users(id,issuer,subject,name,email,workspace_domain) VALUES($1,'fixture',$2,'Rani','123140051@student.itera.ac.id','itera.test')").bind(user).bind(user.to_string()).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,'mahasiswa')")
        .bind(user)
        .execute(&pool)
        .await
        .unwrap();
    let token = random_token();
    let csrf = random_token();
    sqlx::query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')").bind(hash(&token)).bind(user).bind(&csrf).execute(&pool).await.unwrap();
    let app = router(AppState::new(config(), pool.clone(), None));
    let request = || {
        Request::builder()
            .uri("/api/me")
            .header("cookie", format!("ifa_session_dev={token}"))
            .body(Body::empty())
            .unwrap()
    };
    assert_eq!(
        app.clone().oneshot(request()).await.unwrap().status(),
        StatusCode::OK
    );
    let outsider = Uuid::new_v4();
    let outsider_token = random_token();
    sqlx::query("INSERT INTO users(id,issuer,subject,name,email) VALUES($1,'fixture',$2,'Orang Lain','orang-lain@example.test')").bind(outsider).bind(outsider.to_string()).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,'fixture',now()+interval '8 hours')").bind(hash(&outsider_token)).bind(outsider).execute(&pool).await.unwrap();
    let outsider_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/me")
                .header("cookie", format!("ifa_session_dev={outsider_token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(outsider_response.status(), StatusCode::UNAUTHORIZED);
    let outsider_sessions: (i64,) =
        sqlx::query_as("SELECT count(*) FROM sessions WHERE token_hash=$1")
            .bind(hash(&outsider_token))
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(outsider_sessions.0, 0);
    let logout = |origin: &str, secret: &str| {
        Request::builder()
            .method("POST")
            .uri("/api/auth/logout")
            .header("origin", origin)
            .header("x-csrf-token", secret)
            .header("cookie", format!("ifa_session_dev={token}"))
            .body(Body::empty())
            .unwrap()
    };
    assert_eq!(
        app.clone()
            .oneshot(logout("https://evil.test", &csrf))
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.clone()
            .oneshot(logout("http://localhost:5173", "wrong"))
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );
    sqlx::query("UPDATE sessions SET last_seen_at=now()-interval '31 minutes' WHERE token_hash=$1")
        .bind(hash(&token))
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        app.clone().oneshot(request()).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );
    let remaining: (i64,) = sqlx::query_as("SELECT count(*) FROM sessions WHERE token_hash=$1")
        .bind(hash(&token))
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(remaining.0, 0);
    sqlx::query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()-interval '1 second')")
        .bind(hash(&token)).bind(user).bind(&csrf).execute(&pool).await.unwrap();
    assert_eq!(
        app.clone().oneshot(request()).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );
    sqlx::query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
        .bind(hash(&token))
        .bind(user)
        .bind(&csrf)
        .execute(&pool)
        .await
        .unwrap();
    let response = app
        .clone()
        .oneshot(logout("http://localhost:5173", &csrf))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    assert!(
        response.headers()["set-cookie"]
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    assert_eq!(
        app.oneshot(request()).await.unwrap().status(),
        StatusCode::UNAUTHORIZED
    );

    let state = random_token();
    sqlx::query("INSERT INTO oidc_transactions VALUES($1,'browser','nonce','verifier',now()+interval '5 minutes')").bind(&state).execute(&pool).await.unwrap();
    let consume = || {
        sqlx::query("DELETE FROM oidc_transactions WHERE state_hash=$1 AND browser_hash='browser' RETURNING nonce").bind(&state).fetch_optional(&pool)
    };
    let (first, second) = tokio::join!(consume(), consume());
    assert_eq!(
        usize::from(first.unwrap().is_some()) + usize::from(second.unwrap().is_some()),
        1
    );
    sqlx::query("DELETE FROM users WHERE id=ANY($1)")
        .bind(vec![user, outsider])
        .execute(&pool)
        .await
        .unwrap();
}

#[test]
fn extra_student_emails_are_exact_and_cannot_overlap_privileged_accounts() {
    let c = config();
    assert!(c.eligible("Uji.Mahasiswa@gmail.com", None));
    for email in [
        "uji.mahasiswa+x@gmail.com",
        "uji.mahasiswa@gmail.com.evil.test",
        "ujimahasiswa@gmail.com",
    ] {
        assert!(!c.eligible(email, None), "{email}");
    }
    assert!(!c.email_allowed("uji.mahasiswa@gmail.com"));
    let mut overlap = config();
    overlap.student_emails.push("rani@example.test".into());
    assert!(overlap.validate().is_err());
    let mut duplicate = config();
    duplicate
        .student_emails
        .push("uji.mahasiswa@gmail.com".into());
    assert!(duplicate.validate().is_err());
}

#[tokio::test]
#[ignore = "requires TEST_DATABASE_URL pointing to a disposable PostgreSQL database"]
async fn exercises_enforce_order_hide_keys_and_split_roles() {
    let pool =
        PgPool::connect(&std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL required"))
            .await
            .unwrap();
    sqlx::migrate!("./migrations").run(&pool).await.unwrap();
    async fn session(pool: &PgPool, role: &str) -> (String, String) {
        let user = Uuid::new_v4();
        let email = if role == "mahasiswa" {
            "123140051@student.itera.ac.id"
        } else {
            "rani@example.test"
        };
        sqlx::query("INSERT INTO users(id,issuer,subject,name,email,workspace_domain) VALUES($1,'fixture',$2,'Rani',$3,'itera.test')").bind(user).bind(user.to_string()).bind(email).execute(pool).await.unwrap();
        sqlx::query("INSERT INTO user_roles(user_id,role) VALUES($1,$2)")
            .bind(user)
            .bind(role)
            .execute(pool)
            .await
            .unwrap();
        let (token, csrf) = (random_token(), random_token());
        sqlx::query("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,active_role) VALUES($1,$2,$3,now()+interval '8 hours',$4)").bind(hash(&token)).bind(user).bind(&csrf).bind(role).execute(pool).await.unwrap();
        (token, csrf)
    }
    let app = router(AppState::new(config(), pool.clone(), None));
    let (student, csrf) = session(&pool, "mahasiswa").await;
    let (lecturer, _) = session(&pool, "dosen").await;
    let get = |token: &str, uri: &str| {
        Request::builder()
            .uri(uri)
            .header("cookie", format!("ifa_session_dev={token}"))
            .body(Body::empty())
            .unwrap()
    };
    let post = |uri: &str, body: &str, csrf: &str| {
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("cookie", format!("ifa_session_dev={student}"))
            .header("origin", "http://localhost:5173")
            .header("x-csrf-token", csrf)
            .header("content-type", "application/json")
            .body(Body::from(body.to_string()))
            .unwrap()
    };
    async fn json(response: axum::response::Response) -> serde_json::Value {
        let bytes = http_body_util::BodyExt::collect(response.into_body())
            .await
            .unwrap()
            .to_bytes();
        serde_json::from_slice(&bytes).unwrap()
    }

    let catalog = app
        .clone()
        .oneshot(get(&student, "/api/latihan"))
        .await
        .unwrap();
    assert_eq!(catalog.status(), StatusCode::OK);
    let text = json(catalog).await.to_string();
    assert!(!text.contains("\"answers\""));
    assert_eq!(
        app.clone()
            .oneshot(get(&student, "/api/dosen/latihan"))
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.clone()
            .oneshot(get(&lecturer, "/api/latihan"))
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );
    let keys = json(
        app.clone()
            .oneshot(get(&lecturer, "/api/dosen/latihan"))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(keys["tracks"][0]["exercises"][0]["key"]["answers"][0], "b");

    let answer = |id: &str, value: &str| {
        post(
            &format!("/api/latihan/{id}/jawab"),
            &format!("{{\"answer\":\"{value}\"}}"),
            &csrf,
        )
    };
    assert_eq!(
        app.clone()
            .oneshot(post(
                "/api/latihan/web-1-1/jawab",
                "{\"answer\":\"b\"}",
                "wrong"
            ))
            .await
            .unwrap()
            .status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.clone()
            .oneshot(answer("web-1-2", "c"))
            .await
            .unwrap()
            .status(),
        StatusCode::CONFLICT,
        "langkah kedua terkunci"
    );
    let wrong = json(app.clone().oneshot(answer("web-1-1", "a")).await.unwrap()).await;
    assert_eq!(wrong["correct"], false);
    assert!(wrong.get("explanation").is_none());
    let hint = app
        .clone()
        .oneshot(post("/api/latihan/web-1-1/petunjuk", "", &csrf))
        .await
        .unwrap();
    assert_eq!(hint.status(), StatusCode::OK);
    let right = json(app.clone().oneshot(answer("web-1-1", "B")).await.unwrap()).await;
    assert_eq!(right["correct"], true);
    assert_eq!(right["earned"], 4, "petunjuk dan satu salah: 10/2 - 1");
    assert!(right["explanation"].is_string());
    let again = json(app.clone().oneshot(answer("web-1-1", "a")).await.unwrap()).await;
    assert_eq!(again["earned"], 4, "latihan selesai tidak dinilai ulang");
    assert_eq!(
        app.clone()
            .oneshot(answer("web-2-1", "a"))
            .await
            .unwrap()
            .status(),
        StatusCode::CONFLICT,
        "level berikutnya terkunci"
    );
    let view = json(
        app.clone()
            .oneshot(get(&student, "/api/latihan"))
            .await
            .unwrap(),
    )
    .await;
    assert_eq!(view["tracks"][0]["exercises"][0]["status"], "selesai");
    assert_eq!(view["tracks"][0]["exercises"][1]["status"], "terbuka");
    assert_eq!(view["tracks"][0]["exercises"][3]["status"], "terkunci");
}
