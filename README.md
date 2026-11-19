# WebLabIFA

**WebLabIFA** is an interactive virtual laboratory and practicum platform for **Keamanan Web** (`OWASP Top 10:2025`, classes `IF-3A` & `IF-3B`) and **IoT** (`ESP32-C3`, `ESP32`, `Arduino Uno`, `Arduino Mega`, `Raspberry Pi Pico W`, class `IF-4A`) in the Informatics Engineering program. Students learn security concepts and embedded hardware engineering in a safe sandboxed simulator without exposing unsafe infrastructure to the host runtime.

---

## Key Capabilities

- **Two Enforced Practicum Tracks**
  - **Keamanan Web (`Cyber Security`)**: Step-by-step OWASP Top 10 labs (hypothesis, baseline, controlled probe, root-cause diagnosis, code patching, regression verification, and reflection) with progressive Easy -> Impossible unlocking for students.
  - **IoT Hardware & ESP32 Simulator (`/lab/iot`, `/lab/dosen/iot`)**:
    - **New File (`Blank Canvas`)** toolbar action & customizable board templates (`ESP32-C3`, `ESP32 DevKit`, `Arduino Uno`, `Arduino Mega`, `Pi Pico W`, Multi-MCU workspaces).
    - **Simulated IoT WebServer & Interactive Web Browser (`web-browser` component)**: Drag a live `Web Browser` client onto the circuit canvas, serve custom multi-file `index.html` templates (`{{TEMP}}`, `{{HUMIDITY}}`, `{{LED_STATE}}`) or ESP32 `WebServer` routes (`server.on`, `server.send`), inspect real-time canvas sensor telemetry over HTTP/JSON, and trigger two-way actuator control routes safely inside a CSP-compliant DOM sandbox.
    - **10 Guided IoT Missions & 5 Achievement Badges**: Strictly staged sequential unlocking (`Misi 1 -> Misi 10`) and admin permission enforcement (`can_access_iot_studio`, `can_submit_assignments`) for students, with server-side payload, hardware wiring, firmware token, and `mqtts://` TLS verification + tampering telemetry. All 10 missions and 9 interactive Wokwi teaching projects are unlocked in **Lecturer (`Dosen`)** mode.
    - **Multi-File Synchronization for Large Projects**: Synchronized `Main.ino`, `.h`/`.hpp`/`.cpp`/`.c`/`.ino` modules, automatic companion module linking, cross-file VS Code-style C++ autocomplete & parameter hints, real-time `diagram.json` canvas synchronization, and PostgreSQL persistence (`iot_projects.files_json`).
    - **Saved Projects & Student Files Explorer**: Browse, preview inline files, reopen, or delete saved multi-file projects; Lecturers can browse and load saved student IoT projects from their classes (`/api/dosen/iot-projects`).
- **Moodle LMS Question Bank & Practicum Assignments**
  - Bilingual practice banks restricted strictly to **Cyber Security** and **IoT**, supporting Moodle **XML**, **GIFT**, and **Aiken** import with XXE/DOCTYPE blocking, XSS sanitization, role-gated lecturer bank actions, detailed assignment briefs/rubrics, and deadline/attempt locks.
- **Admin RBAC, Granular Permissions & Live Security Monitor (`/lab/admin`)**
  - Full Admin control to assign multi-roles (`mahasiswa`, `dosen`, `admin`), manage class enrollments (`IF-3A`, `IF-3B`, `IF-4A` limited to `Keamanan Web` & `IoT`), and configure granular 7-flag `user_access_rights` (`/api/admin/users/{user_id}/access`) backed by immediate session revocation when roles change and last-active-admin protection.
  - Active session tracking, confirmed security anomaly review (`iot_submission_tampering`, `iot_sequential_bypass_attempt`, etc.), activity audit logs, and sanitized backups.
- **Account Security & Recovery**
  - Google OIDC authentication with institutional email allowlists, rotating session cookies, exact-origin CSRF verification, Authenticator App MFA (**TOTP**), **Argon2id**-hashed single-use backup codes, passkeys, and vulnerability disclosure policy in [`.github/SECURITY.md`](.github/SECURITY.md).
- **Usability & Accessibility**
  - Bilingual **Indonesian (`id`)** and **English (`en`)** interface, responsive mobile drawer navigation, light/dark themes, and consistent 10-item pagination.

---

## Architecture & Repository Structure

```text
WebLabIFA/
├── .github/SECURITY.md     # Repository vulnerability disclosure policy
├── Lab-Backend/            # Rust + Axum REST API & PostgreSQL migrations
│   ├── src/
│   │   ├── config.rs       # Environment-driven OIDC, DB, and session config
│   │   ├── oidc.rs         # Google OIDC discovery, state/nonce/PKCE verification
│   │   ├── lib.rs          # Router wiring, CSP/security headers, public OpenAPI JSON
│   │   ├── moodle.rs       # Moodle XML/GIFT/Aiken parser & XXE/XSS sanitizer
│   │   ├── latihan.rs      # Cyber Security & IoT practice engine and settings
│   │   ├── seed.rs         # Demo student cohorts, assignments & multi-file IoT projects
│   │   ├── portal/         # Student, Lecturer, Admin RBAC & IoT project endpoints
│   │   ├── simulator/      # Safe simulated request/patch evaluation engine
│   │   ├── simulator_catalog/ # Structured OWASP Web & IoT lab scenarios
│   │   └── security_account/  # TOTP, Argon2id backup codes, passkeys, monitor & backups
│   ├── migrations/         # PostgreSQL SQLx schema migrations (0001..0014)
│   └── Dockerfile          # Multi-stage minimal Rust runtime container
├── Lab-FrontEnd/           # React 19 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── admin/          # Admin portal, UserAccessModal & live security monitor
│   │   ├── lecturer/       # Lecturer analytics, Moodle bank importer & IoT studio
│   │   ├── student/        # Student dashboard, assignments, achievements & history
│   │   ├── iot/            # Multi-file C++ IDE, firmware VM, Wokwi canvas & explorer
│   │   ├── simulator/      # OWASP Top 10 interactive pentest & patching simulator
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
