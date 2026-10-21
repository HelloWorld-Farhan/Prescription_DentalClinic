# 🛡️ Smile Clinic — Prescription Safety Portal (RxGuard)

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/Vite-6.1-646CFF?style=for-the-badge&logo=vite&logoColor=white"/>
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge"/>
</p>

<p align="center">
  <strong>RxGuard</strong> is the enterprise clinical decision support and prescription interaction screening portal for <strong>Smile Clinic</strong>. Built to safeguard dental patients against catastrophic adverse drug events, beta-lactam anaphylaxis, and organ clearance risks.
</p>

---

## 🔑 Demo Clinician Credentials

| Field | Value |
|---|---|
| **Email** | `rxguard@smileclinic.com` *(or `doctor@smileclinic.com`)* |
| **Password** | `RxGuard@Smile2026#` *(or `Doctor@Smile2026#`)* |
| **Name** | `Dr. Sarah Lin, PharmD (Clinical Prescriber)` |
| **NPI / Badge** | `RX-774021` |
| **Quick Action** | Click **"Auto-Fill"** on the sign-in screen for 1-click authentication. |

---

## ✨ Features & Architecture

- **Unified Smile Clinic Header**: Shared navigation header, logo sync (`localStorage`), notification drawer with unread badges, and clinician profile switcher matching the Doctor and Patient portals.
- **5-Step Progressive Screening Wizard**:
  1. *Patient Context*: Demographics, eGFR renal clearance, weight, pregnancy status.
  2. *Active Medications & Allergies*: Cross-referenced from patient history.
  3. *Proposed Prescriptions*: Drug, dosage, route, frequency, and dental templates.
  4. *AI Extraction Confirmation*: Pre-screening data review.
  5. *Safety Results*: Color-coded interaction tags (`Contraindicated`, `Major`, `Moderate`, `Safe`).
- **Interactive Monograph Drawer**: Slide-over drawer with detailed pharmacological mechanism, clinical impact, evidence grading (Class I/II/III), safer dental alternatives, and signed clinician override forms.
- **Printable Clinical Safety Report**: Print-optimized review report with prescriber attestation, verification QR code, and `window.print()` / PDF export.
- **HIPAA Audit Trail**: Complete immutable audit log of all safety screens, overrides with clinical rationales, and CSV export.
- **Rules Engine Admin**: Toggle clinic-specific interaction rules and safety thresholds.
- **SMART on FHIR Gateway**: Simulated FHIR R4 integration with St. Jude Health System EMR.

---

## 🚀 How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build production bundle
npm run build
```

---

## 🌐 Deployment to Hostinger / Vercel

### Option 1: Hostinger (Static / VPS Hosting)
1. Run `npm run build` locally or in CI/CD.
2. Upload the contents of the generated `dist/` folder directly to your Hostinger `public_html/` directory (via Hostinger File Manager or FTP).
3. If using Apache on Hostinger, ensure an `.htaccess` file is present in `public_html/` for SPA routing:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

### Option 2: Vercel (1-Click Automated)
1. Import the repository `https://github.com/HelloWorld-Farhan/Prescription_DentalClinic` into Vercel.
2. Framework Preset: **Vite**.
3. Root Directory: `./`.
4. Deploy! `vercel.json` is already configured for single-page routing.

---

## 📄 License
MIT License • Copyright (c) 2026 Farhan Khalid
