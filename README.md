# WebLabIFA

**WebLabIFA** is an interactive virtual laboratory and practicum platform for **Cyber Security (`OWASP Top 10:2025`)**, **Web Application Development**, and **Internet of Things (`ESP32-C3`, `ESP32`, `Arduino Uno`, `Arduino Mega`, `Raspberry Pi Pico W`)**. Learners practice offensive/defensive web security, full-stack web engineering, and embedded hardware simulation inside isolated, CSP-safe browser sandboxes without exposing host infrastructure.

---

## Key Features

### 1. Cyber Security Practicum (`OWASP Top 10:2025`)
- Guided step-by-step security labs covering hypothesis formulation, baseline capture, controlled exploitation probing, root-cause diagnosis, code patching, regression verification, and reflection.
- Progressive difficulty levels (`Easy -> Medium -> Hard -> Impossible`) with rubric-based scoring, unlockable hints, evidence inspection, and lecturer feedback.

### 2. Web App Development Studio (`/lab/web-dev`, `/lab/dosen/web-dev`)
- Dual-pane interactive coding IDE powered by **CodeMirror 6** with full HTML5, SVG, CSS3/4, JavaScript/TypeScript/JSX, Python, SQL, and JSON syntax highlighting, live diagnostics, formatting, and VS Code-style context-aware autocomplete.
- CSP-safe live DOM renderer built on `parse5` AST parsing with browser-standard HTML typography, sanitized attributes, inline/stylesheet CSS resolution, and simulated HTTP/FastAPI/PostgreSQL panes—with zero `eval` or unsafe `innerHTML`.
- Multi-file workspace, progressive XP missions, and lecturer review of saved student projects.

### 3. IoT Hardware & Firmware Simulator (`/lab/iot`, `/lab/dosen/iot`)
- Interactive circuit canvas supporting **ESP32-C3**, **ESP32 DevKit**, **Arduino Uno**, **Arduino Mega**, **Raspberry Pi Pico W**, and multi-MCU workspaces with blank canvas and preset templates.
- Multi-file C/C++ Arduino editor (`Main.ino`, `.h`, `.hpp`, `.c`, `.cpp`, `.html`, `.css`, `.js`) with cross-file autocomplete, firmware VM execution, `diagram.json` synchronization, and an embedded simulated **Web Browser** component for testing IoT WebServer routes and live sensor telemetry.
- Staged IoT missions, achievement badges, server-side wiring/firmware/`mqtts://` TLS validation, and tamper detection telemetry.

### 4. Moodle LMS Question Bank & Practicum Assignments
- Bilingual practice banks for Cyber Security and IoT supporting **Moodle XML**, **GIFT**, **Aiken**, and bounded **JSON** import/export with XXE/DOCTYPE blocking and HTML sanitization.
- Assignment builder with custom rubrics, attempt limits, deadline locks, leaderboard tracking, and formula-injection-safe CSV score export.

### 5. Strict Access Control, Approval Workflow & Security Monitor
- **Approval-First Google OIDC Login**: All non-bootstrap accounts (including institutional domains) require explicit **Admin** or **Lecturer** approval or **Excel (`.xlsx`) / CSV (`.csv`)** bulk pre-registration before a session can be issued.
- **Role-Based Access Control (RBAC)**: Multi-role support (`mahasiswa`, `dosen`, `admin`), granular 7-flag `user_access_rights`, immediate session revocation on role/status changes, and last-active-admin protection.
- **Account & Session Security**: Rotating `HttpOnly` + `Secure` + `SameSite=Lax` cookies, exact-origin CSRF validation, Authenticator App MFA (**TOTP**), **Argon2id**-hashed backup codes, WebAuthn passkeys, live security anomaly monitoring, audit logs, and sanitized backups. See [`.github/SECURITY.md`](.github/SECURITY.md) for vulnerability disclosure.

### 6. Accessibility & Experience
- Bilingual **Indonesian (`id`)** and **English (`en`)** interface, light/dark themes, responsive mobile navigation, and consistent pagination across portal tables.

---

## Technology Stack

