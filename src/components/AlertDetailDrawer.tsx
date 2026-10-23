import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { DrugInteractionAlert } from '../types';

interface AlertDetailDrawerProps {
  alert: DrugInteractionAlert | null;
  isOpen: boolean;
  onClose: () => void;
  onOverride?: (alertId: string, reason: string) => void;
  onSelectAlternative?: (altDrug: string) => void;
}

export default function AlertDetailDrawer({
  alert,
  isOpen,
  onClose,
  onOverride,
  onSelectAlternative
}: AlertDetailDrawerProps) {
  const [decision, setDecision] = useState<'acknowledge' | 'resolve' | 'override'>('override');
  const [overrideRationale, setOverrideRationale] = useState(
    'Prescriber Dr. A. Vance contacted via secure line at 09:28. Confirmed dental/pyelonephritis pathogen resistance to cephalosporins. Plan: Proceed with calibrated dose; daily monitoring order placed.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  if (!alert) return null;
  if (typeof document === 'undefined') return null;

  const templates = {
    acknowledge: 'Clinical drug interaction noted. Proceeding under hospital telemetry & monitoring protocol with routine hepatic/renal panel checks.',
    resolve: 'Order modified to verified non-interacting therapeutic alternative. Interacting agent discontinued or adjusted.',
    override: 'Prescriber Dr. A. Vance contacted via secure line at 09:28. Confirmed clinical necessity with risk-benefit assessment documented. Plan: Proceed with calibrated dose; daily monitoring order placed.'
  };

  const handleSelectDecision = (newDecision: 'acknowledge' | 'resolve' | 'override') => {
    setDecision(newDecision);
    setOverrideRationale(templates[newDecision]);
  };

  const handleAdoptAlternative = (alt: string) => {
    setDecision('resolve');
    setOverrideRationale(`Order modified to verified alternative: ${alt}. Interacting agent discontinued.`);
    onSelectAlternative?.(alt);
  };

  const isContraindicated = alert.severity === 'contraindicated';
  const isMajor = alert.severity === 'major';

  const severityColor = isContraindicated
    ? 'bg-rose-100 text-rose-800 border-rose-300'
    : isMajor
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-primary-container text-on-primary border-primary';

  const severityIcon = isContraindicated ? 'dangerous' : isMajor ? 'warning' : 'info';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        onOverride?.(alert.id, `${decision.toUpperCase()}: ${overrideRationale}`);
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
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          {/* Slide-Over Drawer Canvas */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
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
                  {alert.description || alert.clinicalImpact}
                </p>
                <div className="mt-2 p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">crisis_alert</span>
                  <div className="text-xs text-on-surface-variant leading-relaxed">
                    <strong className="text-on-surface">Kinetic Impact: </strong>
                    Co-administration disrupts hepatic metabolic clearance and intestinal flora synthesis. Dramatic increase in active plasma levels precipitating potential toxicity or prolonged adverse reactions.
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
                  <span className="px-2 py-0.5 rounded bg-surface-container text-xs text-on-surface-variant font-medium">
                    FDA Boxed Warning
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-surface-container text-xs">
                    <div>
                      <span className="text-on-surface-variant block">Primary Attribution:</span>
                      <strong className="text-on-surface">First Databank (FDB) CDS Core & Lexicomp DDI</strong>
                    </div>
                    <div>
                      <span className="text-on-surface-variant block">Evidence Indexing:</span>
                      <span className="font-mono text-on-surface">v2025.02-B | Verified Clinical Rule</span>
                    </div>
                  </div>
                  <blockquote className="p-3 rounded-lg bg-surface-container-low border-l-4 border-primary text-xs text-on-surface italic leading-relaxed">
                    “Concomitant administration is associated with marked elevation of biological half-life and adverse toxicity. Prothrombin time and clinical metrics should be rigorously evaluated or non-interacting antimicrobial selected.”
                  </blockquote>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>Cross-Reference Monograph #492</span>
                    <span className="text-primary font-semibold flex items-center gap-1 cursor-pointer hover:underline">
                      View Lexicomp Monograph <span className="material-symbols-outlined text-[13px]">open_in_new</span>
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
                  <span>Contact prescriber / pharmacist; do not independently stop, start or change medication.</span>
                </div>
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs text-on-surface leading-relaxed">
                      <strong className="text-on-surface">Switch to non-interacting alternative: </strong>
                      {alert.alternativeSuggestion || (alert.alternatives && alert.alternatives[0]) || 'Substitute with oral Amoxicillin 500mg, Ceftriaxone, or local antibiogram-directed agent.'}
                      {(alert.alternativeSuggestion || (alert.alternatives && alert.alternatives[0])) && (
                        <button
                          type="button"
                          onClick={() => handleAdoptAlternative(alert.alternativeSuggestion || alert.alternatives[0])}
                          className="mt-1.5 inline-flex items-center gap-1 text-primary font-bold hover:underline bg-primary/10 px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                          <span>Adopt Alternative →</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs text-on-surface leading-relaxed">
                      <strong className="text-on-surface">If combination is clinically essential: </strong>
                      Empirically calibrate dosage by 30% to 50%. Order immediate baseline laboratory assay and schedule 48-hour repeat testing. Explicitly counsel patient on reporting symptoms.
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Limitations & Missing Data */}
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[20px]">find_replace</span>
                  <h3 className="text-base font-bold text-on-surface">4. Constraints, Limitations & Missing Labs</h3>
                </div>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high/60">
                    <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">notification_important</span>
                    <span className="text-on-surface leading-tight">
                      <strong>Stale Laboratory Baselines: </strong>
                      Most recent renal/hepatic metrics in EMR dated &gt;60 days old. Coagulation baseline is clinically uncertain.
                    </span>
                  </li>
                  <li className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high/60">
                    <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">timelapse</span>
                    <span className="text-on-surface leading-tight">
                      <strong>Renal Clearance Extrapolation: </strong>
                      Reduced eGFR prolongs terminal elimination half-life ($t_{1/2}$ by ~40%), precipitating sustained metabolic suppression.
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
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                    Constrained CDS Engine
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container text-xs text-on-surface leading-relaxed">
                  “The newly proposed medication slows down the normal breakdown of the patient's ongoing therapy in the liver. This causes the drug to build up to dangerous levels, significantly elevating the risk of adverse complications. Because the patient may also have reduced kidney function, the medication stays in the body even longer. An urgent clinical check or alternative is required before dispensing.”
                </div>
              </section>

              {/* 6. Pharmacist Decision & Attestation (Interactive) */}
              <section className="space-y-3 pt-2 border-t border-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">fact_check</span>
                    <h3 className="text-base font-bold text-on-surface">6. Pharmacist Decision & Attestation</h3>
                  </div>
                  <span className="text-error text-xs font-bold">* Required Action</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Selectable Radio Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup">
                    {/* Option 1: Acknowledge */}
                    <div
                      onClick={() => handleSelectDecision('acknowledge')}
                      className={`relative flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                        decision === 'acknowledge'
                          ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                          : 'border-surface-container-high bg-surface-container-lowest hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-on-surface">Acknowledge</span>
                        <input
                          type="radio"
                          name="cds-decision"
                          checked={decision === 'acknowledge'}
                          onChange={() => handleSelectDecision('acknowledge')}
                          className="w-4 h-4 text-primary accent-primary"
                        />
                      </div>
                      <span className="text-[11px] text-on-surface-variant leading-tight">
                        Keep visible for team; proceed under standard protocol.
                      </span>
                    </div>

                    {/* Option 2: Resolve */}
                    <div
                      onClick={() => handleSelectDecision('resolve')}
                      className={`relative flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                        decision === 'resolve'
                          ? 'border-emerald-600 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-600'
                          : 'border-surface-container-high bg-surface-container-lowest hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-on-surface">Resolve</span>
                        <input
                          type="radio"
                          name="cds-decision"
                          checked={decision === 'resolve'}
                          onChange={() => handleSelectDecision('resolve')}
                          className="w-4 h-4 text-emerald-600 accent-emerald-600"
                        />
                      </div>
                      <span className="text-[11px] text-on-surface-variant leading-tight">
                        Order modified to verified non-interacting alternative.
                      </span>
                    </div>

                    {/* Option 3: Override */}
                    <div
                      onClick={() => handleSelectDecision('override')}
                      className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        decision === 'override'
                          ? 'border-primary bg-primary/15 shadow-xs ring-1 ring-primary'
                          : 'border-surface-container-high bg-surface-container-lowest hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">gavel</span>
                          Override
                        </span>
                        <input
                          type="radio"
                          name="cds-decision"
                          checked={decision === 'override'}
                          onChange={() => handleSelectDecision('override')}
                          className="w-4 h-4 text-primary accent-primary"
                        />
                      </div>
                      <span className="text-[11px] text-on-surface leading-tight font-medium">
                        Prescriber accepts risk with therapeutic rationale.
                      </span>
                    </div>
                  </div>

                  {/* Mandatory Override Rationale Box */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-surface-container-low border border-primary/30">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface flex items-center gap-1">
                        <span>Mandatory Clinical Rationale for Decision</span>
                        <span className="text-error">*</span>
                      </label>
                      <span className="text-[10px] text-on-surface-variant">Min. 25 chars</span>
                    </div>
                    <textarea
                      rows={3}
                      value={overrideRationale}
                      onChange={(e) => setOverrideRationale(e.target.value)}
                      placeholder="Document clinical justification, prescriber consult notes, or monitoring plan..."
                      className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant p-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-all leading-normal"
                    />
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1">
                      <span className="text-primary flex items-center gap-1 font-medium">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        Signed & encrypted into permanent HIPAA audit log
                      </span>
                      <span>{overrideRationale.length} characters</span>
                    </div>
                  </div>

                  {/* Reviewer Signature Metadata */}
                  <div className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-[11px]">
                        SL
                      </div>
                      <span>Reviewer: <strong className="text-on-surface">Dr. Sarah Lin, PharmD (BCPS, Inpatient Lead)</strong></span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>DEA/Lic: PH-99281</span>
                      <span>{new Date().toISOString().slice(0, 10)}</span>
                    </div>
                  </div>

                  {/* Drawer Action Footer Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting || isSuccess || overrideRationale.length < 10}
                      className={`w-full sm:flex-1 h-10 px-4 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                        isSuccess
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                          : 'bg-primary hover:bg-primary-container text-on-primary'
                      }`}
                    >
                      {isSuccess ? (
                        <>
                          <span className="material-symbols-outlined text-[18px] text-white">verified</span>
                          <span>Protocol Signed & Encrypted!</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          <span>Recording Decision...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                          <span>Submit Review & Sign Protocol</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto h-10 px-4 rounded-xl border border-primary text-primary hover:bg-primary/5 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel / Close
                    </button>
                  </div>
                </form>
              </section>

              {/* 7. Historical Audit & Action Log */}
              <section className="space-y-3 pt-2 border-t border-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[20px]">history</span>
                    <h3 className="text-base font-bold text-on-surface">7. Historical Audit & Action Log</h3>
                  </div>
                  <span className="text-xs text-on-surface-variant font-medium">3 Events Recorded</span>
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
                        <span className="font-mono text-on-surface-variant">Today 09:22:15 UTC</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Rule <span className="font-mono text-on-surface text-[11px] bg-surface-container px-1 py-0.5 rounded">CDS-DDI-CYP1A2-VKORC1</span> evaluated with High Severity flag.
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
                        <span className="font-bold text-on-surface">Automated Escalation</span>
                        <span className="text-outline">•</span>
                        <span className="font-mono text-on-surface-variant">Today 09:26:04 UTC</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Flagged as <strong className="text-on-surface">Unreviewed Blocker</strong>. Order placed on clinical hold pending pharmacist sign-off.
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
