import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Report() {
  const navigate = useNavigate();
  const [zoomScale, setZoomScale] = useState(1.0);

  // Dynamic logged in prescriber
  const prescriberName = sessionStorage.getItem('rxguard_prescriber_name') || 'Dr. Sarah Lin, PharmD';
  const prescriberRole = sessionStorage.getItem('rxguard_prescriber_role') || 'Lead Clinical Pharmacist';
  const prescriberNpi = sessionStorage.getItem('rxguard_prescriber_npi') || 'PH-88412';

  const handleZoomChange = (val: number) => {
    setZoomScale(val);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 1.3));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.65));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const reportData = {
      reportId: 'REP-2025-0419-892',
      sessionTrackingId: 'SES-4910-EHR-SYN',
      timestampUtc: '2026-04-14 09:32:18 UTC',
      facility: 'Smile Clinic Health System — Inpatient Surgery & Dental Oncology',
      reviewer: {
        name: prescriberName,
        role: prescriberRole,
        npi: prescriberNpi,
        signatureHash: '0x93FA892B104E412'
      },
      patient: {
        mrnHash: 'MRN-HASH-9042-X',
        age: 64,
        gender: 'Male',
        weightKg: 78.5,
        heightCm: 178,
        bsa: '1.96 m²',
        renal: {
          egfr: '42 mL/min/1.73m² (CKD-EPI)',
          stage: 'Stage 3b',
          creatinine: '1.82 mg/dL',
          crcl: '41.2 mL/min (Cockcroft-Gault)'
        }
      },
      evaluatedPrescription: {
        drug: 'Ciprofloxacin HCl 500 mg Oral Tablet',
        brand: 'Cipro',
        rxNorm: '197507',
        sig: '1 tab PO Q12H × 7 days',
        quantity: '14 Tablets',
        indication: 'Pyelonephritis (ICD-10: N10)',
        prescriber: 'Dr. Arthur Vance, MD (NPI: 1092837482)'
      },
      alertsEvaluated: [
        {
          ruleId: 'RENAL-ADJ-CIPRO-04',
          severity: 'High',
          finding: 'Fluoroquinolone + Reduced Renal Clearance (eGFR 42)',
          action: 'Reduce oral dose to 250-500 mg Q18-24H',
          status: 'Overridden with Protocol Justification',
          justification: 'Attack window high-dose therapy authorized with daily telemetry.'
        },
        {
          ruleId: 'DDI-WARFARIN-CIPRO-12',
          severity: 'Moderate',
          finding: 'Drug-Drug: Ciprofloxacin + Warfarin (CYP1A2 inhibition)',
          action: 'Monitor INR on Days 2, 4, 7; anticipate 20-30% Warfarin reduction',
          status: 'Acknowledged & Monitored'
        },
        {
          ruleId: 'ADMIN-CHEL-09',
          severity: 'Info',
          finding: 'Polyvalent Cation Chelation Timing with oral minerals',
          action: 'Space ingestion >= 2h before or 6h after multivalent ions',
          status: 'Resolved'
        }
      ],
      compliance: '21 CFR Part 11 and HIPAA Safe Harbor De-Identified Protocol Verified'
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'REP-2025-0419-892-Clinical-Verification.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full bg-background min-h-screen">
      {/* Top Document Controls & Breadcrumb Bar */}
      <header className="sticky top-0 z-30 w-full bg-surface-container-lowest px-4 sm:px-6 py-2.5 shadow-sm border-b border-surface-container-high/60">
        <div className="max-w-[1340px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-xs text-outline">
              <Link to="/dashboard" className="hover:text-primary transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-on-surface font-semibold">Verification Audit #REP-2025-0419-892</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary text-xs font-semibold">
                <span className="material-symbols-outlined text-[14px]">description</span>
                Clinical Verification &amp; Decision Support Report (A4 Printable Document)
              </span>
              <span className="text-xs text-outline hidden lg:inline">• Verified Safe Harbor Export</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Zoom Controller */}
            <div className="flex items-center bg-surface-container-low rounded-xl px-2 py-1 gap-1 border border-surface-container-high">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                title="Zoom Out"
              >
                <span className="material-symbols-outlined text-[16px] block">remove</span>
              </button>
              <select
                value={zoomScale}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="bg-transparent text-xs font-semibold text-on-surface outline-none cursor-pointer px-1 py-0.5"
              >
                <option value={0.75}>75% Compact</option>
                <option value={0.8}>Fit to Page (80%)</option>
                <option value={1.0}>100% (Standard)</option>
                <option value={1.15}>Fit to Width (115%)</option>
              </select>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                title="Zoom In"
              >
                <span className="material-symbols-outlined text-[16px] block">add</span>
              </button>
            </div>

            {/* Export JSON Button */}
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">data_object</span>
              <span>Export JSON</span>
            </button>

            {/* Download PDF / Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-container text-secondary hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Download PDF</span>
            </button>

            {/* Print Report Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm text-xs font-bold"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Report</span>
            </button>

            {/* Close Preview */}
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-outline hover:text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>
      </header>

      {/* Dark Slate PDF Presentation Viewport */}
      <main className="w-full bg-[#1E293B] py-8 px-2 sm:px-6 flex flex-col items-center min-h-[calc(100vh-120px)] transition-all overflow-x-auto">
        {/* Floating Document Canvas Pagination Indicator */}
        <div className="mb-6 flex items-center gap-3 bg-[#0F172A]/90 text-white px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span>A4 Document Format (210 × 297 mm)</span>
          </div>
          <span className="text-slate-500">•</span>
          <span>Page 1 of 2</span>
          <span className="text-slate-500">•</span>
          <span className="text-sky-300 font-semibold">Confidential Clinical Attestation</span>
        </div>

        {/* Scalable Document Container Wrapper */}
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
            marginBottom: zoomScale > 1 ? `${(zoomScale - 1) * 700}px` : '20px'
          }}
          className="w-full flex justify-center transition-transform duration-200"
        >
          {/* High-Fidelity A4 White Sheet (Simulated Physical Paper) */}
          <article className="w-full max-w-[820px] bg-white text-[#0F172A] rounded-sm shadow-2xl p-6 sm:p-10 flex flex-col gap-6 print:shadow-none print:p-0 print:max-w-none">
            {/* SECTION A: Document Clinical Masthead & Verification Header */}
            <header className="flex flex-col gap-4 pb-4 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#005c65] text-white flex items-center justify-center shadow-sm">
                    <span className="material-symbols-outlined text-[28px]">shield_with_heart</span>
                  </div>
                  <div>
                    <div className="text-xl font-bold tracking-tight text-[#005c65] leading-tight">
                      Smile Clinic RxGuard CDS Engine
                    </div>
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      Clinical Decision Support &amp; Verification Protocol
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-teal-50 text-teal-800 font-bold text-[11px] uppercase tracking-wider border border-teal-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                    <span>Audit Authenticated</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono">HASH: SHA256-4f8b9e892c21a</div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <h1 className="text-lg font-bold text-slate-900 mb-3 tracking-tight">
                  PRESCRIPTION SAFETY &amp; CDS VERIFICATION REPORT
                </h1>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                      Report Identifier
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">REP-2025-0419-892</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                      Session Tracking ID
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">SES-4910-EHR-SYN</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                      Timestamp (UTC)
                    </span>
                    <span className="font-semibold text-slate-800">2026-04-14 09:32:18 UTC</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                      Clinical Facility
                    </span>
                    <span className="font-semibold text-slate-800">
                      Smile Clinic Health System — Inpatient Surgery
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                      Reviewing Pharmacist
                    </span>
                    <span className="font-semibold text-slate-800">
                      {prescriberName} (Lic #{prescriberNpi})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                      Attestation Protocol
                    </span>
                    <span className="font-semibold text-slate-800">CDS § 10.4 / HIPAA Safe Harbor</span>
                  </div>
                </div>
              </div>
            </header>

            {/* SECTION B: Overall Clinical Assessment Banner */}
            <section className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex flex-col gap-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Overall Screening Status:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#007782] text-white text-xs font-bold shadow-xs">
                    <span className="material-symbols-outlined text-[15px]">rate_review</span>
                    <span>Needs Professional Review</span>
                  </span>
                </div>
                <div className="text-xs text-sky-800 font-semibold">
                  Dispensing Release: <strong className="text-slate-900">Conditioned on Prescriber Consultation</strong>
                </div>
              </div>
              <div className="text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg flex items-start gap-2 border border-sky-100">
                <span className="material-symbols-outlined text-sky-600 text-[18px] shrink-0 mt-0.5">info</span>
                <span>
                  Clinical decision support only. Not a definitive safety declaration. Confirm with a licensed prescriber or pharmacist. Quantitative Check Matrix: <strong>9 Checks Evaluated</strong> • <strong>2 Alerts Flagged</strong> • <strong>1 Overridden</strong> • <strong>1 Acknowledged</strong> • <strong>0 Unresolved Blockers</strong>
                </span>
              </div>
            </section>

            {/* SECTION C & D: Bento Grid (Patient Demographics + Candidate Rx) */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* C: Patient Context (Pseudonymized Safe Harbor) */}
              <div className="md:col-span-5 bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200/80">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-[#005c65]">Patient Demographics</span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-[10px] font-mono text-slate-700">
                      De-Identified
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Patient MRN Hash:</span>
                      <span className="font-mono font-semibold text-slate-800">MRN-HASH-9042-X</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Age &amp; Gender:</span>
                      <span className="font-semibold text-slate-800">64y Male</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Weight / Height:</span>
                      <span className="font-semibold text-slate-800">78.5 kg / 178 cm (BSA: 1.96 m²)</span>
                    </div>
                    <div className="pt-2 flex flex-col gap-1">
                      <span className="text-slate-500 block text-[11px] font-semibold">Renal Clearance Profile:</span>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col gap-1 text-[11px]">
                        <div className="flex justify-between text-slate-800">
                          <span>eGFR (CKD-EPI):</span>
                          <span className="font-bold text-rose-600">42 mL/min/1.73m² (Stage 3b)</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Serum Creatinine:</span>
                          <span className="font-semibold">1.82 mg/dL</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>CrCl (Cockcroft-Gault):</span>
                          <span className="font-semibold">41.2 mL/min</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-200">
                  Unit: Inpatient Dental Surgery / Nephrology Consult
                </div>
              </div>

              {/* D: Candidate Prescription Details */}
              <div className="md:col-span-7 bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-[#005c65]">Evaluated Prescription Order</span>
                    <span className="px-2 py-0.5 rounded bg-[#007782] text-white text-[10px] font-bold">
                      New Candidate Rx
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <div className="text-base font-bold text-slate-900">Ciprofloxacin HCl (Brand: Cipro)</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        RxNorm: 197507 • ATC: J01MA02 • Class: Fluoroquinolone
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dosage Form:</span>
                        <span className="font-semibold text-slate-800">500 mg Oral Tablet (Film-Coated)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sig &amp; Frequency:</span>
                        <span className="font-semibold text-slate-800">1 tab PO Q12H × 7 days</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Quantity:</span>
                        <span className="font-semibold text-slate-800">14 Tablets (0 Refills)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Clinical Indication:</span>
                        <span className="font-semibold text-slate-800">Acute Dental Infection / Pyelonephritis</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] flex flex-col sm:flex-row justify-between text-slate-500 gap-1 pt-3 border-t border-slate-100">
                  <div>
                    <span>Prescriber: </span>
                    <strong className="text-slate-800">Dr. Arthur Vance, MD</strong>
                    <span className="font-mono text-slate-400"> (NPI: 1092837482)</span>
                  </div>
                  <div className="font-mono text-slate-400 text-[10px]">
                    E-Prescribe Scan: SHA256:89fa2...a98 verified
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION E: Active Medications & Allergy Profile */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Active Medications */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sky-600 text-[18px]">medication</span>
                  <span>Concurrent Medications Profile</span>
                </div>
                <ul className="space-y-2 text-xs">
                  <li className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900">Coumadin (Warfarin Sodium)</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold">
                        NTI Drug
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5 text-[11px]">5 mg Oral PO, Once Daily at bedtime</div>
                    <div className="text-slate-400 text-[10px] mt-1 font-mono">
                      Target INR 2.0-3.0 • Indication: Atrial Fibrillation
                    </div>
                  </li>
                  <li className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900">CoQ10 (Ubiquinone)</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                        Supplement
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5 text-[11px]">100 mg Softgel PO, Twice daily with meals</div>
                  </li>
                </ul>
              </div>

              {/* Documented Allergies */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-rose-600 text-[18px]">emergency</span>
                  <span>Allergies &amp; Hypersensitivities</span>
                </div>
                <ul className="space-y-2 text-xs">
                  <li className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-700">Penicillins (Amoxicillin, Ampicillin)</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold">
                        Severe / Confirmed
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5 text-[11px]">
                      Reaction: Facial angioedema &amp; acute urticaria
                    </div>
                  </li>
                  <li className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Lisinopril</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                        Intolerance
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5 text-[11px]">Side Effect: Persistent nocturnal dry cough</div>
                  </li>
                  <li className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Codeine</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">
                        Mild Intolerance
                      </span>
                    </div>
                    <div className="text-slate-600 mt-0.5 text-[11px]">Reaction: Severe nausea / gastric upset</div>
                  </li>
                </ul>
              </div>
            </section>

            {/* SECTION F: Safety Alerts & CDS Rule Evaluations Table */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Algorithmic Safety Evaluations &amp; Clinical Rules
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Engine Query Duration: 142 ms</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Clinical Finding &amp; Interplay</th>
                      <th className="py-2.5 px-3">Evidence Source &amp; Rule ID</th>
                      <th className="py-2.5 px-3">Recommended Action</th>
                      <th className="py-2.5 px-3 text-right">Reviewer Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {/* Row 1 */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 align-top">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">error</span>
                          High
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900">Fluoroquinolone + Reduced Renal Clearance</div>
                        <div className="text-slate-500 mt-0.5 text-[11px]">
                          eGFR 42 mL/min/1.73m² (CrCl 41.2). Ciprofloxacin accumulation may heighten neurotoxicity and QTc prolongation.
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono text-[10px] text-[#005c65] font-bold">RENAL-ADJ-CIPRO-04</div>
                        <div className="text-slate-400 text-[10px]">FDA Boxed / KDIGO 2026</div>
                      </td>
                      <td className="py-3 px-3 align-top text-slate-600">
                        Reduce oral dose to 250–500 mg Q18–24H based on renal trajectory.
                      </td>
                      <td className="py-3 px-3 align-top text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-semibold">
                          Overridden
                        </span>
                      </td>
                    </tr>
                    {/* Row 2 */}
                    <tr className="bg-amber-50/30 hover:bg-amber-50/50">
                      <td className="py-3 px-3 align-top">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                          <span className="material-symbols-outlined text-[13px]">warning</span>
                          Moderate
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900">Drug-Drug: Ciprofloxacin + Warfarin</div>
                        <div className="text-slate-500 mt-0.5 text-[11px]">
                          CYP1A2 inhibition and gut microbiome disruption may significantly increase INR and bleeding risk.
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono text-[10px] text-[#005c65] font-bold">DDI-WARFARIN-CIPRO-12</div>
                        <div className="text-slate-400 text-[10px]">Lexicomp / FDB v2026.1</div>
                      </td>
                      <td className="py-3 px-3 align-top text-slate-600">
                        Monitor INR on Days 2, 4, and 7; anticipate 20-30% Warfarin dose reduction.
                      </td>
                      <td className="py-3 px-3 align-top text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] font-medium">
                          Acknowledged
                        </span>
                      </td>
                    </tr>
                    {/* Row 3 */}
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 align-top">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-semibold">
                          <span className="material-symbols-outlined text-[13px]">info</span>
                          Info
                        </span>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-bold text-slate-900">Polyvalent Cation Chelation Timing</div>
                        <div className="text-slate-500 mt-0.5 text-[11px]">
                          Space ingestion ≥2h before or 6h after multivalent ions/dairy supplements.
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="font-mono text-[10px] text-[#005c65] font-bold">ADMIN-CHEL-09</div>
                        <div className="text-slate-400 text-[10px]">USP Monograph 2026</div>
                      </td>
                      <td className="py-3 px-3 align-top text-slate-600">
                        Append nursing MAR administration interval guidance.
                      </td>
                      <td className="py-3 px-3 align-top text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                          Resolved
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION G: Algorithmic Limitations & Data Quality Disclaimers */}
            <section className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">verified_user</span>
                <span>Algorithmic Model Limitations &amp; Boundary Disclaimers</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside">
                <li>
                  <strong className="text-slate-800">Sparse Longitudinal Baseline:</strong> Only 1 recent serum creatinine recorded in the preceding 7 days; trajectory could represent resolving vs worsening acute kidney injury.
                </li>
                <li>
                  <strong className="text-slate-800">Pharmacogenomic Absence:</strong> Genotype profiles (<code className="font-mono text-[11px]">CYP2C9</code> / <code className="font-mono text-[11px]">VKORC1</code>) absent in EHR stream; population standard pharmacokinetic models utilized.
                </li>
                <li>
                  <strong className="text-slate-800">Self-Reported Supplements:</strong> Reconciliation depends on patient self-reported admission intake history.
                </li>
              </ul>
            </section>

            {/* SECTION H: Reviewer Decisions & Digital Attestation Trail */}
            <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#005c65] text-[20px]">draw</span>
                  <span className="text-sm font-bold text-slate-900">
                    Pharmacist Clinical Decisions &amp; Override Audit
                  </span>
                </div>
                <span className="text-xs text-[#005c65] font-bold">21 CFR Part 11 Compliant Sign-off</span>
              </div>
              <div className="space-y-3 text-xs">
                {/* Decision 1 */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Decision on Rule: <code className="font-mono text-[#005c65] font-bold">RENAL-ADJ-CIPRO-04</code>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                      OVERRIDDEN WITH PROTOCOL
                    </span>
                  </div>
                  <div className="text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                    “Prescribing physician Dr. Vance contacted at 09:25. Patient exhibits acute severe dental/renal sepsis requiring immediate peak bactericidal tissue concentrations. High-dose oral regimen (500mg Q12H) authorized for initial 48-hour attack window under daily renal panel tracking and telemetry. Step-down to 250mg Q12H pre-scheduled for Day 3 if clearance remains below 50 mL/min.”
                  </div>
                </div>

                {/* Decision 2 */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Decision on Rule: <code className="font-mono text-[#005c65] font-bold">DDI-WARFARIN-CIPRO-12</code>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-bold">
                      ACKNOWLEDGED &amp; MONITORED
                    </span>
                  </div>
                  <div className="text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                    “Morning baseline INR verified at 2.3. Recurring lab order placed for INR assessment on Days 2, 4, and 7 concurrent with antibiotic cycle.”
                  </div>
                </div>

                {/* Attestation Box */}
                <div className="bg-teal-50 border border-teal-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[#005c65] text-[20px] mt-0.5">check_circle</span>
                    <div className="text-xs text-slate-800">
                      <div className="font-bold">Reviewer Attestation Statement</div>
                      <div className="text-slate-600 mt-0.5">
                        I certify that I have evaluated this prescription against all algorithmic CDS safety flags, verified clinical context directly with the prescriber, and take professional clinical responsibility for this verification.
                      </div>
                    </div>
                  </div>
                  <div className="sm:text-right shrink-0 bg-white px-3 py-2 rounded-lg border border-teal-100 shadow-2xs">
                    <div className="font-bold text-slate-900 text-xs">{prescriberName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Digital Sig: 0x93FA...E412</div>
                    <div className="text-[10px] text-[#005c65] font-medium">2026-04-14 09:32:18 UTC</div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION I: Formal Document Footer */}
            <footer className="pt-4 flex flex-col gap-2 text-[10px] text-slate-400 border-t border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2">
                <div>
                  <span className="block text-slate-700 font-semibold">Rules Engine</span>
                  <span>Smile Clinic CDS v4.2.1-prod</span>
                </div>
                <div>
                  <span className="block text-slate-700 font-semibold">Knowledge Base</span>
                  <span>FDB &amp; RxNorm 2026-02-B</span>
                </div>
                <div>
                  <span className="block text-slate-700 font-semibold">Guidelines</span>
                  <span>CPIC 1A • Beers • KDIGO 24</span>
                </div>
                <div>
                  <span className="block text-slate-700 font-semibold">Explanation Model</span>
                  <span>BioMed-CDS-LLM v2.3</span>
                </div>
              </div>
              <div className="text-center sm:text-left pt-2 text-[10px] text-slate-500">
                Clinical decision support only. Not a definitive safety declaration. Confirm with a licensed prescriber or pharmacist. Generated in full compliance with 21 CFR Part 11 and HIPAA Security Rule. Electronic Record Signature Verified.
              </div>
            </footer>
          </article>
        </div>

        {/* Secondary Sheet Thumbnail / Page 2 Hint */}
        <div className="mt-8 flex items-center gap-2 text-slate-400 text-xs">
          <span className="material-symbols-outlined text-[16px]">menu_book</span>
          <span>End of Preview Page 1 — Pharmacokinetic Curves &amp; Raw Monograph Dossier located on Page 2</span>
        </div>
      </main>

      {/* Global Clinical Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-outline text-xs gap-2">
          <div>© 2026 Smile Clinic Healthcare Technologies. RxGuard CDS Decision Support Engine.</div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-700 font-medium">HIPAA / HITECH Compliant</span>
            <span>CDS Authority Level 3</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
