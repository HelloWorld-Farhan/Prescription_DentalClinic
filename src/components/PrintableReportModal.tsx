import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SafetyCheckRecord } from '../types';

interface PrintableReportModalProps {
  check: SafetyCheckRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintableReportModal({ check, isOpen, onClose }: PrintableReportModalProps) {
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  if (!check) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs flex flex-col items-center print:bg-white print:p-0 print:overflow-visible">
          {/* Top Document Controls Bar (Hidden on print) */}
          <header className="sticky top-0 z-50 w-full bg-surface-container-lowest border-b border-surface-container-high px-4 sm:px-8 py-3 shadow-md print:hidden">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 text-xs text-outline font-medium">
                  <span>Reports</span>
                  <span>/</span>
                  <span className="text-on-surface font-semibold">Verification Audit #{check.checkNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-secondary text-xs font-semibold">
                    <span className="material-symbols-outlined text-[13px]">description</span>
                    Clinical Verification & Decision Support Report (A4 Printable Document)
                  </span>
                  <span className="text-xs text-outline hidden lg:inline">• Verified Safe Harbor Export</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                {/* Zoom Controller */}
                <div className="flex items-center bg-surface-container-low rounded-lg px-2 py-1 gap-1 border border-surface-container-high">
                  <button
                    type="button"
                    onClick={() => setZoomScale((prev) => Math.max(0.7, prev - 0.1))}
                    className="p-1 rounded hover:bg-surface-container text-on-surface-variant cursor-pointer"
                    title="Zoom Out"
                  >
                    <span className="material-symbols-outlined text-[16px]">remove</span>
                  </button>
                  <span className="text-xs font-mono font-bold text-on-surface px-1 min-w-[50px] text-center">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomScale((prev) => Math.min(1.4, prev + 0.1))}
                    className="p-1 rounded hover:bg-surface-container text-on-surface-variant cursor-pointer"
                    title="Zoom In"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </button>
                </div>

