<h1 align="center">🦷 Prescription DentalCare Portal — Clinical Safety & Interaction Decision System</h1>

<p align="center">
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19"/>
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion"/>
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge" alt="MIT License"/>
</p>

<p align="center">
  <strong>Prescription DentalCare Portal (Smile Clinic RxGuard)</strong> is an enterprise clinical decision support and prescription interaction screening web application built for dental clinicians and clinical pharmacists.<br/>
  It provides real-time drug-drug interaction screening, beta-lactam allergy cross-sensitivity detection, organ clearance threshold evaluation,<br/>
  interactive pharmacological monographs, signed clinician override tracking, and printable legal clinical review reports.
</p>

---

## 🔑 Demo Clinician Credentials

| Field | Value |
|---|---|
| **Email** | `rxguard@smileclinic.com` *(also accepts `doctor@smileclinic.com`)* |
| **Password** | `RxGuard@Smile2026#` *(also accepts `Doctor@Smile2026#`)* |
| **Name** | `Dr. Sarah Lin, PharmD (Clinical Prescriber)` |
| **NPI / Badge** | `RX-774021` |
| **Quick Action** | Click **"Auto-Fill"** on the sign-in screen for 1-click authentication. |

---

## ✨ Features

| Feature | Description |
|---|---|
| 🛡️ **Prescription Safety Dashboard** | Real-time clinical feed, department filters (`Dental Surgery`, `ICU`, `Operatory 01`), screening KPIs, high-severity warning telemetry, and quick review modals. |
| ⚡ **5-Step Progressive Screening Wizard** | End-to-end clinical workflow: Patient Context (eGFR, weight, pregnancy) → Active Meds & Allergies → Proposed Prescriptions → Reconciliation Review → Safety Results. |
| 💊 **Quick Dental Regimens** | One-click clinical dental order templates: Amoxicillin 500mg (Antibiotic), Ibuprofen 600mg (NSAID), Clindamycin 300mg (Allergy Alternative), and Tramadol 50mg. |
| ⚠️ **Real-Time Interaction Screening** | Automatic pharmacopeia rule matching categorizing findings into `Contraindicated` 🔴, `Major` 🟠, `Moderate` 🟡, and `Safe to Dispense` 🟢. |
| 📖 **Interactive Monograph Drawer** | Slide-over drawer presenting detailed pharmacological mechanism, expected clinical impact, evidence grading (Class I/II/III), and safer dental alternatives. |
| ✍️ **Clinician Override Attestation** | Built-in clinical override form with predefined justification presets and free-text reasoning, logged with prescriber NPI for legal compliance. |
| 🖨️ **Printable Review Report Preview** | Print-optimized clinical review document featuring verification QR code, demographic breakdown, evaluated drug pairings, and prescriber signature attestation block. |
| 📋 **HIPAA & Clinical Audit Trail** | Immutable log tracking all screening queries, alert dismissals, and overrides with real-time CSV data export. |
| 🗄️ **Rules Engine & Pharmacopeia Admin** | Clinic-level interaction rule management allowing authorized staff to inspect, activate, or disable drug-drug and drug-allergy rules. |
| ⚙️ **Practice Sensitivity & FHIR Gateway** | 3 sensitivity profiles (`Strict`, `Standard`, `Critical Only`), hard-stop toggles, and live SMART on FHIR v4.0.1 status with St. Jude Health EMR. |
| 🔔 **Notification Tray & Profile Switcher** | Alert notification tray with unread filters and quick switcher linking directly to the live Doctor and Patient portals. |
| 📱 **100% Responsive Clinical UI** | Healthcare-tailored color palette, crisp typography (Inter), glassmorphic backdrops, portaled slide-overs, and seamless mobile responsiveness. |

---

## 💻 How to Build (For Developers)

Before you begin, ensure you have **[Node.js](https://nodejs.org/)** (v18.0.0 or higher recommended) and **npm** installed on your system.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/HelloWorld-Farhan/Prescription_DentalClinic.git
cd Prescription_DentalClinic
```

### Step 2 — Install Dependencies

```bash
npm install
```

### Step 3 — Run Locally

```bash
npm run dev
```

> The application will be running live at `http://localhost:5173`.

### Step 4 — Build for Production

```bash
npm run build
```

> Your optimized production bundle will be generated inside the `dist/` directory.

---

## 📁 Project Structure

```text
Prescription_DentalClinic/
├── public/
├── src/
│   ├── components/
│   │   ├── Layout.tsx               # Top navigation, Smile Clinic brand, notifications & profile
│   │   ├── AlertDetailDrawer.tsx    # Monograph slide-over, mechanism & clinician override attestation
│   │   ├── PrintableReportModal.tsx # Printable clinical review document with QR & signature
│   │   └── Toast.tsx                # Clinical notification feedback toasts
│   ├── data/
│   │   └── virtualDb.ts             # Virtual database, patients, interaction rules & screening engine
│   ├── pages/
│   │   ├── Dashboard.tsx            # Safety screening dashboard, KPIs & live feed
│   │   ├── NewCheck.tsx             # 5-step interactive prescription screening wizard
│   │   ├── Alerts.tsx               # Alerts management queue with severity filters
│   │   ├── AuditLog.tsx             # HIPAA clinical audit trail with CSV export
│   │   ├── RulesAdmin.tsx           # Interaction rules manager & toggle admin
│   │   ├── Settings.tsx             # Alert sensitivity, logo sync & SMART on FHIR gateway
│   │   └── Login.tsx                # Clinician sign-in & consent portal
│   ├── types/
│   │   └── index.ts                 # TypeScript clinical and interaction interfaces
│   ├── App.tsx                      # Client-side router configuration
│   ├── main.tsx                     # React application entrypoint
│   └── index.css                    # Tailwind directives, custom scrollbars & design tokens
├── tailwind.config.js               # Clinical theme colors and spacing
├── tsconfig.json                    # TypeScript strict compiler options
├── vercel.json                      # Single-page application route rewrites
└── package.json                     # Project scripts and dependencies
```

---

## 🌐 Deployment to Hostinger / Vercel

### Option 1: Hostinger (Static / VPS Hosting)
1. Run `npm run build` locally or in your CI/CD pipeline.
2. Upload all files from the `dist/` folder into your Hostinger `public_html/` directory.
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
4. Click **Deploy**.

---

## 👨‍💻 Author

**Farhan Khalid**

📧 [farhankhalid17968@gmail.com](mailto:farhankhalid17968@gmail.com)  
🔗 [LinkedIn](https://www.linkedin.com/in/farhan-khalid-117514259/)  
🐙 [GitHub](https://github.com/HelloWorld-Farhan)

---

## 📄 License

```text
MIT License

Copyright (c) 2026 Farhan Khalid

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🌟 Support

If you found this clinical portal helpful, please consider giving it a ⭐ on GitHub!

<p align="center">Made with ❤️ in India</p>
