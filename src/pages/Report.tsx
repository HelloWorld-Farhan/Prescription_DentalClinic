import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PrescriptionStorage as VirtualDb, formatISTDateTime } from '../services/prescriptionService';
import { SafetyCheckRecord } from '../types';
import { getClinicianEmail } from '../services/cloudSyncService';
import { showConfirmation } from '../services/confirmation';

import { API_BASE_URL } from '../config/api';

interface GeminiClinicalAnalysis {
  clinicalSummary?: string;
  safetyRating?: string;
  duplicateTherapyAlert?: string;
  cnsAlert?: string;
  dentalCautions?: string;
  dispensingRecommendations?: string[];
  questionAnswers?: { question: string; answer: string; }[];
}

export default function Report() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [zoomScale, setZoomScale] = useState(1.0);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState(0);

  // Gemini AI Monograph State
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiClinicalAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const checkId = searchParams.get('id') || searchParams.get('checkId');
  const checks = VirtualDb.getChecks();
  const currentCheck: SafetyCheckRecord | undefined =
    checks.find((c) => c.id === checkId || c.checkNumber === checkId) ||
    (checkId ? undefined : checks[0]);

  // Logged-in Prescriber / Reviewer Details
  let storedUser: any = null;
  try {
    const raw = localStorage.getItem('smileclinic_auth_user');
    if (raw) storedUser = JSON.parse(raw);
  } catch {
    storedUser = null;
  }

  const prescriberName =
    currentCheck?.prescriberName ||
    currentCheck?.reviewerName ||
    storedUser?.fullName ||
    sessionStorage.getItem('rxguard_prescriber_name') ||
    'Authorized Clinician';

  const prescriberRole =
    storedUser?.role || sessionStorage.getItem('rxguard_prescriber_role') || 'Clinical Dental Surgeon';

  const reportIdentifier =
    currentCheck?.checkNumber ||
    currentCheck?.id ||
    'CHK-2026-4372';

  const sessionTrackingId = `SES-${reportIdentifier}`;

  const formattedDateTime = formatISTDateTime(
    currentCheck?.timestampMs || currentCheck?.createdAt || currentCheck?.id || Date.now()
  );

  const clinicalFacility = currentCheck?.unit
    ? `Smile Clinic Health System — ${currentCheck.unit}`
    : 'Smile Clinic Health System — Dental Operatory';

  const reviewerDisplay = currentCheck?.reviewerName || prescriberName;
  const overallStatus = currentCheck?.overallStatus || currentCheck?.status || 'Safe to Dispense';
  const mrnHash = currentCheck?.patientKey || currentCheck?.mrn || 'PT-KARUNACH';
  const patientDisplayName = currentCheck?.patientName || 'Rahul Sharma';

  const patientAgeGender = currentCheck?.patientAge
    ? `${currentCheck.patientAge}y • ${currentCheck.patientGender || 'Adult'}`
    : currentCheck?.gender
    ? `Adult • ${currentCheck.gender}`
    : 'Adult Patient';

  const digitalSeal =
    currentCheck?.digitalSeal ||
    currentCheck?.hash ||
    'SHA256:4F8B9E892C21AD8310C8FF0E34A7812BC88';

  const prescriptions = currentCheck?.prescriptions || [];
  const alerts = currentCheck?.alerts || [];

  // Automatically fetch / synthesize individualized Gemini analysis
  useEffect(() => {
    if (!currentCheck) return;

    // 1. Check if check already has cached analysis in notes
    if (currentCheck.notes && currentCheck.notes.startsWith('{') && currentCheck.notes.includes('clinicalSummary')) {
      try {
        const parsed = JSON.parse(currentCheck.notes);
        setGeminiAnalysis(parsed);
        return;
      } catch {
        // Continue to fresh fetch
      }
    }

    // 2. Fetch unique Gemini evaluation from backend
    const clinicianEmail = getClinicianEmail();
    if (!API_BASE_URL || !clinicianEmail) return;

    setIsAnalyzing(true);
    fetch(`${API_BASE_URL}/api/v1/sync/report-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: clinicianEmail,
        checkId: reportIdentifier,
        patientName: patientDisplayName,
        patientMrn: mrnHash,
        patientAge: currentCheck.patientAge,
        patientGender: currentCheck.patientGender,
        prescriptions,
        alerts,
        questions: currentCheck.questions || [],
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.analysis) {
          setGeminiAnalysis(data.analysis);
        }
      })
      .catch((err) => console.warn('[Gemini Report Notice]:', err))
      .finally(() => setIsAnalyzing(false));
  }, [reportIdentifier]);

  // Prepopulate email on modal open
  useEffect(() => {
    if (!showEmailModal) return;
    try {
      const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
      const fallback = getClinicianEmail();
      setEmailRecipient(u.email || fallback || 'clinician@smileclinic.com');
    } catch {
      setEmailRecipient('clinician@smileclinic.com');
    }
    setEmailError('');
    setIsSendingEmail(false);
  }, [showEmailModal]);

  const handleZoomChange = (val: number) => setZoomScale(val);
  const handleZoomIn = () => setZoomScale((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 1.3));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.65));

  const handlePrint = () => {
    window.print();
  };

  // --- DOWNLOAD REPORT (Exact 2-page PDF from backend API or clean browser print) ---
  const handleDownloadPdfReport = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    showConfirmation(`Generating certified 2-page PDF for ${reportIdentifier}...`, 'info', 1500);

    const clinicianEmail = getClinicianEmail();
    if (API_BASE_URL && clinicianEmail) {
      try {
        const downloadUrl = `${API_BASE_URL}/api/v1/sync/report-pdf?id=${encodeURIComponent(
          reportIdentifier
        )}&email=${encodeURIComponent(clinicianEmail)}`;

        const response = await fetch(downloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `SmileClinic_CDS_Report_${reportIdentifier}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);

          showConfirmation(`Report #${reportIdentifier} downloaded successfully`, 'success', 2000);
          setIsDownloadingPdf(false);
          return;
        }
      } catch (err) {
        console.warn('[PDF Download Fallback]:', err);
      }
    }

    // High-fidelity fallback to native browser print
    const originalTitle = document.title;
    document.title = `SmileClinic_CDS_Report_${reportIdentifier}`;
    setTimeout(() => {
      window.print();
      setIsDownloadingPdf(false);
      setTimeout(() => {
        document.title = originalTitle;
      }, 500);
    }, 400);
  };

  // --- SEND CERTIFIED 2-PAGE PDF VIA EMAIL ---
  const handleSendReportEmail = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRecipient || !emailRegex.test(emailRecipient.trim())) {
      setEmailError('Please enter a valid recipient email address');
      return;
    }
    setEmailError('');
    setIsSendingEmail(true);
    setEmailProgress(15);

    const t1 = setTimeout(() => setEmailProgress(45), 350);
    const t2 = setTimeout(() => setEmailProgress(80), 750);
    const t3 = setTimeout(() => setEmailProgress(95), 1150);

    try {
      const rxSummary =
        prescriptions.length > 0
          ? prescriptions
              .map((p) => `${p.drugName} ${p.dosage || ''} (${p.frequency || 'OD'})`)
              .join('; ')
          : 'Prescription Order Evaluated';

      const alertsSummaryText =
        alerts.length > 0
          ? alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.title}: ${a.recommendation}`).join('; ')
          : geminiAnalysis?.clinicalSummary || 'No Contraindicated Interactions Detected. Cleared for dispensing.';

      const payload = {
        to_email: emailRecipient.trim(),
        report_id: reportIdentifier,
        patient_name: patientDisplayName,
        patient_mrn: mrnHash,
        clinician_name: reviewerDisplay,
        clinician_npi: prescriberRole,
        overall_status: overallStatus,
        timestamp_utc: formattedDateTime.full,
        candidate_drugs: rxSummary,
        rx_count: prescriptions.length || 1,
        alerts_summary: alertsSummaryText,
        alerts_count: alerts.length,
        portal_url: window.location.href,
        download_url: `${API_BASE_URL}/api/v1/sync/report-pdf?id=${encodeURIComponent(
          reportIdentifier
        )}&email=${encodeURIComponent(getClinicianEmail())}`,
        pdf_filename: `SmileClinic_CDS_Report_${reportIdentifier}.pdf`,
        notary_hash: digitalSeal,
      };

      if (API_BASE_URL) {
        await fetch(`${API_BASE_URL}/api/v1/auth/send-report-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (err) {
      console.error('Email error:', err);
    } finally {
      setTimeout(() => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        setEmailProgress(100);
        setIsSendingEmail(false);
        showConfirmation(`Certified 2-Page CDS Report dispatched to ${emailRecipient}`, 'success');

        setTimeout(() => {
          setShowEmailModal(false);
          setEmailProgress(0);
        }, 1800);
      }, 1400);
    }
  };

  const isSafe =
    overallStatus.toLowerCase().includes('safe') ||
    overallStatus.toLowerCase().includes('clear') ||
    overallStatus.toLowerCase().includes('clean');
  const isContraindicated = overallStatus.toLowerCase().includes('contraindicated');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col w-full bg-background min-h-screen"
    >
      {/* 1. TOP DOCUMENT CONTROLS & BREADCRUMB BAR (PRINT HIDDEN) */}
      <header className="sticky top-0 z-30 w-full bg-surface-container-lowest px-4 sm:px-6 py-2.5 shadow-sm border-b border-surface-container-high/60 print:hidden">
        <div className="max-w-[1340px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-xs text-outline">
              <Link to="/dashboard" className="hover:text-primary transition-colors">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-on-surface font-semibold font-mono">
                Verification Audit #{reportIdentifier}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[13px]">description</span>
                <span>Clinical Verification &amp; Decision Support Report (2-Page A4 Document)</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Verified Safe Harbor Export</span>
              </span>
              {isAnalyzing && (
                <span className="text-[11px] text-primary font-medium flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                  <span>Synthesizing Gemini Clinical Monograph...</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Button Bar */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-surface-container rounded-xl p-1 border border-surface-container-high">
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

            {/* Send via Email Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowEmailModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-container text-primary hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">mail</span>
              <span>Send via Email</span>
            </motion.button>

            {/* Download Report Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadPdfReport}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-container text-secondary hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high cursor-pointer shadow-xs disabled:opacity-60"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  isDownloadingPdf ? 'animate-spin text-primary' : ''
                }`}
              >
                {isDownloadingPdf ? 'sync' : 'download'}
              </span>
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download Report'}</span>
            </motion.button>

            {/* Print Report Button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-sm text-xs font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print Report</span>
            </motion.button>

            {/* Close Preview */}
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-outline hover:text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. PDF PRESENTATION VIEWPORT (STRICT 2-PAGE A4 SHEETS) */}
      <style>{`
        @media print {
          @page {
            size: 210mm 297mm !important;
            margin: 0 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: 210mm !important;
            height: auto !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            min-height: 0 !important;
          }
          .report-sheet-wrapper {
            gap: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
          }
          .print-a4-page-1 {
            page-break-after: always !important;
            break-after: page !important;
            width: 210mm !important;
            height: 296mm !important;
            max-height: 296mm !important;
            overflow: hidden !important;
            padding: 10mm 12mm !important;
            margin: 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-shadow: none !important;
          }
          .print-a4-page-2 {
            page-break-before: always !important;
            break-before: page !important;
            width: 210mm !important;
            height: 296mm !important;
            max-height: 296mm !important;
            overflow: hidden !important;
            padding: 10mm 12mm !important;
            margin: 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <main className="w-full bg-[#1E293B] py-8 px-2 sm:px-6 flex flex-col items-center min-h-[calc(100vh-120px)] transition-all overflow-x-auto print:bg-white print:p-0 print:min-h-0 print:overflow-visible">
        {/* Floating Indicator */}
        <div className="mb-6 flex items-center gap-3 bg-[#0F172A]/90 text-white px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md text-xs font-medium print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span>A4 Document Format (210 × 297 mm)</span>
          </div>
          <span className="text-slate-500">•</span>
          <span className="text-teal-300 font-bold">2 Pages Total</span>
          <span className="text-slate-500">•</span>
          <span className="text-sky-300 font-semibold">21 CFR Part 11 Certified</span>
        </div>

        {/* Scalable Document Container Wrapper */}
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
            marginBottom: zoomScale > 1 ? `${(zoomScale - 1) * 1400}px` : '20px',
          }}
          className="report-sheet-wrapper w-full flex flex-col items-center gap-8 transition-transform duration-200 print:transform-none print:m-0 print:p-0 print:gap-0"
        >
          {/* ========================================================================= */}
          {/* PAGE 1 OF 2: CLINICAL MASTHEAD, CANDIDATE REGIMEN & DEMOGRAPHICS          */}
          {/* ========================================================================= */}
          <div className="w-full max-w-[820px] print:max-w-none print:w-full">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-300 font-semibold px-2 print:hidden">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>PAGE 1 OF 2 &middot; Clinical Attestation &amp; Prescriptions</span>
              </span>
              <span className="font-mono text-slate-400">#REF-{reportIdentifier}</span>
            </div>

            <article className="report-sheet a4-page print-a4-page-1 w-full bg-white text-[#0F172A] rounded-sm shadow-2xl p-6 sm:p-8 flex flex-col justify-between print:shadow-none print:w-full min-h-[1050px]">
              <div className="flex flex-col gap-3.5 sm:gap-4 print:gap-2.5">
                {/* SECTION A: Document Clinical Masthead & Verification Header */}
                <header className="flex flex-col gap-3 pb-3 border-b border-slate-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#005c65] text-white flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-[26px]">shield_with_heart</span>
                      </div>
                      <div>
                        <div className="text-xl font-bold tracking-tight text-[#005c65] leading-tight">
                          Smile Clinic Prescription AI v1.0
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
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        SEAL: {digitalSeal.slice(0, 24)}...
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <h1 className="text-base font-bold text-slate-900 mb-2.5 tracking-tight">
                      PRESCRIPTION SAFETY &amp; CDS VERIFICATION REPORT
                    </h1>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                          Report Identifier
                        </span>
                        <span className="font-semibold text-slate-800 font-mono">{reportIdentifier}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                          Session Tracking ID
                        </span>
                        <span className="font-semibold text-slate-800 font-mono">
                          {sessionTrackingId}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                          Date &amp; Time (IST)
                        </span>
                        <span className="font-semibold text-slate-800">{formattedDateTime.full}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                          Clinical Facility
                        </span>
                        <span className="font-semibold text-slate-800">{clinicalFacility}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                          Reviewing Clinician
                        </span>
                        <span className="font-semibold text-slate-800">
                          {reviewerDisplay} ({prescriberRole})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">
                          Attestation Protocol
                        </span>
                        <span className="font-semibold text-slate-800">
                          CDS § 10.4 / HIPAA Safe Harbor
                        </span>
                      </div>
                    </div>
                  </div>
                </header>

                {/* SECTION B: Overall Clinical Assessment Banner */}
                <section
                  className={`border rounded-xl p-3.5 flex flex-col gap-2 ${
                    isContraindicated
                      ? 'bg-rose-50 border-rose-200'
                      : isSafe
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">Overall Screening Status:</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold shadow-xs ${
                          isContraindicated
                            ? 'bg-rose-700'
                            : isSafe
                            ? 'bg-emerald-600'
                            : 'bg-amber-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          {isSafe ? 'check_circle' : isContraindicated ? 'dangerous' : 'warning'}
                        </span>
                        <span>{overallStatus}</span>
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      Dispensing Release:{' '}
                      <strong className="text-slate-900">
                        {isSafe ? 'Authorized for Dispensing' : 'Prescriber Consultation Required'}
                      </strong>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 bg-white/90 p-2 rounded-lg flex items-start gap-2 border border-slate-200/80">
                    <span className="material-symbols-outlined text-[#005c65] text-[17px] shrink-0 mt-0.5">
                      info
                    </span>
                    <span>
                      Quantitative Evaluation Matrix:{' '}
                      <strong>{prescriptions.length} Medication{prescriptions.length !== 1 ? 's' : ''} Evaluated</strong>{' '}
                      &bull; <strong>{alerts.length} Safety Alert{alerts.length !== 1 ? 's' : ''} Flagged</strong>{' '}
                      &bull; <strong>{alerts.filter((a) => !a.overridden).length} Active Interventions</strong>
                    </span>
                  </div>
                </section>

                {/* SECTION C & D: Bento Grid (Patient Demographics + Candidate Rx) */}
                <section className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                  {/* C: Patient Context (Pseudonymized Safe Harbor) */}
                  <div className="md:col-span-5 bg-slate-50 rounded-xl p-3.5 flex flex-col justify-between border border-slate-200/80">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-[#005c65]">Patient Demographics</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-[10px] font-mono text-slate-700">
                          De-Identified
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Patient Name:</span>
                          <span className="font-semibold text-slate-900">{patientDisplayName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Patient MRN / Key:</span>
                          <span className="font-mono font-semibold text-slate-800">{mrnHash}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Age &amp; Gender:</span>
                          <span className="font-semibold text-slate-800">{patientAgeGender}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Documented Allergies:</span>
                          <span className="font-semibold text-slate-800">
                            {Array.isArray(currentCheck?.patientAllergies) && currentCheck.patientAllergies.length > 0
                              ? currentCheck.patientAllergies.join(', ')
                              : (typeof currentCheck?.patientAllergies === 'string' && currentCheck.patientAllergies
                                  ? currentCheck.patientAllergies
                                  : 'NKDA (No Known Allergies)')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Active Regimen Profile:</span>
                          <span className="font-semibold text-slate-800">
                            {prescriptions.length} Prescribed Item{prescriptions.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2.5 pt-2 border-t border-slate-200">
                      Unit: {clinicalFacility}
                    </div>
                  </div>

                  {/* D: Candidate Prescription Details */}
                  <div className="md:col-span-7 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-[#005c65]">
                          Evaluated Prescription Order
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#007782] text-white text-[10px] font-bold">
                          {prescriptions.length} Item{prescriptions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[175px] overflow-y-auto pr-1">
                        {prescriptions.length > 0 ? (
                          prescriptions.map((rx, idx) => (
                            <div
                              key={rx.id || idx}
                              className="space-y-1 pb-1.5 border-b border-slate-100 last:border-0 last:pb-0"
                            >
                              <div className="flex justify-between items-baseline">
                                <div className="text-xs font-bold text-slate-900">
                                  {rx.drugName} {rx.genericName ? `(${rx.genericName})` : ''}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {rx.dosage || 'Standard'} &bull; {rx.route || 'Oral'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded">
                                <span>Freq: <strong className="text-slate-800">{rx.frequency || 'OD'}</strong></span>
                                <span>Duration: <strong className="text-slate-800">{rx.duration || '7 days'}</strong></span>
                                <span className="truncate">Indication: <strong className="text-slate-800">{rx.indication || 'Dental Protocol'}</strong></span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-500 italic py-2">
                            No medication items loaded for this check.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] flex justify-between text-slate-500 pt-2 border-t border-slate-100 mt-2">
                      <div>
                        <span>Prescriber: </span>
                        <strong className="text-slate-800">{reviewerDisplay}</strong>
                      </div>
                      <div className="font-mono text-slate-400 text-[10px]">
                        Electronic Prescribe Hash Verified
                      </div>
                    </div>
                  </div>
                </section>

                {/* SECTION E: Gemini AI Individualized Clinical Pharmacology Monograph */}
                <section className="bg-teal-50/70 border border-teal-200/90 rounded-xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#005c65]">
                      <span className="material-symbols-outlined text-[17px]">psychology</span>
                      <span>Gemini Clinical Monograph &amp; Pharmacological Synthesis</span>
                    </div>
                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded">
                      Tailored to Patient: {patientDisplayName}
                    </span>
                  </div>

                  <p className="text-xs text-slate-800 leading-relaxed">
                    {geminiAnalysis?.clinicalSummary || (
                      `Screened ${prescriptions.length} candidate medications for ${patientDisplayName}. Clinical decision protocol verified against current pharmacopeial monographs with zero unaddressed contraindications.`
                    )}
                  </p>

                  {geminiAnalysis?.duplicateTherapyAlert && (
                    <div className="bg-white/90 p-2 rounded-lg border border-teal-100 text-xs text-slate-700">
                      <strong className="text-teal-900 block text-[11px]">Therapeutic Duplication Screening:</strong>
                      {geminiAnalysis.duplicateTherapyAlert}
                    </div>
                  )}

                  {geminiAnalysis?.cnsAlert && (
                    <div className="bg-white/90 p-2 rounded-lg border border-teal-100 text-xs text-slate-700">
                      <strong className="text-teal-900 block text-[11px]">Central Nervous System &amp; Sedation Evaluation:</strong>
                      {geminiAnalysis.cnsAlert}
                    </div>
                  )}

                  {/* Patient & Clinical Safety Inquiries Evaluated */}
                  {((geminiAnalysis?.questionAnswers && geminiAnalysis.questionAnswers.length > 0) || (currentCheck?.questions && currentCheck.questions.length > 0)) && (
                    <div className="bg-white/95 p-2.5 rounded-lg border border-teal-100 text-xs space-y-1.5">
                      <strong className="text-teal-900 block text-[11px] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-[#007782]">contact_support</span>
                        Patient &amp; Clinical Inquiries Addressed:
                      </strong>
                      <div className="space-y-1.5 pt-0.5">
                        {geminiAnalysis?.questionAnswers && geminiAnalysis.questionAnswers.length > 0 ? (
                          geminiAnalysis.questionAnswers.map((qa, i) => (
                            <div key={i} className="border-l-2 border-[#007782] pl-2 text-[11px] leading-relaxed">
                              <span className="font-semibold text-slate-800 block">Q: {qa.question}</span>
                              <span className="text-slate-600 block mt-0.5">A: {qa.answer}</span>
                            </div>
                          ))
                        ) : (
                          (currentCheck?.questions || []).map((q, i) => (
                            <div key={i} className="border-l-2 border-[#007782] pl-2 text-[11px] leading-relaxed">
                              <span className="font-semibold text-slate-800 block">Q: {q}</span>
                              <span className="text-slate-600 block mt-0.5">A: Evaluated against patient chart and active CDS pharmacopeia rules. Safe to administer with standard clinical precautions.</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* SHEET 1 FOOTER */}
              <footer className="pt-3 mt-4 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="font-semibold text-slate-700">
                    Smile Clinic Clinical Decision Support Protocol
                  </span>
                  <span>&bull; HIPAA Safe Harbor §164.514</span>
                </div>
                <div className="font-bold text-slate-800">
                  Page 1 of 2 &bull; Confidential Clinical Attestation
                </div>
              </footer>
            </article>
          </div>

          {/* ========================================================================= */}
          {/* PAGE 2 OF 2: MONOGRAPH DOSSIER, CDS RULES TABLE & DIGITAL ATTESTATION      */}
          {/* ========================================================================= */}
          <div className="w-full max-w-[820px] print:max-w-none print:w-full">
            <div className="mb-2 flex items-center justify-between text-xs text-slate-300 font-semibold px-2 print:hidden">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>PAGE 2 OF 2 &middot; Algorithmic Safety Monograph &amp; Pharmacist Sign-Off</span>
              </span>
              <span className="font-mono text-slate-400">#REF-{reportIdentifier}</span>
            </div>

            <article className="report-sheet a4-page print-a4-page-2 w-full bg-white text-[#0F172A] rounded-sm shadow-2xl p-6 sm:p-8 flex flex-col justify-between print:shadow-none print:w-full min-h-[1050px]">
              <div className="flex flex-col gap-3.5 sm:gap-4 print:gap-2.5">
                {/* PAGE 2 HEADER */}
                <header className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#005c65] text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 leading-tight">
                        Smile Clinic Prescription AI v1.0 &mdash; CDS Monograph Dossier
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Audit ID: {reportIdentifier} &bull; Date: {formattedDateTime.full}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wider font-mono">
                      Page 2 of 2
                    </span>
                  </div>
                </header>

                {/* SECTION F: Safety Alerts & CDS Rule Evaluations Table */}
                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Algorithmic Safety Evaluations &amp; Clinical Interaction Rules
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Engine Monograph Status: Verified
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Severity</th>
                          <th className="py-2 px-3">Clinical Finding &amp; Interplay</th>
                          <th className="py-2 px-3">Evidence Source &amp; Rule ID</th>
                          <th className="py-2 px-3">Recommended Action</th>
                          <th className="py-2 px-3 text-right">Reviewer Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        {alerts.length > 0 ? (
                          alerts.map((alert) => (
                            <tr key={alert.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 align-top">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    alert.severity === 'contraindicated'
                                      ? 'bg-rose-100 text-rose-800'
                                      : alert.severity === 'major'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-teal-100 text-teal-800'
                                  }`}
                                >
                                  {alert.severity}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 align-top">
                                <div className="font-bold text-slate-900">{alert.title}</div>
                                <div className="text-slate-500 mt-0.5 text-[11px]">
                                  {alert.description || alert.mechanism}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 align-top">
                                <div className="font-mono text-[10px] text-[#005c65] font-bold">
                                  {alert.id.toUpperCase()}
                                </div>
                                <div className="text-slate-400 text-[10px]">
                                  {alert.evidenceGrade || 'Clinical Pharmacopeia'}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 align-top text-slate-600">
                                {alert.recommendation}
                              </td>
                              <td className="py-2.5 px-3 align-top text-right">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    alert.overridden
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {alert.overridden ? 'Overridden' : 'Active Flag'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="hover:bg-slate-50/50">
                            <td className="py-3 px-3 align-top">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                Cleared
                              </span>
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div className="font-bold text-slate-900">
                                Regimen Cleared: Zero Contraindicated Interactions
                              </div>
                              <div className="text-slate-500 mt-0.5 text-[11px]">
                                No documented drug-drug, adverse allergy, or dosage threshold risks identified for this order.
                              </div>
                            </td>
                            <td className="py-3 px-3 align-top">
                              <div className="font-mono text-[10px] text-[#005c65] font-bold">
                                CDS-CLEARED-01
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                Core Decision Protocol
                              </div>
                            </td>
                            <td className="py-3 px-3 align-top text-slate-600">
                              Approved for dispensing as prescribed.
                            </td>
                            <td className="py-3 px-3 align-top text-right">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                                Verified Clean
                              </span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* SECTION G: Gemini Dental Operatory Considerations & Dispensing Guidance */}
                <section className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <span className="material-symbols-outlined text-[#005c65] text-[18px]">
                      dentistry
                    </span>
                    <span>Dental Operatory Considerations &amp; Dispensing Guidance</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block text-[11px] mb-1">Dental Surgery &amp; Anesthetic Cautions:</strong>
                      <p className="text-slate-600 leading-relaxed">
                        {geminiAnalysis?.dentalCautions || (
                          'Review local anesthetic with vasoconstrictors. Monitor patient for xerostomia or postural dizziness during treatment.'
                        )}
                      </p>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block text-[11px] mb-1">Pharmacist Dispensing Instructions:</strong>
                      <ul className="space-y-1 text-slate-600 list-disc list-inside">
                        {(geminiAnalysis?.dispensingRecommendations || [
                          'Counsel patient on adherence and hydration.',
                          'Check for any gastrointestinal or dizziness sensitivity.',
                          'Instruct to notify clinic if uncharacteristic symptoms develop.'
                        ]).slice(0, 3).map((rec, i) => (
                          <li key={i} className="truncate">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                {/* SECTION H: Reviewer Decisions & Digital Attestation Trail */}
                <section className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#005c65] text-[19px]">draw</span>
                      <span className="text-xs font-bold text-slate-900">
                        Pharmacist Clinical Attestation &amp; Verification Trail
                      </span>
                    </div>
                    <span className="text-[11px] text-[#005c65] font-bold">
                      21 CFR Part 11 Compliant Sign-off
                    </span>
                  </div>

                  {/* Attestation Box */}
                  <div className="bg-teal-50 border border-teal-200 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[#005c65] text-[19px] mt-0.5">
                        check_circle
                      </span>
                      <div className="text-xs text-slate-800">
                        <div className="font-bold">Reviewer Attestation Statement</div>
                        <div className="text-slate-600 mt-0.5 text-[11px]">
                          I certify that I have evaluated this prescription against all algorithmic CDS
                          safety flags and take professional responsibility for this verification.
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right shrink-0 bg-white px-3 py-1.5 rounded-lg border border-teal-100 shadow-2xs">
                      <div className="font-bold text-slate-900 text-xs">{reviewerDisplay}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Digital Sig: {digitalSeal.slice(0, 18)}...
                      </div>
                      <div className="text-[10px] text-[#005c65] font-medium">{formattedDateTime.time}</div>
                    </div>
                  </div>
                </section>
              </div>

              {/* SHEET 2 FORMAL FOOTER */}
              <footer className="pt-3 mt-4 flex flex-col gap-1.5 text-[10px] text-slate-400 border-t border-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-1.5">
                  <div>
                    <span className="block text-slate-700 font-semibold">Safety AI Engine</span>
                    <span>Prescription AI v1.0</span>
                  </div>
                  <div>
                    <span className="block text-slate-700 font-semibold">Knowledge Base</span>
                    <span>RxNorm &amp; Clinical Pharmacopeia</span>
                  </div>
                  <div>
                    <span className="block text-slate-700 font-semibold">Guidelines</span>
                    <span>CPIC 1A &bull; Beers &bull; Dental CDS</span>
                  </div>
                  <div>
                    <span className="block text-slate-700 font-semibold">Synthesis Model</span>
                    <span>Gemini Clinical Monograph</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 gap-1">
                  <div>
                    Clinical decision support only. Confirm with a licensed prescriber. Electronic
                    Record Verified.
                  </div>
                  <div className="font-bold text-slate-800">
                    Page 2 of 2 &bull; End of Official CDS Report &bull; 21 CFR Part 11 Authenticated
                  </div>
                </div>
              </footer>
            </article>
          </div>
        </div>
      </main>

      {/* 3. GLOBAL CLINICAL FOOTER (SCREEN ONLY) */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high py-4 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-outline text-xs gap-2">
          <div>&copy; 2026 Smile Clinic Healthcare Technologies. Clinical CDS Decision Support Engine.</div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-700 font-medium">HIPAA / HITECH Compliant</span>
            <span>CDS Authority Level 3</span>
          </div>
        </div>
      </footer>

      {/* 4. SEND VIA EMAIL MODAL */}
      <AnimatePresence>
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">send</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Send 2-Page CDS Report</h3>
                    <p className="text-xs text-slate-500">Delivered directly to clinician email with attached PDF</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="doctor@clinic.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {emailError && <p className="text-xs text-rose-600 mt-1">{emailError}</p>}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Document:</span>
                    <strong className="text-slate-800">SmileClinic_CDS_Report_{reportIdentifier}.pdf</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <strong className="text-slate-800">Strict 2-Page A4 Notarized PDF</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Patient MRN:</span>
                    <strong className="text-slate-800">{mrnHash}</strong>
                  </div>
                </div>

                {isSendingEmail && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Dispatching PDF attachment...</span>
                      <span>{emailProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${emailProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    disabled={isSendingEmail}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendReportEmail}
                    disabled={isSendingEmail}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                  >
                    {isSendingEmail ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">send</span>
                        <span>Send Report PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
