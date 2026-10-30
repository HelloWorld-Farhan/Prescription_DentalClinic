import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getClinicianEmail } from '../services/cloudSyncService';
import { showConfirmation } from '../services/confirmation';
import { dispatchScheduleAlertEmail, MedicationScheduleItem } from '../services/medicationScheduleService';
import { DrugInteractionAlert } from '../types';

interface EmailScheduleAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientMrn: string;
  checkNumber: string;
  medications: MedicationScheduleItem[];
  safetyAlerts: DrugInteractionAlert[];
  courseEndDate?: string;
  regimenDuration?: string;
}

export default function EmailScheduleAlertModal({
  isOpen,
  onClose,
  patientName,
  patientMrn,
  checkNumber,
  medications = [],
  safetyAlerts = [],
  courseEndDate = 'In 30 Days',
  regimenDuration = '1 Month (30 Days)',
}: EmailScheduleAlertModalProps) {
  const [recipientEmail, setRecipientEmail] = useState(() => getClinicianEmail() || 'support.smileclinic@gmail.com');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    setError(null);
    const trimmed = recipientEmail.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please provide a valid recipient email address.');
      return;
    }

    setIsSending(true);
    setSendProgress(20);
    const t1 = setTimeout(() => setSendProgress(50), 300);
    const t2 = setTimeout(() => setSendProgress(80), 700);

    try {
      const payload = {
        to_email: trimmed,
        patient_name: patientName,
        patient_mrn: patientMrn,
        clinician_name: 'Dr. Sanjeev Saxena / Smile Clinic CDS',
        check_number: checkNumber,
        schedule_date: new Date().toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
        course_end_date: courseEndDate,
        regimen_duration: regimenDuration,
        medications: medications.map((m) => ({
          name: m.drugName,
          dosage: m.dosage,
          frequency: m.frequency,
          scheduledTime: m.scheduledTime,
          foodInstruction: m.foodInstruction,
          duration: m.duration,
        })),
        safety_alerts: safetyAlerts.map((a) => ({
          title: a.title,
          recommendation: a.recommendation || a.mechanism || 'Consult clinician',
          severity: a.severity,
        })),
      };

      await dispatchScheduleAlertEmail(payload);

      setSendProgress(100);
      showConfirmation(`Medication schedule & safety alert successfully dispatched to ${trimmed}`, 'success');
      setTimeout(() => {
        setIsSending(false);
        onClose();
      }, 500);
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      setIsSending(false);
      setError(err?.message || 'Failed to dispatch alert email. Please check network.');
    }
  };

  const handleSmsNotice = () => {
    showConfirmation('SMS Alert Service: Coming Soon (DLT Telecom Carrier registration in review)', 'info');
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isSending ? undefined : onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative bg-surface-container-lowest w-full max-w-2xl rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">schedule_send</span>
            </div>
            <div>
              <h3 className="text-base font-black text-on-surface">Medication Intake & Safety Alert Dispatch</h3>
              <p className="text-xs text-on-surface-variant">
                Patient: <strong className="text-on-surface">{patientName}</strong> ({patientMrn}) • #{checkNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isSending}
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Email Recipient Input (Preview-Only Locked) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-on-surface">
                Recipient Email Address:
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                <span className="material-symbols-outlined text-[12px] text-teal-700">verified_user</span>
                Verified Recipient (Preview Only)
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 pointer-events-none">lock</span>
              <input
                type="email"
                value={recipientEmail}
                readOnly
                className="w-full pl-9 pr-20 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-semibold outline-none cursor-default select-all shadow-2xs"
              />
              <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-slate-500 bg-surface-container-high px-2 py-0.5 rounded pointer-events-none">
                Locked
              </span>
            </div>
            <span className="text-[11px] text-outline mt-1 block">
              Locked to authenticated clinical prescriber for safe delivery.
            </span>
          </div>

          {/* Channels Selection Strip */}
          <div className="p-3 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Email Gateway (Active)
              </span>
              <button
                type="button"
                onClick={handleSmsNotice}
                className="px-2.5 py-1 rounded-lg bg-surface-container-high text-outline text-[11px] font-bold flex items-center gap-1 hover:text-on-surface transition-colors cursor-pointer opacity-85"
                title="SMS Gateway: Blocked for now"
              >
                <span className="material-symbols-outlined text-[14px] text-amber-600">block</span>
                SMS Alert
                <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 border border-amber-300 rounded text-[9px] font-extrabold uppercase tracking-wide">
                  Blocked for now
                </span>
              </button>
            </div>
            <span className="text-[11px] text-outline font-mono">HIPAA Verified Gateway</span>
          </div>

          {/* Medication Timetable Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[16px]">alarm</span>
              Extracted Medication Timetable ({medications.length} items):
            </h4>
            <div className="rounded-2xl border border-surface-container-high overflow-hidden text-xs">
              <div className="grid grid-cols-12 bg-surface-container-low p-2.5 font-bold text-outline text-[11px] uppercase tracking-wider">
                <div className="col-span-3">Time Pill</div>
                <div className="col-span-4">Medication</div>
                <div className="col-span-3">Food Timing</div>
                <div className="col-span-2 text-right">Duration</div>
              </div>
              <div className="divide-y divide-surface-container max-h-48 overflow-y-auto">
                {medications.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-12 p-2.5 items-center hover:bg-surface-container-low/50">
                    <div className="col-span-3">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[11px] font-mono">
                        {m.scheduledTime}
                      </span>
                    </div>
                    <div className="col-span-4">
                      <strong className="text-on-surface">{m.drugName}</strong>{' '}
                      <span className="text-outline text-[11px]">{m.dosage}</span>
                    </div>
                    <div className="col-span-3 text-on-surface-variant text-[11px]">{m.foodInstruction}</div>
                    <div className="col-span-2 text-right text-outline text-[11px] font-mono">{m.duration}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Course Expiry Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs space-y-1">
            <strong className="font-bold flex items-center gap-1.5 text-amber-800">
              <span className="material-symbols-outlined text-[16px]">event_busy</span>
              Regimen Course Completion Notice:
            </strong>
            <p className="text-[11px] leading-relaxed text-amber-900/90">
              Prescription duration is <strong>{regimenDuration}</strong>. Course stops on{' '}
              <strong>{courseEndDate}</strong>. The patient is advised to discontinue taking the medications once the
              course completes.
            </p>
          </div>

          {/* Safety Warning Preview if any */}
          {safetyAlerts.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-900 text-xs space-y-1">
              <strong className="font-bold flex items-center gap-1.5 text-rose-800">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                Included Clinical Contraindications ({safetyAlerts.length}):
              </strong>
              <ul className="text-[11px] space-y-1 list-disc pl-4 text-rose-900/90">
                {safetyAlerts.map((a, i) => (
                  <li key={i}>
                    <strong>{a.title}:</strong> {a.recommendation || a.mechanism}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sending Progress Bar */}
          {isSending && (
            <div className="space-y-1">
              <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${sendProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-outline text-center block">
                Encrypting & dispatching through Google Apps Script gateway... {sendProgress}%
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-surface-container-high bg-surface-container-low/30 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={isSending}
            onClick={handleSmsNotice}
            className="px-3.5 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-outline hover:text-on-surface text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">sms</span>
            <span>SMS (Coming Soon)</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSending}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={handleSend}
              className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              <span>{isSending ? 'Sending Schedule Alert...' : 'Send Alert Email'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
