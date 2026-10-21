import React, { useState } from 'react';
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
  const [overrideReason, setOverrideReason] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  if (!alert) return null;

  const isContraindicated = alert.severity === 'contraindicated';
  const isMajor = alert.severity === 'major';
  const isModerate = alert.severity === 'moderate';

  const severityColor = isContraindicated
    ? 'bg-rose-100 text-rose-800 border-rose-300'
    : isMajor
    ? 'bg-orange-100 text-orange-800 border-orange-300'
    : isModerate
    ? 'bg-amber-100 text-amber-800 border-amber-300'
    : 'bg-emerald-100 text-emerald-800 border-emerald-300';

  const severityIcon = isContraindicated ? 'dangerous' : isMajor ? 'warning' : isModerate ? 'error_outline' : 'check_circle';

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = overrideReason.trim() || selectedPreset;
    if (!finalReason) return;

    setIsSubmittingOverride(true);
    setTimeout(() => {
      onOverride?.(alert.id, finalReason);
      setIsSubmittingOverride(false);
      setOverrideReason('');
      setSelectedPreset('');
      onClose();
    }, 400);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity"
          />

          {/* Slide-over Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 max-w-2xl w-full bg-surface-container-lowest shadow-2xl z-50 flex flex-col overflow-hidden border-l border-surface-container-high"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-surface-container-low flex items-start justify-between bg-surface-container-lowest/90 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border flex items-center justify-center ${severityColor}`}>
                  <span className="material-symbols-outlined text-[24px]">{severityIcon}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${severityColor}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">
                      {alert.evidenceGrade}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-on-surface mt-1 leading-snug line-clamp-2">
                    {alert.title}
                  </h2>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-colors"
                title="Close"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Interacting Agents Chips */}
              <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high">
                <span className="text-xs uppercase font-bold text-on-surface-variant tracking-wider block mb-2">
                  Interacting Pair / Context
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {alert.interactingDrugs.map((drug, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-surface-container-high font-semibold text-sm text-primary shadow-xs">
                        {drug}
                      </span>
                      {idx < alert.interactingDrugs.length - 1 && (
                        <span className="material-symbols-outlined text-outline text-[18px]">sync_alt</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Mechanism of Action */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <span className="material-symbols-outlined text-[20px]">biotech</span>
                  Pharmacological Mechanism
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed bg-surface rounded-xl p-4 border border-surface-container-low">
                  {alert.mechanism}
                </p>
              </div>

              {/* Clinical Impact */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                  <span className="material-symbols-outlined text-[20px]">medical_services</span>
                  Expected Clinical Impact
                </div>
                <div className="p-4 bg-rose-50/60 rounded-xl border border-rose-200/60 text-sm text-rose-950 leading-relaxed font-medium">
                  {alert.clinicalImpact}
                </div>
              </div>

              {/* Evidence-Backed Guidance */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  Clinical Guidance & Action Required
                </div>
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/60 text-sm text-emerald-950 leading-relaxed">
                  {alert.recommendation}
                </div>
              </div>

              {/* Safer Alternatives */}
              {alert.alternatives && alert.alternatives.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-primary tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">recommend</span>
                      Evidence-Based Alternatives
                    </span>
                    <span className="text-xs text-on-surface-variant font-medium">Safe in patient context</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {alert.alternatives.map((alt, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-surface-container-lowest rounded-xl border border-primary/20 hover:border-primary flex items-center justify-between group transition-all shadow-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="text-sm font-bold text-on-surface block truncate">{alt}</span>
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Zero cross-reactivity
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectAlternative?.(alt);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white rounded-lg transition-colors shrink-0"
                        >
                          Use
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overridden Badge or Clinician Override Form */}
              <div className="pt-4 border-t border-surface-container-high">
                {alert.overridden ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <span className="material-symbols-outlined text-[20px] text-amber-600">done_all</span>
                      Alert Overridden by {alert.overrideAuthor}
                    </div>
                    <p className="text-xs mt-1.5 font-medium leading-relaxed">
                      <strong>Documented Rationale:</strong> {alert.overrideReason}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleOverrideSubmit} className="space-y-3 bg-surface-container-low p-4 rounded-2xl border border-surface-container-high">
                    <div className="flex items-center gap-2 text-on-surface font-bold text-sm">
                      <span className="material-symbols-outlined text-[20px] text-primary">gavel</span>
                      Document Clinician Override
                    </div>
                    <p className="text-xs text-on-surface-variant">
                      If clinical benefit strictly outweighs documented risk, enter justification for the permanent legal audit trail.
                    </p>

                    <div className="space-y-2">
                      <select
                        value={selectedPreset}
                        onChange={(e) => {
                          setSelectedPreset(e.target.value);
                          if (e.target.value) setOverrideReason(e.target.value);
                        }}
                        className="w-full text-xs bg-surface-container-lowest border border-surface-container-high rounded-xl p-2.5 text-on-surface outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Select standard clinical justification...</option>
                        <option value="Patient previously tolerated this agent safely without adverse reactions.">Patient previously tolerated this agent safely without adverse reactions.</option>
                        <option value="Short-course acute administration (≤3 days) with continuous monitoring.">Short-course acute administration (≤3 days) with continuous monitoring.</option>
                        <option value="Therapeutic benefits decisively outweigh calculated interaction risk.">Therapeutic benefits decisively outweigh calculated interaction risk.</option>
                        <option value="Specialist consultation obtained; risk mitigation protocol in place.">Specialist consultation obtained; risk mitigation protocol in place.</option>
                      </select>

                      <textarea
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Or provide custom clinical reasoning..."
                        rows={2}
                        className="w-full text-xs bg-surface-container-lowest border border-surface-container-high rounded-xl p-2.5 text-on-surface outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-outline"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingOverride || (!overrideReason.trim() && !selectedPreset)}
                      className="w-full py-2.5 px-4 rounded-xl bg-on-surface text-surface font-bold text-xs hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      {isSubmittingOverride ? 'Signing Override...' : 'Sign & Submit Clinical Override'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
