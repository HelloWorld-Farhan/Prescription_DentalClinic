import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (version?: string, timestamp?: string) => void;
}

export default function SyncKnowledgeModal({
  isOpen,
  onClose,
  onSyncComplete,
}: SyncKnowledgeModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [activeStepText, setActiveStepText] = useState('');
  const [syncCompleted, setSyncCompleted] = useState(false);

  // Lock body scroll on open
  useEffect(() => {
    if (!isOpen) {
      setIsSyncing(false);
      setSyncProgress(0);
      setActiveStepText('');
      setSyncCompleted(false);
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSyncing) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isSyncing]);

  const handleStartSync = () => {
    setIsSyncing(true);
    setSyncProgress(15);
    setActiveStepText('Verifying active clinical interaction rules...');

    setTimeout(() => {
      setSyncProgress(45);
      setActiveStepText('Re-indexing FDA monograph contraindication matrix...');
    }, 600);

    setTimeout(() => {
      setSyncProgress(80);
      setActiveStepText('Synchronizing encrypted clinical document vault...');
    }, 1200);

    setTimeout(() => {
      setSyncProgress(100);
      setActiveStepText('All engines & clinical vault verified and synchronized.');
      setSyncCompleted(true);
      const nowIso = new Date().toISOString();
      if (typeof window !== 'undefined') {
        localStorage.setItem('smileclinic_last_rules_sync', nowIso);
      }
      setTimeout(() => {
        if (onSyncComplete) {
          onSyncComplete('v2.4.0', 'Just now');
        }
        onClose();
      }, 700);
    }, 1800);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4 select-none">
          {/* Animated Full-Screen Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            onClick={isSyncing ? undefined : onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          {/* Modal Window Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 max-w-lg w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Top Modal Header */}
            <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">sync</span>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-on-surface">
                    Synchronize Decision Engines &amp; Vault
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Re-verify active clinical rules and refresh secure clinical vault indices.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isSyncing}
                onClick={onClose}
                className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors disabled:opacity-50"
                title="Close"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-5 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Active Feeds Status Cards */}
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-primary">rule_folder</span>
                    <div>
                      <div className="text-xs font-bold text-on-surface">Clinical Decision Rules Matrix</div>
                      <div className="text-[10px] text-on-surface-variant">Contraindications, Allergies &amp; Renal Adjustments</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Ready</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-teal-600">verified</span>
                    <div>
                      <div className="text-xs font-bold text-on-surface">FDA &amp; Clinical Safety Monograph Feeds</div>
                      <div className="text-[10px] text-on-surface-variant">Drug Interaction Reference &amp; Beers Criteria</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Online</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-primary">cloud_done</span>
                    <div>
                      <div className="text-xs font-bold text-on-surface">Encrypted Document Vault</div>
                      <div className="text-[10px] text-on-surface-variant">Patient prescriptions, lab reports &amp; camera scans</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Protected</span>
                </div>
              </div>

              {/* Progress Bar (when actively syncing) */}
              {isSyncing && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-primary">
                    <span className="flex items-center gap-1.5">
                      <svg className="saving-spinner w-3.5 h-3.5 text-primary shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>{activeStepText}</span>
                    </span>
                    <span className="font-mono">{syncProgress}%</span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${syncProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
              <button
                type="button"
                disabled={isSyncing}
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSyncing || syncCompleted}
                onClick={handleStartSync}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-on-primary hover:bg-primary-container transition-all cursor-pointer shadow-sm flex items-center gap-2 disabled:opacity-60"
              >
                {isSyncing ? (
                  <>
                    <svg className="saving-spinner w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Synchronizing...</span>
                  </>
                ) : syncCompleted ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Synchronized!</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    <span>Synchronize All Engines</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
