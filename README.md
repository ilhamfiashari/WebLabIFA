# WebLabIFA

**WebLabIFA** is an interactive virtual laboratory and practicum platform for **Web Security (OWASP Top 10:2025)** and **Internet of Things (IoT) Security** in the Informatics Engineering program. The platform lets students learn vulnerability concepts in a safe sandboxed simulator—moving step by step through hypothesis, controlled exploit testing, root-cause diagnosis, code patching, and verification—without exposing unsafe infrastructure in the host runtime.

---

## Key Capabilities

- **Role-Based Portals**
  - **Student Portal (`/lab`)**: Interactive OWASP Web & IoT simulation modules, guided step-by-step practice, animated mastery & progress charts, class assignments, session history, achievements, leaderboard ranking, and account security settings.
  - **Lecturer Portal (`/lab/dosen`)**: Cohort progress analytics, score distribution histograms, 7-day activity trends, rubric evidence inspector, class CSV exports, demo cohort seeder, assignment creator with student email notifications, and full class leaderboard.
  - **Admin Portal (`/lab/admin`)**: User and role management, class administration, simulator catalog publication controls, live session monitoring, anomaly alert review, activity audit logs, and sanitized system snapshot backups.
- **Account Security & Recovery**
  - Google OIDC authentication with institutional domain validation, rotating session cookies, and exact-origin CSRF protection.
  - **Authenticator App MFA (TOTP)**: Client-side scannable QR code generation (`qrcode`), manual setup secret fallback, and inline 6-digit verification.
  - **Argon2id-Protected Backup Codes**: Single-use recovery codes hashed with **Argon2id** on the server.
  - **Passkeys & Email Aliases**: Device passkey registration and secondary recovery email management.
  - **Account & System Backups**: On-demand JSON export for individual user progress/preferences (`/api/account/backup`) and admin portal snapshots (`/api/admin/backup`).
- **Usability & Accessibility**
  - Bilingual interface supporting **Indonesian (`id`)** and **English (`en`)**.
  - Consistent **10-item pagination** across security, audit, user, assignment, history, module, and leaderboard tables.
  - Light, dark, and system theme modes with animated error boundary pages (`400` / `404` / `500`).

---

## Architecture & Repository Structure

```text
WebLabIFA/
├── Lab-Backend/            # Rust + Axum REST API & PostgreSQL migrations
│   ├── src/
│   │   ├── config.rs       # Environment-driven OIDC, DB, and session config
│   │   ├── oidc.rs         # Google OIDC discovery, state/nonce/PKCE verification
│   │   ├── lib.rs          # Router wiring, CSP/security headers, public OpenAPI JSON
│   │   ├── seed.rs         # Demo student cohort & practicum seeder
│   │   ├── portal/         # Student, Lecturer, Admin portal endpoints
│   │   ├── simulator/      # Safe simulated request/patch evaluation engine
│   │   ├── simulator_catalog/ # Structured OWASP Web & IoT lab scenarios
│   │   └── security_account/  # TOTP, Argon2id backup codes, passkeys, monitor & backups
│   ├── migrations/         # PostgreSQL SQLx schema migrations
│   └── Dockerfile          # Multi-stage minimal Rust runtime container
├── Lab-FrontEnd/           # React 19 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── admin/          # Admin portal & live security/anomaly monitor
│   │   ├── lecturer/       # Lecturer analytics, grading drawer & leaderboard
│   │   ├── student/        # Student dashboard, assignments, achievements & history
│   │   ├── simulator/      # Interactive OWASP WebGoat-style & IoT Studio workspace
│   │   ├── shared/         # Bilingual i18n, animated charts, errors & MFA settings
│   │   └── portal/         # Shared shell, pagination component & responsive CSS
│   ├── tests/              # Playwright E2E test suites
│   └── Dockerfile          # Non-root Nginx container serving built SPA + API proxy
├── compose.yaml            # Full stack (postgres, migrate, backend, frontend)
└── security/               # Baseline security policies and configuration
```

---

## Running with Docker Compose

1. Create an untracked environment file (for example `.env`) from your deployment settings with PostgreSQL credentials, `APP_BASE_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and `ALLOWED_EMAILS`.
2. Build and start PostgreSQL, database migrations, the Rust backend, and the Nginx frontend:

```sh
docker compose --profile app up --build -d
```

By default, the web interface is exposed on `http://localhost:8080` and the backend health/API service on `127.0.0.1:3008`.

---

## Running Locally for Development

### Prerequisites

- **Rust** toolchain (`cargo`, `clippy`, `rustfmt`)
- **Node.js** 22+ & `npm`
- **PostgreSQL** 17 (can be started alone via `docker compose up -d postgres`)

### Backend

```sh
docker compose up -d postgres
cargo run --manifest-path Lab-Backend/Cargo.toml -- migrate
cargo run --manifest-path Lab-Backend/Cargo.toml
```

### Frontend

```sh
npm --prefix Lab-FrontEnd install
IFA_API_URL=http://127.0.0.1:3008 npm --prefix Lab-FrontEnd run dev -- --port 5173 --strictPort
```

---

## Verification & Quality Checks

### Backend (Formatting, Linting & Unit Tests)

```sh
cargo fmt --manifest-path Lab-Backend/Cargo.toml --check
cargo clippy --manifest-path Lab-Backend/Cargo.toml --locked --all-targets -- -D warnings
cargo test --manifest-path Lab-Backend/Cargo.toml --locked
```

### Frontend (Typecheck, ESLint, Build & Playwright E2E)

```sh
npm --prefix Lab-FrontEnd run typecheck
npm --prefix Lab-FrontEnd run lint
npm --prefix Lab-FrontEnd run build
npm --prefix Lab-FrontEnd run test:e2e
```