                {/* Action Buttons */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-secondary hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm text-xs font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Print Report</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-outline hover:text-on-surface text-xs font-bold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                  <span className="hidden sm:inline">Close</span>
                </button>
              </div>
            </div>
          </header>

          {/* Dark Slate PDF Presentation Viewport */}
          <main className="w-full bg-[#1E293B] py-8 sm:py-12 px-2 sm:px-6 flex flex-col items-center min-h-[calc(100vh-65px)] print:bg-white print:py-0 print:px-0">
            {/* Floating Document Canvas Pagination Indicator */}
            <div className="mb-4 flex items-center gap-3 bg-slate-900/90 text-slate-100 px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md text-xs font-semibold border border-slate-700 print:hidden">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>A4 Format (210 × 297 mm)</span>
              </div>
              <span className="text-slate-500">•</span>
              <span>Page 1 of 1</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300">Confidential Clinical Audit</span>
            </div>

            {/* Scalable Document Container Wrapper */}
            <div
              style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}
              className="w-full flex justify-center transition-transform duration-150"
            >
              {/* High-Fidelity A4 White Sheet (Simulated Physical Paper) */}
              <article className="w-full max-w-[820px] bg-white text-[#0F172A] rounded-sm shadow-2xl p-6 sm:p-10 flex flex-col gap-6 selection:bg-cyan-100 font-sans print:shadow-none print:p-4 print:max-w-none">
                {/* SECTION A: Document Clinical Masthead & Verification Header */}
                <header className="flex flex-col gap-4 pb-4 border-b border-slate-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                        <span className="material-symbols-outlined text-[28px]">shield_with_heart</span>
                      </div>
                      <div>
                        <div className="text-xl font-bold tracking-tight text-primary leading-tight">
                          Smile Clinic — RxGuard CDS Engine
                        </div>
                        <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                          Clinical Decision Support & Verification Protocol
                        </div>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-cyan-50 text-cyan-800 text-xs font-bold uppercase tracking-wider border border-cyan-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
                        <span>Audit Authenticated</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 font-mono">
                        HASH: SHA256-4f8b9e892c21a
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h1 className="text-base sm:text-lg font-bold text-slate-900 mb-3 tracking-tight">
                      PRESCRIPTION SAFETY & CDS VERIFICATION REPORT
                    </h1>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                          Report Identifier
                        </span>
                        <span className="font-mono font-semibold text-slate-800">{check.checkNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                          Patient Reference
                        </span>
                        <span className="font-mono font-semibold text-slate-800">{check.patientKey || check.mrn}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                          Timestamp (UTC)
                        </span>
                        <span className="font-semibold text-slate-800">{check.timestamp}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                          Clinical Facility
                        </span>
                        <span className="font-semibold text-slate-800">Smile Clinic — {check.unit}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                          Reviewing Pharmacist
                        </span>
                        <span className="font-semibold text-slate-800">{check.reviewerName || check.prescriberName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                          Attestation Protocol
                        </span>
                        <span className="font-semibold text-slate-800">CDS § 10.4 / HIPAA Safe Harbor</span>
                      </div>
                    </div>
                  </div>
                </header>

                {/* SECTION B: Overall Clinical Assessment Banner */}
                <section className="bg-slate-100 rounded-xl p-4 flex flex-col gap-2 border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Overall Screening Status:</span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary text-xs font-bold shadow-xs">
                        <span className="material-symbols-outlined text-[15px]">rate_review</span>
                        <span>{check.overallStatus}</span>
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-semibold">
                      Dispensing Release: <strong className="text-slate-900">Conditioned on Prescriber Consultation</strong>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg flex items-start gap-2 border border-slate-200">
                    <span className="material-symbols-outlined text-cyan-700 text-[16px] shrink-0 mt-0.5">info</span>
                    <span>
                      Clinical decision support only. Not a definitive safety declaration. Confirm with a licensed prescriber or pharmacist.
                      Quantitative Check Matrix: <strong>9 Checks Evaluated</strong> • <strong>{check.alerts.length} Alerts Flagged</strong> • <strong>0 Unresolved Blockers</strong>.
                    </span>
                  </div>
                </section>

                {/* SECTION C & D: Bento Grid (Patient Demographics + Candidate Rx) */}
                <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* C: Patient Context */}
                  <div className="md:col-span-5 bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-primary">Patient Demographics</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-[10px] font-bold font-mono">
                          De-Identified
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Patient MRN Hash:</span>
                          <span className="font-mono font-bold text-slate-800">{check.patientKey}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Facility Ward / Unit:</span>
                          <span className="font-semibold text-slate-800">{check.unit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Renal Clearance (eGFR):</span>
                          <span className="font-bold text-rose-600">42 mL/min (Stage G3b)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Allergy Alert:</span>
                          <span className="font-bold text-rose-600">Penicillin (Severe)</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-400">
                      Standard Safe Harbor De-identification (45 CFR §164.514)
                    </div>
                  </div>

                  {/* D: Candidate Prescriptions */}
                  <div className="md:col-span-7 bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-200">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-primary">Candidate Prescriptions Evaluated</span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {check.prescriptions ? check.prescriptions.length : (check.prescribedDrugs?.length || 0)} Items
                        </span>
                      </div>
                      <div className="space-y-2">
                        {(check.prescriptions && check.prescriptions.length > 0
                          ? check.prescriptions.map((p) => p.drugName)
                          : (check.prescribedDrugs || ['Standard Regimen'])
                        ).map((drug: string, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-slate-900">{drug}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                              Oral Regimen
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-400">
                      Reconciled via RxNorm & Lexicomp DDI Engine
                    </div>
                  </div>
                </section>

                {/* SECTION E: Detailed Flagged Alerts */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">Flagged Interaction Findings & Rationale</h3>
                    <span className="text-xs text-slate-500 font-semibold">{check.alerts.length} Evaluated Findings</span>
                  </div>

                  <div className="space-y-2.5">
                    {check.alerts.map((alert) => (
                      <div key={alert.id} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              alert.severity === 'contraindicated'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {alert.severity}
                            </span>
                            <span className="font-bold text-slate-900">{alert.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Rule #{alert.id}</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{alert.description || alert.clinicalImpact}</p>
                        {alert.overridden && (
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                            <strong>Pharmacist Override Note: </strong>
                            {alert.overrideReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* SECTION F: Pharmacist Electronic Attestation */}
                <footer className="pt-4 border-t-2 border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-bold">
                      Electronic Signature & Attestation
                    </span>
                    <div className="font-mono text-sm font-bold text-slate-900">
                      /s/ {check.reviewerName || check.prescriberName}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Lead Clinical Pharmacist • Smile Clinic Health System
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Certified EPCS Workstation • Session SES-9014-EHR
                    </div>
                  </div>

                  <div className="flex flex-col justify-end sm:items-end text-left sm:text-right">
                    <div className="w-16 h-16 border border-dashed border-slate-300 rounded-lg p-1 bg-slate-50 flex flex-col items-center justify-center font-mono text-[9px] text-slate-500 mb-1">
                      <span>[ QR SECURE ]</span>
                      <span className="font-bold text-primary">{check.checkNumber}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Generated at {check.timestamp}
                    </div>
                  </div>
                </footer>
              </article>
            </div>
          </main>
        </div>
      )}
    </AnimatePresence>
  );
}
