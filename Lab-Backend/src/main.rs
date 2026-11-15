use anyhow::Result;
use ifa_lab_api::{AppState, config::Config, oidc::Oidc, router, seed};
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<()> {
    if dotenvy::dotenv().is_err() {
        dotenvy::from_filename("Lab-Backend/.env").ok();
    }
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("ifa_lab_api=info"))
        .init();
    let config = Config::from_env()?;
    if std::env::args().any(|arg| arg == "migrate") {
        let url = std::env::var("MIGRATION_DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("MIGRATION_DATABASE_URL wajib untuk migrasi"))?;
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&url)
            .await
            .map_err(|_| anyhow::anyhow!("Koneksi migrasi gagal"))?;
        sqlx::migrate!("./migrations").run(&pool).await?;
        return Ok(());
    }
    if std::env::args().any(|arg| arg == "seed") {
        let pool = PgPoolOptions::new()
            .max_connections(2)
            .connect(&config.database_url)
            .await
            .map_err(|_| anyhow::anyhow!("Koneksi database gagal"))?;
        let report = seed::seed_demo_data(&pool, None).await?;
        println!("{}", report.to_json());
        return Ok(());
    }
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(3))
        .after_connect(|connection, _| {
            Box::pin(async move {
                sqlx::query("SET statement_timeout='5s'")
                    .execute(&mut *connection)
                    .await?;
                sqlx::query("SET idle_in_transaction_session_timeout='10s'")
                    .execute(connection)
                    .await?;
                Ok(())
            })
        })
        .connect(&config.database_url)
        .await
        .map_err(|_| anyhow::anyhow!("Koneksi database gagal"))?;
    let oidc = Oidc::discover(&config).await.map_err(|_| {
        anyhow::anyhow!("Discovery OIDC gagal; periksa issuer dan koneksi jaringan")
    })?;
    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    let cleanup_pool = pool.clone();
    let cleanup = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            for query in [
                "DELETE FROM oidc_transactions WHERE expires_at<now()",
                "DELETE FROM sessions WHERE expires_at<now() OR last_seen_at<now()-interval '30 minutes'",
            ] {
                if sqlx::query(query).execute(&cleanup_pool).await.is_err() {
                    tracing::warn!(event = "session_cleanup_failed");
                }
            }
        }
    });
    tracing::info!(event="server_started", address=%listener.local_addr()?);
    axum::serve(
        listener,
        router(AppState::new(config, pool.clone(), Some(oidc))),
    )
    .with_graceful_shutdown(async {
        #[cfg(unix)]
        {
            let mut term =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                    .expect("signal handler");
            tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = term.recv() => {} }
        }
        #[cfg(not(unix))]
        {
            tokio::signal::ctrl_c().await.ok();
        }
    })
    .await?;
    cleanup.abort();
    pool.close().await;
    Ok(())
}
