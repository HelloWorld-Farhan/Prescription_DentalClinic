# Frontend Environment Variables Reference Guide

> **Project:** `Prescription_DentalClinic` (React 19 + Vite)  
> **Location:** Local `.env` (Never committed to GitHub)

This document details every environment variable used in the Prescription DentalCare Portal frontend, what service it links to, and its exact purpose.

---

## Complete Variables Table

| Variable Name | Provider / Target | Purpose & Description | Where it is Used in Code |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Supabase** | The direct PostgreSQL connection URI (used for direct migrations or backend pairing). | Reference connection |
| `DB_PASSWORD` | **Supabase** | The plain-text password for the PostgreSQL `postgres` user. | Reference credential |
| `VITE_SUPABASE_URL` | **Supabase** | The public HTTPS project URL for Supabase (`https://eikncobxyhvpnoondfqk.supabase.co`). | Client REST / Realtime |
| `VITE_API_URL` | **Render Backend** | The live Python FastAPI server endpoint (`https://dentalclinic-backend-eiav.onrender.com`). | All API requests (`fetch` calls for drug checks, auth, and audit logs) |
| `VITE_FIREBASE_API_KEY` | **Firebase (Google Auth Only)** | Public client key to authenticate Google 1-Click Sign-In requests. | Google 1-Click Auth |
| `VITE_FIREBASE_AUTH_DOMAIN` | **Firebase (Google Auth Only)** | OAuth redirect domain (`smileclinic-auth.firebaseapp.com`) for Google Sign-In popups. | Google 1-Click Auth |
| `VITE_FIREBASE_PROJECT_ID` | **Firebase (Google Auth Only)** | Project identifier (`smileclinic-auth`) linking your app to Google Sign-In. | Google 1-Click Auth |
| `VITE_FIREBASE_STORAGE_BUCKET` | **Firebase (Reserved for later)** | Storage bucket (Unused for now; reserved for future file uploads). | Inactive for now |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | **Firebase (Reserved for later)** | Project number (Unused for now; reserved for future push notifications). | Inactive for now |
| `VITE_FIREBASE_APP_ID` | **Firebase (Google Auth Only)** | Web app registration ID binding the frontend client to Google Auth. | Google 1-Click Auth |
| `VITE_FIREBASE_MEASUREMENT_ID` | **Google Analytics (Optional)** | Analytics measurement ID (Unused for now). | Inactive for now |


---

## Security Reminders
1. Variables prefixed with **`VITE_`** are bundled into the client build and read via `import.meta.env.VITE_*`.
2. Do **not** commit `.env` to GitHub. It is permanently ignored in `.gitignore`.
3. For Cloudflare Pages production builds, configure these in **Cloudflare Dashboard $\rightarrow$ Pages $\rightarrow$ Project Settings $\rightarrow$ Environment Variables**.
