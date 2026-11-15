use anyhow::{Context, Result, ensure};
use std::{collections::BTreeSet, env, net::SocketAddr};
use url::Url;

#[derive(Clone)]
pub struct Config {
    pub environment: String,
    pub base_url: String,
    pub bind: SocketAddr,
    pub database_url: String,
    pub issuer: String,
    pub client_id: String,
    pub client_secret: String,
    pub allowed_emails: Vec<String>,
    /// Akun Mahasiswa tambahan di luar pola NIM, misalnya akun uji. Dicocokkan persis.
    pub student_emails: Vec<String>,
    pub workspace_domain: Option<String>,
    pub support_email: Option<String>,
}

const PRODUCTION_ALLOWED_EMAILS: [&str; 2] =
    ["firman.ashari@if.itera.ac.id", "ilhamfirman39@gmail.com"];

impl Config {
    pub fn from_env() -> Result<Self> {
        let required =
            |key| env::var(key).with_context(|| format!("Konfigurasi {key} belum tersedia"));
        let allowed_emails = required("ALLOWED_EMAILS")?
            .split(',')
            .map(|email| email.trim().to_ascii_lowercase())
            .filter(|email| !email.is_empty())
            .collect();
        let student_emails = env::var("STUDENT_EMAILS")
            .unwrap_or_default()
            .split(',')
            .map(|email| email.trim().to_ascii_lowercase())
            .filter(|email| !email.is_empty())
            .collect();
        let config = Self {
            environment: env::var("APP_ENV").unwrap_or_else(|_| "production".into()),
            base_url: required("APP_BASE_URL")?,
            bind: env::var("BIND_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:3000".into())
                .parse()?,
            database_url: required("DATABASE_URL")?,
            issuer: env::var("OIDC_ISSUER")
                .unwrap_or_else(|_| "https://accounts.google.com".into()),
            client_id: required("OIDC_CLIENT_ID")?,
            client_secret: required("OIDC_CLIENT_SECRET")?,
            allowed_emails,
            student_emails,
            workspace_domain: env::var("ITERA_WORKSPACE_DOMAIN")
                .ok()
                .filter(|s| !s.is_empty()),
            support_email: env::var("SUPPORT_EMAIL").ok().filter(|s| !s.is_empty()),
        };
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        ensure!(
            ["development", "test", "production"].contains(&self.environment.as_str()),
            "APP_ENV tidak valid"
        );
        let base = Url::parse(&self.base_url)?;
        ensure!(
            base.path() == "/"
                && base.query().is_none()
                && base.fragment().is_none()
                && base.username().is_empty()
                && base.password().is_none(),
            "APP_BASE_URL harus berupa origin"
        );
        ensure!(
            !self.base_url.ends_with('/'),
            "APP_BASE_URL tanpa garis miring akhir"
        );
        let container_bind =
            env::var("CONTAINER_BIND").is_ok_and(|v| v == "1" || v.eq_ignore_ascii_case("true"));
        ensure!(
            self.bind.ip().is_loopback() || (container_bind && self.bind.ip().is_unspecified()),
            "Backend harus bind ke loopback"
        );
        let allowed: BTreeSet<_> = self.allowed_emails.iter().map(String::as_str).collect();
        ensure!(
            !allowed.is_empty() && allowed.len() == self.allowed_emails.len(),
            "ALLOWED_EMAILS wajib berisi alamat unik"
        );
        ensure!(
            allowed.iter().all(|email| valid_email(email)),
            "ALLOWED_EMAILS memuat alamat tidak valid"
        );
        let students: BTreeSet<_> = self.student_emails.iter().map(String::as_str).collect();
        ensure!(
            students.len() == self.student_emails.len() && students.len() <= 10,
            "STUDENT_EMAILS wajib unik dan paling banyak 10 alamat"
        );
        ensure!(
            students.iter().all(|email| valid_email(email)),
            "STUDENT_EMAILS memuat alamat tidak valid"
        );
        ensure!(
            students.is_disjoint(&allowed),
            "Alamat tidak boleh berada di ALLOWED_EMAILS dan STUDENT_EMAILS sekaligus"
        );
        if self.environment == "production" {
            ensure!(
                self.base_url == "https://lab.ilhamfirmanashari.my.id",
                "Domain production tidak valid"
            );
            ensure!(
                self.issuer == "https://accounts.google.com",
                "Production hanya mengizinkan Google"
            );
            ensure!(
                self.support_email.is_some(),
                "SUPPORT_EMAIL wajib pada production"
            );
            let expected: BTreeSet<_> = PRODUCTION_ALLOWED_EMAILS.into_iter().collect();
            ensure!(
                allowed == expected,
                "Production hanya mengizinkan dua email yang ditetapkan"
            );
        } else {
            ensure!(
                matches!(base.host_str(), Some("localhost" | "127.0.0.1")),
                "Development/test harus memakai localhost"
            );
            ensure!(
                ["http", "https"].contains(&base.scheme()),
                "Skema origin tidak valid"
            );
            if self.issuer != "https://accounts.google.com" {
                let issuer = Url::parse(&self.issuer)?;
                ensure!(
                    self.environment == "test"
                        && issuer.scheme() == "http"
                        && matches!(issuer.host_str(), Some("localhost" | "127.0.0.1")),
                    "OIDC lokal hanya untuk APP_ENV=test dan loopback"
                );
            }
        }
        if let Some(email) = &self.support_email {
            ensure!(valid_email(email), "SUPPORT_EMAIL tidak valid");
        }
        if let Some(domain) = &self.workspace_domain {
            ensure!(
                !domain.is_empty()
                    && domain.bytes().all(|b| b.is_ascii_lowercase()
                        || b.is_ascii_digit()
                        || b == b'.'
                        || b == b'-')
                    && domain.contains('.'),
                "ITERA_WORKSPACE_DOMAIN harus berupa domain saja"
            );
        }
        Ok(())
    }

