# Security Policy

## Supported Versions

Only the latest code on the `main` branch of `WebLabIFA` receives active security fixes and dependency updates:

| Version / Branch | Supported |
| ---------------- | --------- |
| `main`           | Yes       |
| Older snapshots  | No        |

## Reporting a Vulnerability

We take security vulnerabilities in WebLabIFA seriously across both the authentication/session backend (`Lab-Backend`) and the web/IoT simulator frontend (`Lab-FrontEnd`).

Please **do not** open public GitHub issues for suspected security vulnerabilities.

Instead, report vulnerabilities privately through GitHub Security Advisories:

1. Navigate to the repository's **Security** tab -> **Advisories** -> **Report a vulnerability**.
2. Provide a clear description including:
   - Affected component, endpoint, or simulator module
   - Reproduction steps or proof-of-concept request/payload
   - Potential impact (authentication bypass, privilege escalation, grading/anti-cheat bypass, XSS, XXE, etc.)
   - Any suggested remediation if known

## Response & Disclosure Timeline

- **Acknowledgment:** Within 3 business days of receiving a private report.
- **Triage & Assessment:** Within 7 business days with severity classification and reproduction confirmation.
- **Remediation & Coordination:** Fixes are prioritized by severity and verified through CI security workflows before public disclosure.

## Scope & Safe Testing Guidelines

- WebLabIFA contains intentionally sandboxed OWASP Top 10 and ESP32 IoT learning simulations. Findings must demonstrate an actual bypass of platform boundaries, server-side grading, RBAC/session isolation, or host/client security rather than expected behavior inside an isolated practice level.
- Avoid automated denial-of-service floods, credential stuffing against institutional accounts, or testing outside your own authorized local or staging instance.
