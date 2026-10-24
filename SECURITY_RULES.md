# CRITICAL SECURITY RULE: ZERO HARDCODED CREDENTIALS

> **MANDATORY POLICY FOR ALL DEVELOPERS AND AGENTS**  
> **Repository:** `Prescription_DentalClinic` (Public GitHub)

---

## 1. Absolute Prohibition on Hardcoded Secrets
* **NEVER** write backend URLs, database strings, API endpoints, tokens, or credentials directly into any TypeScript, JavaScript, HTML, or config file.
* **NEVER** commit `.env` or `.env.*` files to Git. Both are permanently blocked in `.gitignore`.
