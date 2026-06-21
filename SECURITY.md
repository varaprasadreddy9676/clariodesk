# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` (latest) | Yes |
| Older releases | No — please upgrade |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues by emailing: **varaprasadreddy9676@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce (proof of concept if possible)
- Impact assessment (what an attacker could do)
- Any suggested fix you have in mind

We will acknowledge receipt within **48 hours** and aim to release a fix within **7 days** for critical issues.

## What qualifies

- Authentication bypass or privilege escalation
- Remote code execution
- SQL injection or data exfiltration
- Sensitive data leakage (tokens, credentials, customer messages)
- Denial of service via resource exhaustion
- Cryptographic weaknesses in the encryption-at-rest implementation

## What doesn't qualify

- Theoretical vulnerabilities without a practical exploit
- Issues in development tooling (vitest, vite, etc.) that don't affect production
- Social engineering attacks
- Rate limiting on non-auth endpoints (by design for internal deployments)

## Security model

ClarioDesk is designed to be **self-hosted**. The threat model assumes:

- The operator controls the server and database
- Team members are trusted users (not adversarial)
- The primary attack surface is the API and the WhatsApp gateway bridge

We protect against:
- **Unauthorized access** — JWT auth, bcrypt-12, rate limiting on auth
- **Secrets leakage** — AES-256-GCM encryption at rest for API keys and session data
- **Webhook spoofing** — timing-safe secret comparison
- **XSS** — CSP headers via `@fastify/helmet`
- **Injection** — parameterized queries via Drizzle ORM

## Disclosure policy

We follow coordinated responsible disclosure. After a fix is released, we will publish a CVE and credit the reporter (unless they prefer to remain anonymous).
