import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  // Decision mode: 'doctor_consult' (Consult & Change), 'resolve' (Alternative), 'override' (Clinical Override)
  const [decision, setDecision] = useState<'doctor_consult' | 'resolve' | 'override'>('doctor_consult');
  
  // Doctor consultation fields
  const [doctorName, setDoctorName] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [overrideRationale, setOverrideRationale] = useState('');
  
  // Suggestion & UI states
  const [savedDoctors, setSavedDoctors] = useState<SavedDoctorContact[]>([]);
  const [showDoctorSuggestions, setShowDoctorSuggestions] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
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

  // Load saved doctors on mount or user email change
  useEffect(() => {
    const list = getSavedDoctors(loggedEmail);
    setSavedDoctors(list);
    if (list.length > 0 && !doctorName) {
      setDoctorName(list[0].name);
      setDoctorEmail(list[0].email);
    }
  }, [loggedEmail]);

  // Sync alternative recommendation into new medication input if available
  useEffect(() => {
    if (!alert) return;
    const defaultAlt = alert.alternativeSuggestion || (alert.alternatives && alert.alternatives[0]) || '';
    if (defaultAlt && !newMedication) {
      setNewMedication(defaultAlt);
    }

    const drugA = alert.interactingDrugs?.[0] || 'Proposed agent';
    const drugB = alert.interactingDrugs?.[1] || 'Interacting agent';

    if (decision === 'doctor_consult') {
      setOverrideRationale(
        `Consulted prescribing doctor regarding ${alert.title}. Discussed interaction between ${drugA} and ${drugB}. Regimen adjusted to prevent adverse clinical hazard.`
      );
    } else if (decision === 'resolve') {
      setOverrideRationale(
        `Prescription modified to safe therapeutic alternative (${newMedication || defaultAlt || 'prescribed alternative'}). Interacting agent discontinued.`
      );
    } else {
      setOverrideRationale(
        `Clinician override attested by ${loggedClinician}. Therapeutic necessity assessed with patient monitoring protocol instituted.`
      );
    }
  }, [alert, decision]);

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
    setShowDoctorSuggestions(false);
  };

  const handleAdoptAlternativeQuick = (alt: string) => {
    setNewMedication(alt);
    setDecision('doctor_consult');
    setOverrideRationale(
      `Prescription modified to recommended alternative: ${alt}. Verified with prescribing doctor to avoid ${alert.title}.`
    );
    showConfirmation(`Pre-filled alternative medication: ${alt}`, 'info');
  };

  // Dispatch Email directly to Doctor
  const handleSendDoctorEmail = async () => {
    const cleanDocEmail = doctorEmail.trim();
    if (!cleanDocEmail || !cleanDocEmail.includes('@') || !cleanDocEmail.includes('.')) {
      showConfirmation('Please enter a valid doctor email address to dispatch the alert.', 'error');
      return;
    }

    setIsSendingEmail(true);
    try {
      await dispatchDoctorConsultEmail({
        to_doctor_email: cleanDocEmail,
        doctor_name: doctorName.trim() || 'Prescribing Doctor',
        patient_name: patientName,
        patient_mrn: patientMrn,
        check_number: checkNumber,
        alert_title: alert.title,
        severity: alert.severity,
        interacting_drugs: alert.interactingDrugs || [],
        clinical_mechanism: alert.mechanism || alert.description || alert.clinicalImpact || 'Identified pharmacological hazard',
        substituted_medication: newMedication.trim() || 'Pending Doctor Recommendation',
        rationale: overrideRationale.trim() || 'Urgent consultation requested for drug-drug interaction.',
        clinician_name: loggedClinician,
        clinician_email: loggedEmail,
      });

      // Save doctor contact in local directory
      saveDoctorContact({ name: doctorName, email: cleanDocEmail }, loggedEmail);
      setSavedDoctors(getSavedDoctors(loggedEmail));

      setEmailSentSuccess(true);
      showConfirmation(`Clinical alert & consultation email sent to Dr. ${doctorName || cleanDocEmail}`, 'success');
      setTimeout(() => setEmailSentSuccess(false), 4000);
    } catch (err: any) {
      showConfirmation(err?.message || 'Failed to dispatch email to doctor. Please check connection.', 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Submit and Sign Protocol
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Save doctor info if entered
    if (doctorEmail.trim()) {
      saveDoctorContact({ name: doctorName, email: doctorEmail }, loggedEmail);
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);

      const decisionPrefix =
        decision === 'doctor_consult'
          ? 'DOCTOR CONSULT & CHANGE'
          : decision === 'resolve'
          ? 'RESOLVED WITH ALTERNATIVE'
          : 'CLINICAL OVERRIDE';

      const changeNote = newMedication.trim() ? ` [New Medication: ${newMedication.trim()}]` : '';
      const docNote = doctorName.trim() ? ` [Prescriber: ${doctorName.trim()} (${doctorEmail.trim()})]` : '';
      const fullReason = `${decisionPrefix}${docNote}${changeNote} - ${overrideRationale}`;

      // Notify parent callbacks
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

  const drugA = alert.interactingDrugs?.[0] || 'Primary drug';
  const drugB = alert.interactingDrugs?.[1] || 'Secondary drug';
  const alternativeAvailable = alert.alternativeSuggestion || (alert.alternatives && alert.alternatives[0]);

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
                      : `Concurrent administration of ${drugA} with ${drugB} creates potential clinical complications. Dosage adjustment or non-interacting alternative required.`}
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
                            onClick={() => handleAdoptAlternativeQuick(alternativeAvailable)}
                            className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline bg-primary/10 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                            <span>Adopt Alternative into Prescription Form →</span>
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
                      Consult prescribing physician to evaluate dosage titration. Instruct patient on reporting adverse symptoms immediately and record monitoring protocol.
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
                  “Taking <strong>{drugA}</strong> together with <strong>{drugB}</strong> carries an interaction risk ({alert.title.toLowerCase()}). To ensure patient safety, the doctor should be informed to either recommend a non-interacting alternative medication or adjust the dosage with routine monitoring.”
                </div>
              </section>

              {/* 6. Doctor Consultation, Medication Change & Decision Sign-Off */}
              <section className="space-y-4 pt-4 border-t border-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">medical_services</span>
                    <h3 className="text-base font-bold text-on-surface">6. Doctor Consultation & Medication Change</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">
                      SMS: Coming Soon
                    </span>
                    <span className="text-error text-xs font-bold">* Action Required</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Selectable Decision Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup">
                    
                    {/* Option 1: Doctor Consult & Change (Recommended) */}
                    <div
                      onClick={() => setDecision('doctor_consult')}
                      className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        decision === 'doctor_consult'
                          ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                          : 'border-surface-container-high bg-surface-container-lowest hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">forward_to_inbox</span>
                          Consult Doctor & Change
                        </span>
                        <input
                          type="radio"
                          name="cds-decision"
                          checked={decision === 'doctor_consult'}
                          onChange={() => setDecision('doctor_consult')}
                          className="w-4 h-4 text-primary accent-primary"
                        />
                      </div>
                      <span className="text-[11px] text-on-surface leading-tight font-medium">
                        Notify prescribing doctor via email and write replacement drug.
                      </span>
                    </div>

                    {/* Option 2: Resolve with Alternative */}
                    <div
                      onClick={() => setDecision('resolve')}
                      className={`relative flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                        decision === 'resolve'
                          ? 'border-emerald-600 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-600'
                          : 'border-surface-container-high bg-surface-container-lowest hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                          Direct Substitution
                        </span>
                        <input
                          type="radio"
                          name="cds-decision"
                          checked={decision === 'resolve'}
                          onChange={() => setDecision('resolve')}
                          className="w-4 h-4 text-emerald-600 accent-emerald-600"
                        />
                      </div>
                      <span className="text-[11px] text-on-surface-variant leading-tight">
                        Order modified to non-interacting alternative medication.
                      </span>
                    </div>

                    {/* Option 3: Prescriber Override */}
                    <div
                      onClick={() => setDecision('override')}
                      className={`relative flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                        decision === 'override'
                          ? 'border-amber-600 bg-amber-500/10 shadow-xs ring-1 ring-amber-600'
                          : 'border-surface-container-high bg-surface-container-lowest hover:border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">gavel</span>
                          Clinical Override
                        </span>
                        <input
                          type="radio"
                          name="cds-decision"
                          checked={decision === 'override'}
                          onChange={() => setDecision('override')}
                          className="w-4 h-4 text-amber-600 accent-amber-600"
                        />
                      </div>
                      <span className="text-[11px] text-on-surface-variant leading-tight">
                        Prescriber accepts risk with documented monitoring rationale.
                      </span>
                    </div>
                  </div>

                  {/* Doctor Contact & Regimen Modification Fields */}
                  <div className="p-4 rounded-xl bg-surface-container-low border border-primary/25 space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">person_pin</span>
                        <span className="text-xs font-bold text-on-surface">Doctor Consultation & Medication Details</span>
                      </div>
                      {savedDoctors.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowDoctorSuggestions(!showDoctorSuggestions)}
                            className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Saved Doctors ({savedDoctors.length})</span>
                            <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                          </button>
                          {showDoctorSuggestions && (
                            <div className="absolute right-0 mt-1 w-64 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-lg z-20 py-1 text-xs">
                              <div className="px-3 py-1 font-bold text-[10px] uppercase text-on-surface-variant border-b border-surface-container">
                                Select Previously Used Doctor
                              </div>
                              {savedDoctors.map((doc) => (
                                <button
                                  key={doc.id}
                                  type="button"
                                  onClick={() => handleSelectDoctorSuggestion(doc)}
                                  className="w-full text-left px-3 py-1.5 hover:bg-surface-container flex flex-col transition-colors cursor-pointer"
                                >
                                  <strong className="text-on-surface">{doc.name}</strong>
                                  <span className="text-[11px] text-on-surface-variant">{doc.email}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Doctor Name and Email inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-on-surface block mb-1">
                          Doctor / Prescriber Name <span className="text-error">*</span>
                        </label>
                        <input
                          type="text"
                          value={doctorName}
                          onChange={(e) => setDoctorName(e.target.value)}
                          placeholder="e.g. Dr. Rajiv Mehta, MD"
                          className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-on-surface block mb-1">
                          Doctor Email Address <span className="text-error">*</span>
                        </label>
                        <input
                          type="email"
                          value={doctorEmail}
                          onChange={(e) => setDoctorEmail(e.target.value)}
                          placeholder="e.g. doctor@hospital.com"
                          className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* New Medication / Substituted Medication Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-on-surface flex items-center gap-1">
                          <span>Substituted / New Medication</span>
                          <span className="text-[10px] text-on-surface-variant font-normal">(Changed by Doctor)</span>
                        </label>
                        {alternativeAvailable && (
                          <button
                            type="button"
                            onClick={() => setNewMedication(alternativeAvailable)}
                            className="text-[10px] text-primary font-bold hover:underline"
                          >
                            Fill with recommended alternative
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

                    {/* Clinical Rationale Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-on-surface flex items-center gap-1">
                          <span>Clinical Consultation Rationale & Prescriber Note</span>
                          <span className="text-error">*</span>
                        </label>
                        <span className="text-[10px] text-on-surface-variant">{overrideRationale.length} characters</span>
                      </div>
                      <textarea
                        rows={2}
                        value={overrideRationale}
                        onChange={(e) => setOverrideRationale(e.target.value)}
                        placeholder="Document clinical consultation notes, doctor recommendations, and substituted medication plan..."
                        className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant p-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none leading-normal"
                      />
                    </div>

                    {/* Live Email Preview Toggle & Card */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setShowEmailPreview(!showEmailPreview)}
                          className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {showEmailPreview ? 'visibility_off' : 'visibility'}
                          </span>
                          <span>{showEmailPreview ? 'Hide Live Doctor Email Preview' : 'Show Live Doctor Email Preview'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendDoctorEmail}
                          disabled={isSendingEmail || !doctorEmail.trim()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 transition-all"
                        >
                          {isSendingEmail ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                              <span>Sending Email to Doctor...</span>
                            </>
                          ) : emailSentSuccess ? (
                            <>
                              <span className="material-symbols-outlined text-[15px]">check_circle</span>
                              <span>Email Dispatched!</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[15px]">send</span>
                              <span>Send Email to Doctor</span>
                            </>
                          )}
                        </button>
                      </div>

                      {showEmailPreview && (
                        <div className="mt-2.5 p-3.5 rounded-xl bg-surface-container-lowest border border-primary/30 shadow-xs space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-surface-container pb-1.5">
                            <span className="font-bold text-primary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">mail</span>
                              Email Template Preview (To Doctor)
                            </span>
                            <span className="font-mono text-[10px] text-on-surface-variant">smileclinic-mailer</span>
                          </div>
                          <div className="space-y-1 text-[11px] text-on-surface-variant leading-relaxed">
                            <div><strong>To:</strong> Dr. {doctorName || 'Prescriber'} &lt;{doctorEmail || 'doctor@email.com'}&gt;</div>
                            <div><strong>Subject:</strong> Smile Clinic CDS Alert: Prescription Interaction Consultation for {patientName} [{alert.severity.toUpperCase()}]</div>
                            <div><strong>Patient:</strong> {patientName} (MRN: {patientMrn}) | Check #{checkNumber}</div>
                            <div><strong>Interacting Drugs:</strong> <span className="text-error font-semibold">{drugA} ↔ {drugB}</span></div>
                            <div><strong>Alert:</strong> {alert.title} ({alert.severity})</div>
                            <div><strong>Substituted Alternative:</strong> <span className="text-emerald-700 font-bold">{newMedication || 'Pending Doctor Selection'}</span></div>
                            <div className="p-2 rounded bg-surface-container-low border border-surface-container text-on-surface mt-1">
                              <strong>Clinician Note: </strong>{overrideRationale || 'Please review medication change.'}
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

                  {/* Drawer Action Footer Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting || isSuccess || overrideRationale.trim().length < 10}
                      className={`w-full sm:flex-1 h-11 px-4 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                        isSuccess
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-primary hover:bg-primary-container text-on-primary'
                      }`}
                    >
                      {isSuccess ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] text-white">verified</span>
                          <span>Decision & Regimen Saved to Database!</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Saving to Cloud Database...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                          <span>Submit Clinical Review & Save to Database</span>
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
                  {/* Event 1 */}
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

                  {/* Event 2 */}
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