| Layer | Technologies |
| --- | --- |
| **Backend API** | Rust, Axum, Tokio, Tower / Tower-HTTP, SQLx, OpenID Connect (`openidconnect`), Argon2id, SHA-256 |
| **Database** | PostgreSQL 17 with versioned SQLx migrations |
| **Frontend SPA** | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Lucide Icons |
| **Code Editors & Sandboxes** | CodeMirror 6 (`@codemirror/*`), Lezer grammars, `parse5` HTML5 AST parser, zero-dependency `.xlsx`/`.csv` spreadsheet parser |
| **Testing & Quality** | Cargo `test` / `clippy` / `rustfmt`, ESLint, TypeScript `tsc`, Playwright E2E, GitHub CodeQL |
| **Deployment** | Multi-stage Dockerfiles (minimal Rust runtime + non-root Nginx SPA proxy), Docker Compose |

---

## Repository Structure

```text
WebLabIFA/
├── .github/SECURITY.md        # Vulnerability disclosure policy
├── Lab-Backend/               # Rust + Axum REST API & PostgreSQL migrations
│   ├── src/
│   │   ├── config.rs          # Environment-driven OIDC, DB, and session config
│   │   ├── oidc.rs            # Google OIDC discovery & state/nonce/PKCE validation
│   │   ├── lib.rs             # Router wiring, approval gate, CSP/security headers
│   │   ├── moodle.rs          # Moodle XML/GIFT/Aiken & bounded JSON parser
│   │   ├── latihan.rs         # Practice question engine & platform settings
│   │   ├── portal/            # Student, Lecturer, Admin RBAC, Access Approval, IoT & Web Dev APIs
│   │   ├── simulator/         # Safe OWASP request/patch evaluation engine
│   │   ├── simulator_catalog/ # Structured OWASP Web & IoT lab scenarios
│   │   └── security_account/  # TOTP MFA, Argon2id backup codes, passkeys & monitor
│   ├── migrations/            # Versioned PostgreSQL SQLx migrations
│   └── Dockerfile             # Multi-stage minimal Rust runtime image
├── Lab-FrontEnd/              # React 19 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── login/             # Interactive atmospheric login scene & OIDC entry
│   │   ├── admin/             # Admin portal, RBAC modal & live security monitor
│   │   ├── lecturer/          # Lecturer analytics, Moodle bank & class management
│   │   ├── student/           # Student dashboard, assignments, achievements & history
│   │   ├── webdev/            # Web App Dev Studio (CodeMirror 6 + parse5 live preview)
│   │   ├── iot/               # Multi-file C++ IDE, firmware VM & circuit canvas
│   │   ├── simulator/         # OWASP Top 10 interactive pentest & patching studio
│   │   └── shared/            # i18n, approval & Excel/CSV import UI, MFA settings
│   ├── tests/                 # Playwright E2E test suites
│   └── Dockerfile             # Non-root Nginx container serving SPA + API proxy
├── compose.yaml               # Full stack orchestration (postgres, migrate, backend, frontend)
└── security/                  # Baseline security policies and configuration
```

---

## Running with Docker Compose

1. Create an untracked `.env` file with PostgreSQL credentials, `APP_BASE_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and `ALLOWED_EMAILS`.
2. Build and start all services:

```sh
docker compose --profile app up --build -d
```

By default, the web interface is exposed on `http://localhost:8080` and the backend API on `127.0.0.1:3008`.

---

## Local Development

### Prerequisites

- **Rust** toolchain (`cargo`, `clippy`, `rustfmt`)
- **Node.js** 22+ & `npm`
- **PostgreSQL** 17 (can be started standalone via `docker compose up -d postgres`)

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

### Backend

```sh
cargo fmt --manifest-path Lab-Backend/Cargo.toml --check
cargo clippy --manifest-path Lab-Backend/Cargo.toml --locked --all-targets -- -D warnings
cargo test --manifest-path Lab-Backend/Cargo.toml --locked
```

### Frontend

```sh
npm --prefix Lab-FrontEnd run typecheck
npm --prefix Lab-FrontEnd run lint
npm --prefix Lab-FrontEnd run build
npm --prefix Lab-FrontEnd run test:e2e
```