    pub fn email_allowed(&self, email: &str) -> bool {
        let normalized = email.trim().to_ascii_lowercase();
        self.allowed_emails
            .iter()
            .any(|allowed| allowed == &normalized)
    }

    pub fn student_email_allowed(&self, email: &str) -> bool {
        let normalized = email.trim().to_ascii_lowercase();
        self.student_emails
            .iter()
            .any(|allowed| allowed == &normalized)
    }

    /// Policy runs only after verification of the signed ID token.
    pub fn eligible(&self, email: &str, hd: Option<&str>) -> bool {
        let email = email.to_ascii_lowercase();
        let privileged = self.email_allowed(&email);
        // Allowlist Mahasiswa tambahan dicocokkan persis dan tidak memerlukan claim Workspace.
        if !privileged && self.student_email_allowed(&email) {
            return true;
        }
        if !privileged && student_nim(&email).is_none() {
            return false;
        }
        if email.ends_with("@gmail.com") || (self.environment == "test" && privileged) {
            return privileged;
        }
        self.workspace_domain
            .as_deref()
            .is_some_and(|expected| hd == Some(expected))
    }

    pub fn secure(&self) -> bool {
        self.base_url.starts_with("https://")
    }
    pub fn session_cookie(&self) -> &'static str {
        if self.secure() {
            "__Host-ifa_session"
        } else {
            "ifa_session_dev"
        }
    }
    pub fn transaction_cookie(&self) -> &'static str {
        if self.secure() {
            "__Host-ifa_oidc"
        } else {
            "ifa_oidc_dev"
        }
    }
    pub fn redirect_uri(&self) -> String {
        format!("{}/api/auth/google/callback", self.base_url)
    }
}

pub fn student_nim(email: &str) -> Option<&str> {
    let nim = email.strip_suffix("@student.itera.ac.id")?;
    (nim.len() == 9 && nim.bytes().all(|b| b.is_ascii_digit()) && &nim[3..6] == "140")
        .then_some(nim)
}

fn valid_email(email: &str) -> bool {
    let Some((local, domain)) = email.split_once('@') else {
        return false;
    };
    !local.is_empty()
        && !domain.is_empty()
        && domain.contains('.')
        && !email.chars().any(|c| {
            c.is_control() || c.is_whitespace() || matches!(c, '?' | '#' | '&' | ',' | ';')
        })
}
