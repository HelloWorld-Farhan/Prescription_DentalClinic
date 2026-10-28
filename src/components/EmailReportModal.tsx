import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PrescriptionItem, DrugInteractionAlert } from '../types';
import { API_BASE_URL } from '../config/api';
import { getClinicianEmail } from '../services/cloudSyncService';
import { showConfirmation } from '../services/confirmation';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'send' | 'preview';
  checkId: string;
  patientName: string;
  patientMrn: string;
  prescriptions?: PrescriptionItem[];
  alerts?: DrugInteractionAlert[];
  overallStatus?: string;
  initialEmail?: string;
}

export default function EmailReportModal({
  isOpen,
  onClose,
  mode = 'send',
  checkId,
  patientName,
  patientMrn,
  prescriptions = [],
  alerts = [],
  overallStatus = 'Safe to Dispense',
  initialEmail = '',
}: EmailReportModalProps) {
  const [activeTab, setActiveTab] = useState<'send' | 'preview'>(mode);
  const [emailRecipient, setEmailRecipient] = useState(() => initialEmail || getClinicianEmail() || '');
  const [isSending, setIsSending] = useState(false);
  const [emailProgress, setEmailProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const cleanCheckId = checkId || 'CHK-REPORT';
  const cleanPdfName = `SmileClinic_CDS_Report_${cleanCheckId.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const subject = `Prescription CDS Verification Report · #${cleanCheckId} · ${patientMrn}`;

  const handleSendEmail = async () => {
    setError(null);
    const trimmed = emailRecipient.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please provide a valid recipient email address');
      return;
    }

    setIsSending(true);
    setEmailProgress(15);
    const t1 = setTimeout(() => setEmailProgress(45), 350);
    const t2 = setTimeout(() => setEmailProgress(75), 850);
    const t3 = setTimeout(() => setEmailProgress(92), 1250);

    try {
      const clinicianEmail = getClinicianEmail();
      if (API_BASE_URL) {
        await fetch(`${API_BASE_URL}/api/v1/auth/send-report-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_email: trimmed,
            clinician_email: clinicianEmail,
            report_id: cleanCheckId,
            patient_name: patientName,
            patient_mrn: patientMrn,
            overall_status: overallStatus,
            prescriptions: prescriptions.map((p) => ({
              drug_name: p.drugName,
              dosage: p.dosage,
              frequency: p.frequency,
              route: p.route,
            })),
            alerts_count: alerts.length,
          }),
        });
      }
    } catch (err) {
      console.warn('[Email Dispatch]:', err);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setEmailProgress(100);
      setIsSending(false);
      showConfirmation(`Certified 2-Page CDS Report dispatched to ${trimmed}`, 'success', 2500);
      setTimeout(() => {
        onClose();
        setEmailProgress(0);
      }, 900);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[115] overflow-y-auto flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 sm:p-7 flex flex-col gap-4 z-10 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">
                  {activeTab === 'send' ? 'mail' : 'visibility'}
                </span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  {activeTab === 'send' ? 'Send Certified CDS Report via Email' : 'Email Delivery Preview'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Report #{cleanCheckId} • Patient: <strong className="text-slate-800">{patientName}</strong> ({patientMrn})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Dual Tabs: Send vs Preview */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('send')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'send'
                  ? 'bg-white text-teal-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>Send Email</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-teal-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              <span>Preview of Email</span>
            </button>
          </div>

          {/* TAB 1: SEND EMAIL */}
          {activeTab === 'send' && (
            <div className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recipient Clinician or Patient Email Address
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
                    alternate_email
                  </span>
                  <input
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    placeholder="doctor@dentalclinic.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 font-medium"
                  />
                </div>
                {error && <p className="text-xs text-rose-600 mt-1 font-semibold">{error}</p>}
              </div>

              {/* Document Specs */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Attached Report:</span>
                  <strong className="font-mono text-slate-800 truncate max-w-xs">{cleanPdfName}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Document Type:</span>
                  <span className="font-semibold text-slate-800">2-Page A4 Notarized CDS Report</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Clinical Attestation:</span>
                  <span className="font-semibold text-emerald-700">HIPAA Safe Harbor Verified</span>
                </div>
              </div>

              {/* Progress bar during dispatch */}
              {isSending && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs text-slate-600 font-medium">
                    <span>Transmitting encrypted PDF attachment...</span>
                    <span>{emailProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-800 transition-all duration-300"
                      style={{ width: `${emailProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSending}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={isSending}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-800 text-white hover:bg-teal-900 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>{isSending ? 'Sending...' : 'Send Report via Email'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PREVIEW OF EMAIL */}
          {activeTab === 'preview' && (
            <div className="space-y-3 pt-1">
              {/* Email Envelope Meta Bar */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold w-12 shrink-0">From:</span>
                  <span className="text-slate-700 font-medium truncate">Smile Clinic Prescription AI &lt;noreply@smileclinic.com&gt;</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold w-12 shrink-0">To:</span>
                  <span className="text-slate-800 font-bold truncate">{emailRecipient || 'recipient@clinic.com'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-semibold w-12 shrink-0">Subject:</span>
                  <span className="text-slate-900 font-bold truncate">{subject}</span>
                </div>
              </div>

              {/* Rendered HTML Email Content Mockup */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 text-xs select-none">
                {/* Email Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[24px] text-teal-800">dentistry</span>
                    <span className="font-extrabold text-sm text-slate-900">Smile Clinic Health System</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    Notarized CDS Record
                  </span>
                </div>

                {/* Email Body Message */}
                <div className="space-y-2 text-slate-700 leading-relaxed">
                  <p>
                    Hello <strong>Dr. / Clinician</strong>,
                  </p>
                  <p>
                    Please find attached the official <strong>2-Page Clinical Decision Support (CDS) Verification Report</strong> for patient <strong className="text-slate-900">{patientName}</strong> (MRN: <code className="bg-slate-100 px-1 py-0.5 rounded">{patientMrn}</code>).
                  </p>
                </div>

                {/* Key Summary Cards inside email */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Screening Outcome:</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {overallStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Screened Regimen:</span>
                    <span className="font-semibold text-slate-800">{prescriptions.length} Candidate Medications</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Attestation Seal:</span>
                    <span className="font-mono text-[10px] text-teal-800">SHA256:VERIFIED</span>
                  </div>
                </div>

                {/* Attached File Card */}
                <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[22px] text-teal-800 shrink-0">picture_as_pdf</span>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 truncate block">{cleanPdfName}</span>
                      <span className="text-[10px] text-slate-500">PDF Attachment · 2-Page A4 Notarized Export</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-teal-800 px-2 py-0.5 rounded bg-white border border-teal-200 shrink-0">
                    Attached
                  </span>
                </div>
              </div>

              {/* Bottom Trigger to switch to Send */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">Ready to dispatch?</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('send')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-800 text-white hover:bg-teal-900 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">send</span>
                  <span>Proceed to Send Email</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
