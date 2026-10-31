import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DrugInteractionAlert } from '../types';
import { PrescriptionStorage as VirtualDb, getActiveClinicianName } from '../services/prescriptionService';
import { getClinicianEmail } from '../services/cloudSyncService';
import { showConfirmation } from '../services/confirmation';
import {
  dispatchDoctorConsultEmail,
  getSavedDoctors,
  saveDoctorContact,
  SavedDoctorContact,
} from '../services/medicationScheduleService';

interface AlertDetailDrawerProps {
  alert: DrugInteractionAlert | null;
  isOpen: boolean;
  onClose: () => void;
  onOverride?: (alertId: string, reason: string) => void;
  onSelectAlternative?: (altDrug: string) => void;
  patientName?: string;
  patientMrn?: string;
  checkNumber?: string;
  checkId?: string;
}

export default function AlertDetailDrawer({
  alert,
  isOpen,
  onClose,
  onOverride,
  onSelectAlternative,
  patientName: propPatientName,
  patientMrn: propPatientMrn,
  checkNumber: propCheckNumber,
  checkId: propCheckId,
}: AlertDetailDrawerProps) {
  // Doctor consultation input states (strictly no hardcoded default names or emails)
  const [doctorName, setDoctorName] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [newMedication, setNewMedication] = useState('');
  
  // Validation errors
  const [doctorNameError, setDoctorNameError] = useState('');
  const [doctorEmailError, setDoctorEmailError] = useState('');
  
  // UI & suggestion states
  const [savedDoctors, setSavedDoctors] = useState<SavedDoctorContact[]>([]);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [sendUserCopy, setSendUserCopy] = useState(false);
  const [sentEventInfo, setSentEventInfo] = useState<{ doctor: string; email: string; time: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const loggedClinician = getActiveClinicianName() || 'Authorized Clinician';
  const loggedEmail = getClinicianEmail() || 'support.smileclinic@gmail.com';

  // Resolve matching clinical check if props omitted
  const matchingCheck = useMemo(() => {
    if (!alert) return null;
    const checks = VirtualDb.getChecks();
    if (propCheckId) {
      return checks.find((c) => c.id === propCheckId || c.checkNumber === propCheckId) || null;
    }
    return (
      checks.find((c) => (c.alerts || []).some((a) => a.id === alert.id || a.title === alert.title)) ||
      checks[0] ||
      null
    );
  }, [alert, propCheckId]);

  const patientName = propPatientName || matchingCheck?.patientName || 'Farhan khalid';
  const patientMrn = propPatientMrn || matchingCheck?.mrn || 'PT-NEW-001';
  const checkNumber = propCheckNumber || matchingCheck?.checkNumber || matchingCheck?.id || 'CHK-CURRENT';
  const effectiveCheckId = propCheckId || matchingCheck?.id || 'CHK-CURRENT';

  // Accurately extract the two interacting drug names (Never "Primary drug" or "Secondary drug")
  const { drugA, drugB } = useMemo(() => {
    let a = '';
    let b = '';

    if (Array.isArray(alert?.interactingDrugs) && alert.interactingDrugs.length >= 2) {
      a = alert.interactingDrugs[0];
      b = alert.interactingDrugs[1];
    } else if (Array.isArray(alert?.interactingDrugs) && alert.interactingDrugs.length === 1) {
      a = alert.interactingDrugs[0];
    }

    if ((!a || !b) && alert?.title) {
      const parts = alert.title.split(/\s*(?:↔|<->|\+|vs\.?|with|and)\s*/i);
      if (parts.length >= 2) {
        if (!a) a = parts[0].trim();
        if (!b) {
          b = parts[1]
            .replace(/\(.*?\)/g, '')
            .replace(/(?:hazard|interaction|warning|alert|contraindication)/gi, '')
            .trim();
        }
      }
    }

    if ((!a || !b) && matchingCheck?.prescriptions?.length) {
      const rxNames = matchingCheck.prescriptions.map((p) => p.drugName);
      if (!a && rxNames[0]) a = rxNames[0];
      if (!b && rxNames[1]) b = rxNames[1];
    }

    return {
      drugA: a || 'Prescribed Agent',
      drugB: b || 'Interacting Agent',
    };
  }, [alert, matchingCheck]);

  const alternativeAvailable = alert?.alternativeSuggestion || (alert?.alternatives && alert.alternatives[0]) || '';

  // Load user's saved doctors on mount or user change
  useEffect(() => {
    const list = getSavedDoctors(loggedEmail);
    setSavedDoctors(list);
  }, [loggedEmail]);

  // Pre-fill alternative medication once
  useEffect(() => {
    if (alternativeAvailable && !newMedication) {
      setNewMedication(alternativeAvailable);
    }
  }, [alternativeAvailable]);

  // Dynamic cross-device historical audit trail for this alert
  const historicalRecord = useMemo(() => {
    if (sentEventInfo) {
      return {
        doctor: sentEventInfo.doctor,
        email: sentEventInfo.email,
        time: sentEventInfo.time,
        note: `Doctor consultation email dispatched to Dr. ${sentEventInfo.doctor} (${sentEventInfo.email}). Regimen modification requested. Hazard marked as completed/overridden.`
      };
    }
    if (alert?.overridden && alert?.overrideReason) {
      const docMatch = alert.overrideReason.match(/Dr\.\s*([^(\]]+)(?:\s*\(([^)]+)\))?/i) ||
                       alert.overrideReason.match(/\[(?:Dr\.|Prescriber:)?\s*([^(\]]+)(?:\s*\(([^)]+)\))?\]/i);
      const doctor = docMatch ? docMatch[1].trim() : (alert.overrideAuthor || 'Consulted Doctor');
      const email = docMatch && docMatch[2] ? docMatch[2].trim() : 'Email Dispatched';
      return {
        doctor,
        email,
        time: 'Logged in Database',
        note: alert.overrideReason
      };
    }
    const logs = VirtualDb.getAuditLogs();
    const match = logs.find(l =>
      (l.checkId === effectiveCheckId || l.patientMrn === patientMrn) &&
      (l.action === 'Alert Overridden' || (l.details && l.details.includes('Doctor consultation email dispatched'))) &&
      (l.details?.includes(drugA) || l.details?.includes(alert?.title || '') || (alert?.title && alert.title.includes(drugA)))
    );
    if (match) {
      const docMatch = match.details?.match(/Dr\.\s*([^(\]]+)(?:\s*\(([^)]+)\))?/i);
      return {
        doctor: docMatch ? docMatch[1].trim() : (match.clinicianName || 'Consulted Doctor'),
        email: docMatch && docMatch[2] ? docMatch[2].trim() : 'Email Dispatched',
        time: match.timestamp || 'Logged in Database',
        note: match.details || 'Doctor consultation dispatched and alert marked as resolved.'
      };
    }
    return null;
  }, [sentEventInfo, alert, effectiveCheckId, patientMrn, drugA]);

  // Lock body scroll on open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // AI-generated immutable clinical consultation message
  const aiClinicalDirective = useMemo(() => {
    if (!alert) return '';
    const replacementText = newMedication.trim()
      ? `Discontinue/substitute ${drugA} with recommended safer alternative: ${newMedication.trim()}.`
      : alternativeAvailable
      ? `Discontinue/substitute ${drugA} with recommended alternative: ${alternativeAvailable}.`
      : `Prescribing doctor review requested to titrate dose or select non-interacting therapeutic alternative.`;

    return `CLINICAL CONSULTATION DIRECTIVE — ${alert.title.toUpperCase()}
Patient: ${patientName} (MRN: ${patientMrn}) | Check #${checkNumber}
Severity Flag: ${alert.severity.toUpperCase()} (${alert.evidenceGrade || 'Class I - Definitive'})

Identified Interaction: Concurrent administration of ${drugA} with ${drugB}.
Pharmacological Mechanism: ${alert.mechanism || alert.description || alert.clinicalImpact || 'Risk of heightened physiological toxicity or metabolic disruption.'}

Prescriber Action Requested:
${replacementText}
Please confirm regimen modification or clinical guidance upon receipt of this memorandum.`;
  }, [alert, drugA, drugB, patientName, patientMrn, checkNumber, newMedication, alternativeAvailable]);

  if (!alert || typeof document === 'undefined') return null;

  const isContraindicated = alert.severity === 'contraindicated';
  const isMajor = alert.severity === 'major';

  const severityColor = isContraindicated
    ? 'bg-rose-100 text-rose-800 border-rose-300'
    : isMajor
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-primary-container text-on-primary border-primary';

  const severityIcon = isContraindicated ? 'dangerous' : isMajor ? 'warning' : 'info';

  const handleSelectDoctorSuggestion = (doc: SavedDoctorContact) => {
    setDoctorName(doc.name);
    setDoctorEmail(doc.email);
    setDoctorNameError('');
    setDoctorEmailError('');
    setShowDoctorDropdown(false);
  };

  const validateDoctorInputs = (): boolean => {
    let valid = true;
    const cleanName = doctorName.trim();
    const cleanEmail = doctorEmail.trim();

    if (!cleanName) {
      setDoctorNameError('Please enter the doctor / prescriber name.');
      valid = false;
    } else {
      setDoctorNameError('');
    }

    if (!cleanEmail) {
      setDoctorEmailError('Please enter the doctor email address.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setDoctorEmailError('Please enter a valid email address (e.g. doctor@hospital.com).');
      valid = false;
    } else {
      setDoctorEmailError('');
    }

    return valid;
  };

  // Dispatch Email directly to Doctor & Automatically Resolve Contradiction
  const handleSendDoctorEmail = async () => {
    if (!alert || !validateDoctorInputs()) return;

    setIsSendingEmail(true);
    const cleanDocEmail = doctorEmail.trim();
    const cleanDocName = doctorName.trim();

    try {
      const minSpinnerPromise = new Promise((resolve) => setTimeout(resolve, 850));
      const emailPromise = dispatchDoctorConsultEmail({
        to_doctor_email: cleanDocEmail,
        doctor_name: cleanDocName,
        patient_name: patientName,
        patient_mrn: patientMrn,
        check_number: checkNumber,
        alert_title: alert.title,
        severity: alert.severity,
        interacting_drugs: [drugA, drugB],
        clinical_mechanism:
          alert.mechanism ||
          alert.description ||
          alert.clinicalImpact ||
          'Pharmacological interaction identified',
        substituted_medication:
          newMedication.trim() || alternativeAvailable || 'Safer Therapeutic Alternative',
        rationale: aiClinicalDirective,
        clinician_name: loggedClinician,
        clinician_email: loggedEmail,
        cc_user_email: undefined,
      });
      await Promise.all([emailPromise, minSpinnerPromise]);

      // Save doctor contact in local directory for future 1-click suggestions
      const updatedList = saveDoctorContact(
        { name: cleanDocName, email: cleanDocEmail },
        loggedEmail
      );
      setSavedDoctors(updatedList);

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSentEventInfo({ doctor: cleanDocName, email: cleanDocEmail, time: timeStr });
      setEmailSentSuccess(true);

      const changeNote = newMedication.trim()
        ? ` [Proposed Alternative: ${newMedication.trim()}]`
        : '';
      const fullReason = `Doctor consultation email dispatched to Dr. ${cleanDocName} (${cleanDocEmail}). Directive sent to modify ${drugA} / ${drugB}.${changeNote} Hazard marked as completed/overridden.`;

      if (newMedication.trim() && onSelectAlternative) {
        onSelectAlternative(newMedication.trim());
      }

      showConfirmation(
        `Medication change alert dispatched to Dr. ${cleanDocName} (${cleanDocEmail}). Contradiction resolved and queue updated.`,
        'success'
      );

      // After 1100ms, mark contradiction as overridden/resolved and close drawer panel automatically
      setTimeout(() => {
        setIsSendingEmail(false);
        onOverride?.(alert.id, fullReason);
        onClose();
      }, 1100);
    } catch (err: any) {
      setIsSendingEmail(false);
      showConfirmation(
        err?.message || 'Failed to dispatch email to doctor. Please check connection.',
        'error'
      );
    }
  };

  // Submit and Sign Protocol in Database
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDoctorInputs()) return;

    setIsSubmitting(true);
    const cleanDocName = doctorName.trim();
    const cleanDocEmail = doctorEmail.trim();

    saveDoctorContact({ name: cleanDocName, email: cleanDocEmail }, loggedEmail);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);

      const changeNote = newMedication.trim() ? ` [Proposed Alternative: ${newMedication.trim()}]` : '';
      const fullReason = `DOCTOR CONSULTED & REGIMEN MODIFIED [Prescriber: ${cleanDocName} (${cleanDocEmail})]${changeNote} — ${aiClinicalDirective.slice(0, 160)}...`;

      if (newMedication.trim() && onSelectAlternative) {
        onSelectAlternative(newMedication.trim());
      }
      onOverride?.(alert.id, fullReason);

      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 700);
    }, 450);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-sm"
          />

          {/* Slide-Over Drawer Canvas */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 220, mass: 0.85 }}
            className="fixed inset-y-0 right-0 max-w-3xl w-full bg-surface-container-lowest shadow-2xl z-50 flex flex-col border-l border-surface-container-high overflow-hidden"
          >
            {/* Top Fixed Drawer Header */}
            <div className="px-6 py-4 border-b border-surface-container-high bg-surface-container-lowest/90 backdrop-blur-md flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${severityColor}`}>
                  <span className="material-symbols-outlined text-[24px]">{severityIcon}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${severityColor}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">
                      {alert.evidenceGrade || 'Level 1 - Well Documented'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-on-surface mt-0.5 line-clamp-1">
                    {alert.title}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
                title="Close drawer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Scrollable Clinical Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-on-surface text-sm">
              
              {/* 1. Why It Matters (Clinical Pharmacokinetics) */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">science</span>
                  <h3 className="text-base font-bold text-on-surface">1. Why It Matters (Clinical Pharmacokinetics)</h3>
                </div>
                <p className="text-on-surface-variant leading-relaxed">
                  {alert.description || alert.clinicalImpact || alert.mechanism}
                </p>
                <div className="mt-2 p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">crisis_alert</span>
                  <div className="text-xs text-on-surface-variant leading-relaxed">
                    <strong className="text-on-surface">Pharmacological Hazard: </strong>
                    {alert.mechanism
                      ? `${alert.mechanism} — ${alert.clinicalImpact || 'Requires physician evaluation prior to dispensing.'}`
                      : `Concurrent administration of ${drugA} with ${drugB} precipitates clinical complications. Prescriber review required.`}
                  </div>
                </div>
              </section>

              {/* 2. Clinical Evidence Base */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">library_books</span>
                    <h3 className="text-base font-bold text-on-surface">2. Clinical Evidence Base</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    Dental CDS Rule Engine
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-surface-container text-xs">
                    <div>
                      <span className="text-on-surface-variant block">Clinical Guidance Attribution:</span>
                      <strong className="text-on-surface">Smile Clinic Clinical Safety Guard</strong>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">Evidence Indexing:</span>
                      <span className="font-mono text-on-surface">{alert.evidenceGrade || 'Class I (Definitive)'} • Real-Time Engine</span>
                    </div>
                  </div>
                  <blockquote className="p-3 rounded-lg bg-surface-container-low border-l-4 border-primary text-xs text-on-surface leading-relaxed">
                    {alert.recommendation || `Concurrent administration of ${drugA} and ${drugB} requires clinical oversight. Adjust dosage or substitute with safe therapeutic alternative.`}
                  </blockquote>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>Active Safety Rule #{alert.id}</span>
                    <span className="text-primary font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      Verified Clinical Safety Protocol
                    </span>
                  </div>
                </div>
              </section>

              {/* 3. Recommended Clinical Action */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">task_alt</span>
                  <h3 className="text-base font-bold text-on-surface">3. Recommended Clinical Action</h3>
                </div>
                <div className="p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">contact_phone</span>
                  <span>Contact prescriber / doctor; do not independently stop, start or change medication.</span>
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-on-surface leading-relaxed flex-1">
                      <strong className="text-on-surface">Switch to non-interacting alternative: </strong>
                      {alternativeAvailable ? (
                        <span>Substitute with <strong>{alternativeAvailable}</strong>.</span>
                      ) : (
                        <span>Consult prescribing physician to select an appropriate non-interacting therapeutic alternative.</span>
                      )}
                      {alternativeAvailable && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewMedication(alternativeAvailable);
                              showConfirmation(`Pre-filled alternative: ${alternativeAvailable}`, 'info');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline bg-primary/10 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                            <span>Set as Proposed Replacement Medication →</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-on-surface leading-relaxed">
                      <strong className="text-on-surface">If combination is clinically essential: </strong>
                      Notify doctor to calibrate dosage under heightened clinical telemetry. Instruct patient on reporting adverse symptoms immediately.
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Constraints, Clinical Monitoring & Patient Context */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[20px]">find_replace</span>
                  <h3 className="text-base font-bold text-on-surface">4. Constraints, Clinical Monitoring & Patient Context</h3>
                </div>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-container-low border border-surface-container-high/60">
                    <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">badge</span>
                    <span className="text-on-surface leading-tight">
                      <strong>Patient Screening Target: </strong>
                      Patient <strong>{patientName}</strong> (MRN: <span className="font-mono">{patientMrn}</span>) evaluated under Check #{checkNumber}.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-container-low border border-surface-container-high/60">
                    <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">timelapse</span>
                    <span className="text-on-surface leading-tight">
                      <strong>Physiological Monitoring: </strong>
                      Monitor vital signs, blood pressure, and symptom progression. Instruct patient to notify clinic promptly if adverse effects arise.
                    </span>
                  </li>
                </ul>
              </section>

              {/* 5. Plain-Language Explanation */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">chat_bubble_outline</span>
                    <h3 className="text-base font-bold text-on-surface">5. Care Team & Patient Discussion Summary</h3>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                    Prescription AI v1.0
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container text-xs text-on-surface leading-relaxed">
                  “Taking <strong>{drugA}</strong> together with <strong>{drugB}</strong> carries an interaction risk ({alert.title.toLowerCase()}). To ensure patient safety, the doctor must be informed so they can evaluate prescribing an alternative medicine or adjusting the dosage with routine monitoring.”
                </div>
              </section>

              {/* 6. Unified Doctor Notification & Medication Change (ONE Option) */}
              <section className="space-y-4 pt-4 border-t border-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">medical_services</span>
                    <h3 className="text-base font-bold text-on-surface">6. Notify Doctor & Change Medication</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">
                      SMS: Coming Soon
                    </span>
                    <span className="text-error text-xs font-bold">* Action Required</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Doctor Input Box */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-primary/25 space-y-3.5">
                    
                    {/* Header with Saved Doctors Suggestions & Quick Autofill */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-surface-container">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">forward_to_inbox</span>
                        <span className="text-xs font-bold text-on-surface">Prescribing Doctor Contact Details</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDoctorName(loggedClinician);
                            setDoctorEmail(loggedEmail);
                            setDoctorNameError('');
                            setDoctorEmailError('');
                            showConfirmation(`Autofilled with your clinician details (${loggedEmail})`, 'info');
                          }}
                          className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 px-2 py-0.5 rounded-md transition-colors"
                          title="Click to quickly fill with your logged-in clinician details"
                        >
                          <span className="material-symbols-outlined text-[13px]">person</span>
                          <span>Use My Email</span>
                        </button>
                      
                      {savedDoctors.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowDoctorDropdown(!showDoctorDropdown)}
                            className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 px-2 py-0.5 rounded-md"
                          >
                            <span className="material-symbols-outlined text-[13px]">history_edu</span>
                            <span>Autofill Saved Doctor ({savedDoctors.length})</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                          </button>
                          
                          {showDoctorDropdown && (
                            <div className="absolute right-0 mt-1.5 w-72 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xl z-30 py-1 text-xs">
                              <div className="px-3 py-1.5 font-bold text-[10px] uppercase text-on-surface-variant border-b border-surface-container">
                                Click to Autofill Previously Used Doctor
                              </div>
                              {savedDoctors.map((doc) => (
                                <button
                                  key={doc.id}
                                  type="button"
                                  onClick={() => handleSelectDoctorSuggestion(doc)}
                                  className="w-full text-left px-3 py-2 hover:bg-surface-container flex flex-col transition-colors cursor-pointer border-b border-surface-container/50 last:border-b-0"
                                >
                                  <strong className="text-on-surface">{doc.name}</strong>
                                  <span className="text-[11px] text-on-surface-variant font-mono">{doc.email}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                    </div>

                    {/* Doctor Name and Email inputs (Starts blank, validates on send/submit) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-on-surface block mb-1">
                          Doctor / Prescriber Name <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          value={doctorName}
                          onChange={(e) => {
                            setDoctorName(e.target.value);
                            if (e.target.value.trim()) setDoctorNameError('');
                          }}
                          placeholder="e.g. Dr. A. Sharma"
                          className={`w-full rounded-lg bg-surface-container-lowest border px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none transition-all ${
                            doctorNameError ? 'border-error ring-1 ring-error' : 'border-outline-variant focus:border-primary'
                          }`}
                        />
                        {doctorNameError && (
                          <span className="text-[10px] text-error font-medium block mt-1">{doctorNameError}</span>
                        )}
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-on-surface block mb-1">
                          Doctor Email Address <span className="text-error">*</span>
                        </label>
                        <input
                          type="email"
                          value={doctorEmail}
                          onChange={(e) => {
                            setDoctorEmail(e.target.value);
                            if (e.target.value.trim()) setDoctorEmailError('');
                          }}
                          placeholder="e.g. doctor@clinic.com"
                          className={`w-full rounded-lg bg-surface-container-lowest border px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none font-mono transition-all ${
                            doctorEmailError ? 'border-error ring-1 ring-error' : 'border-outline-variant focus:border-primary'
                          }`}
                        />
                        {doctorEmailError && (
                          <span className="text-[10px] text-error font-medium block mt-1">{doctorEmailError}</span>
                        )}
                      </div>
                    </div>



                    {/* Substituted / New Medication */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-on-surface flex items-center gap-1">
                          <span>Substituted / New Medication</span>
                          <span className="text-[10px] text-on-surface-variant font-normal">(Changed or Advised by Doctor)</span>
                        </label>
                        {alternativeAvailable && (
                          <button
                            type="button"
                            onClick={() => setNewMedication(alternativeAvailable)}
                            className="text-[10px] text-primary font-bold hover:underline"
                          >
                            Reset to recommended alternative
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={newMedication}
                        onChange={(e) => setNewMedication(e.target.value)}
                        placeholder="e.g. Escitalopram 10mg once daily or Cefixime 200mg"
                        className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none font-semibold"
                      />
                    </div>

                    {/* AI-Generated Clinical Memo (Read-Only as requested by user) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary text-[15px]">auto_awesome</span>
                          <span>AI Clinical Directive for Doctor (Non-Editable)</span>
                        </label>
                        <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded">
                          Generated by AI Engine
                        </span>
                      </div>
                      <div className="w-full rounded-lg bg-surface-container-lowest border border-surface-container p-3 text-xs text-on-surface leading-relaxed font-mono whitespace-pre-wrap select-text">
                        {aiClinicalDirective}
                      </div>
                      <span className="text-[10px] text-on-surface-variant block mt-1">
                        The above clinical memo is locked and automatically formatted to ensure standard medical safety protocol.
                      </span>
                    </div>

                    {/* Live Doctor Email Preview Toggle & Dispatch Action */}
                    <div className="pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setShowEmailPreview(!showEmailPreview)}
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {showEmailPreview ? 'visibility_off' : 'visibility'}
                          </span>
                          <span>{showEmailPreview ? 'Hide Email Delivery Preview' : 'Show Email Delivery Preview'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendDoctorEmail}
                          disabled={isSendingEmail || emailSentSuccess}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-60 transition-all min-w-[210px]"
                        >
                          {isSendingEmail ? (
                            <>
                              <svg
                                className="animate-spin h-4 w-4 text-white shrink-0"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              <span>Sending Email to Doctor...</span>
                            </>
                          ) : emailSentSuccess ? (
                            <>
                              <span className="material-symbols-outlined text-[16px] text-emerald-300">check_circle</span>
                              <span>Dispatched &amp; Resolved!</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[15px]">send</span>
                              <span>Send Alert Email to Doctor</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expandable Live Email Preview */}
                      {showEmailPreview && (
                        <div className="mt-2.5 p-3.5 rounded-xl bg-surface-container-lowest border border-primary/30 shadow-xs space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-surface-container pb-1.5">
                            <span className="font-bold text-primary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">mail</span>
                              Email Template: doctor_medication_change_alert.html
                            </span>
                            <span className="font-mono text-[10px] text-on-surface-variant">Smile Clinic Mailer</span>
                          </div>
                          <div className="space-y-1 text-[11px] text-on-surface-variant leading-relaxed">
                            <div><strong>Recipient:</strong> Dr. {doctorName.trim() || '[Doctor Name]'} &lt;{doctorEmail.trim() || '[doctor@email.com]'}&gt;</div>
                            <div><strong>Subject:</strong> Smile Clinic CDS Alert: Prescription Interaction Consultation for {patientName} [{alert.severity.toUpperCase()}]</div>
                            <div><strong>Patient:</strong> {patientName} (MRN: {patientMrn}) | Check #{checkNumber}</div>
                            <div><strong>Interacting Drugs:</strong> <span className="text-error font-semibold">{drugA} ↔ {drugB}</span></div>
                            <div><strong>Proposed Replacement:</strong> <span className="text-emerald-700 font-bold">{newMedication || alternativeAvailable || 'Safer Therapeutic Alternative'}</span></div>
                            <div className="p-2 rounded bg-surface-container-low border border-surface-container text-on-surface mt-1 whitespace-pre-wrap font-mono text-[10.5px]">
                              {aiClinicalDirective}
                            </div>
                            <div className="text-[10px] text-outline pt-1">
                              Dispatched by {loggedClinician} ({loggedEmail}) • Smile Clinic CDS Safety Guard
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reviewer Signature Metadata */}
                  <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-[11px]">
                        {loggedClinician.slice(0, 2).toUpperCase()}
                      </div>
                      <span>Reviewer: <strong className="text-on-surface">{loggedClinician}</strong> (Authorized Clinician)</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>{loggedEmail}</span>
                      <span>{new Date().toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Submit and Save to Database */}
                  <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting || isSuccess}
                      className={`w-full sm:flex-1 h-11 px-4 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                        isSuccess
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-primary hover:bg-primary-container text-on-primary'
                      }`}
                    >
                      {isSuccess ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] text-white">verified</span>
                          <span>Regimen Change Saved to Cloud Database!</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Recording Consultation to DB...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                          <span>Sign & Save Consultation to Database</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto h-11 px-4 rounded-xl border border-primary text-primary hover:bg-primary/5 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel / Close
                    </button>
                  </div>
                </form>
              </section>

              {/* 7. Historical Audit & Action Log */}
              <section className="space-y-3 pt-4 border-t border-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[20px]">history</span>
                    <h3 className="text-base font-bold text-on-surface">7. Historical Audit & Action Log</h3>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">Real-Time Database Records</span>
                </div>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container">
                  {/* Event 1: Triggered rule with REAL drug names */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-error-container text-error flex items-center justify-center ring-4 ring-surface-container-lowest">
                      <span className="material-symbols-outlined text-[12px]">warning</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-on-surface">Rule Engine Triggered</span>
                        <span className="text-outline">•</span>
                        <span className="font-mono text-on-surface-variant">Check #{checkNumber}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Clinical rule evaluated for <strong className="text-on-surface">{drugA}</strong> and <strong className="text-on-surface">{drugB}</strong> with <strong className="uppercase">{alert.severity}</strong> flag.
                      </p>
                    </div>
                  </div>

                  {/* Event 2: Sent doctor email if triggered or synced from cloud database */}
                  {historicalRecord && (
                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center ring-4 ring-surface-container-lowest">
                        <span className="material-symbols-outlined text-[12px]">send</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-emerald-800">Doctor Consultation Email Dispatched</span>
                          <span className="text-outline">•</span>
                          <span className="font-mono text-on-surface-variant">{historicalRecord.time}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          Alert sent to <strong className="text-on-surface">Dr. {historicalRecord.doctor}</strong> (<span className="font-mono">{historicalRecord.email}</span>) requesting regimen change. Hazard marked as completed/overridden.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Event 3: Patient screening context */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant flex items-center justify-center ring-4 ring-surface-container-lowest">
                      <span className="material-symbols-outlined text-[12px]">flag</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-on-surface">Prescription Safety Guard</span>
                        <span className="text-outline">•</span>
                        <span className="font-mono text-on-surface-variant">{patientName} ({patientMrn})</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Patient safety screening logged. Doctor notification & consultation options enabled.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
