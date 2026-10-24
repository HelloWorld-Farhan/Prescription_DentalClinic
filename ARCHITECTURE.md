# SmileClinic — Prescription Portal Architecture & Technology Preferences

This document defines the core technical architecture, language preferences, database, hosting infrastructure, and authentication specifications for the **SmileClinic Prescription & Clinical Decision Support (CDS) System**.

---

## 1. Core Technology Stack & Language Preferences

| Layer | Language / Technology | Framework / Tools | Purpose & Justification |
| :--- | :--- | :--- | :--- |
| **Frontend** | **TypeScript** | React 19, Vite, Tailwind CSS, Framer Motion | High-performance, zero-latency clinical UI, type safety, responsive across operative tablets, desktop workstations, and mobile devices. |
| **Backend** | **Python (3.11+)** | FastAPI, Pydantic v2, Uvicorn, SQLAlchemy | Industry standard for medical CDS systems, asynchronous request processing, automatic OpenAPI/Swagger docs, high-speed pharmacological rule matching. |
| **Database** | **SQL (PostgreSQL 15+)** | Supabase / Neon (Hosted PostgreSQL) | ACID-compliant relational storage, Row-Level Security (RLS) for tenant isolation, permanent cloud persistence (never wipes). |
| **DevOps / Edge** | **Cloudflare Pages** | Cloudflare Edge Network, DNS Manager | Worldwide static distribution, unlimited free bandwidth, zero suspension risk, automatic SSL certificates. |
| **API Server** | **Render** | Web Service (Linux Environment) | Continuous GitHub integration, automated FastAPI deploys, live web logging. |
| **Liveness Watcher** | **UptimeRobot** | HTTP GET Cron Pinger (`/health`) | Pings Render every 10 minutes to prevent free-tier 15-minute cold starts (keeps API awake 24/7). |

---

## 2. Authentication, Signup & Medical Credentials Architecture

The system provides dual-mode authentication that is **100% free forever** with zero external subscription costs:

| Component | Technology | Cost | Description |
| :--- | :--- | :--- | :--- |
| **Google Sign-In / Sign-Up** | Google Identity Services (OAuth 2.0) | **$0.00** | Free Client ID from Google Cloud Console. 1-click seamless signup/login with automatic email verification and profile ingestion. |
| **Email & Password Auth** | Passlib (Bcrypt) + Python-Jose (JWT) | **$0.00** | Standard salted hash password storage with 256-bit encrypted JWT session tokens. |
| **Medical Credential Storage** | PostgreSQL Relational Schema | **$0.00** | Stores State Dental / Medical / Pharmacy License numbers and Clinic Organization ID. |

### PostgreSQL User & Credentials Schema:
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    hashed_password VARCHAR(255),              -- NULL for Google OAuth users
    auth_provider VARCHAR(20) DEFAULT 'email', -- 'email' | 'google'
    role VARCHAR(30) DEFAULT 'PHARMACIST',     -- 'DOCTOR', 'PHARMACIST', 'ADMIN'
    
    -- Professional Credential Numbers
    license_number VARCHAR(50),                -- State Dental / Pharmacy / Medical License
    clinic_id VARCHAR(50) NOT NULL,            -- Multi-tenant organization binding
    
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Authentication Flow (FastAPI + Google OAuth & Credentials):
1. **Google OAuth Token Exchange:** React frontend captures Google ID token $\rightarrow$ sends to `POST /api/v1/auth/google`.
2. **Cryptographic Verification:** FastAPI uses `google.oauth2.id_token.verify_oauth2_token` with your free Google Client ID.
4. **JWT Session Issue:** FastAPI issues a signed SmileClinic JWT bearer token containing role and tenant permissions for immediate dashboard entry.
