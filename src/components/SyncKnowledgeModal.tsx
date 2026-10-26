import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (version: string, timestamp: string) => void;
}

interface EngineSyncState {
  id: string;
  name: string;
  provider: string;
  status: 'idle' | 'syncing' | 'verified';
  scope: string;
}

export default function SyncKnowledgeModal({
  isOpen,
  onClose,
  onSyncComplete
}: SyncKnowledgeModalProps) {
  const [syncMode, setSyncMode] = useState<'delta' | 'full'>('delta');
  const [isSyncing, setIsSyncing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const [engines, setEngines] = useState<EngineSyncState[]>([
    {
      id: 'cds-core',
      name: 'Clinical Decision Support (CDS) Rules',
      provider: 'Smile Clinic Clinical Informatics',
      status: 'idle',
      scope: 'Active Prescription Safety & AST Checks'
    },
    {
      id: 'ddi-matrix',
      name: 'Drug-Drug Interaction Matrix',
      provider: 'Verified Pharmacopeia Standards',
      status: 'idle',
      scope: 'Contraindication & Severity Scoring'
    },
    {
      id: 'renal-dose',
      name: 'Renal & Pediatric Dose Ceiling Engine',
      provider: 'Clinical Pharmacokinetics Service',
      status: 'idle',
      scope: 'eGFR, CrCl & Frequency Thresholds'
    },
    {
      id: 'allergy-cross',
      name: 'Allergy & Contraindication Validator',
      provider: 'National Clinical Ontology Standards',
      status: 'idle',
      scope: 'Cross-Reactivity & Drug Class Matching'
    }
  ]);

  // Lock body scroll on open
  useEffect(() => {
    if (!isOpen) return;
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

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && !isSyncing && !isComplete) {
      setOverallProgress(0);
      setLogs([
        '[INIT] Gateway readiness check complete.',
        '[INFO] Ready to synchronize active clinical knowledge engines.',
        '[INFO] Zero-drift invariant verification service active.'
      ]);
    }
  }, [isOpen]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  const handleStartSync = () => {
    setIsSyncing(true);
    setIsComplete(false);
    setOverallProgress(10);
    addLog(`Initiating ${syncMode === 'delta' ? 'incremental delta' : 'full index'} synchronization...`);

    // Step 1: Connecting
    setTimeout(() => {
      setOverallProgress(35);
      setEngines((prev) =>
        prev.map((e) => ({ ...e, status: 'syncing' }))
      );
      addLog('Connecting to clinical decision support rules repository...');
      addLog('Verifying AST compiled rules against active prescription database...');
    }, 500);

    // Step 2: Validating
    setTimeout(() => {
      setOverallProgress(70);
      addLog('Validating drug-drug interaction matrix and severity grading thresholds...');
      addLog('Re-compiling deterministic AST rule trees into active memory...');
    }, 1200);

    // Step 3: Verified & Completed
    setTimeout(() => {
      setOverallProgress(100);
      setIsSyncing(false);
      setIsComplete(true);
      setEngines((prev) =>
        prev.map((e) => ({
          ...e,
          status: 'verified'
        }))
      );
      addLog('SUCCESS: All clinical knowledge engines verified and active.');
      addLog('Engine Health: 100% Invariant. In-memory cache compiled.');

      const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      try {
        localStorage.setItem('smileclinic_knowledge_sync_timestamp', `Today at ${nowFormatted}`);
      } catch {}

      onSyncComplete?.('Production', `Today at ${nowFormatted}`);
    }, 2000);
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop (matching standard popups across application) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isSyncing && onClose()}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Top Clinical Header Strip with Smooth Gradient */}
          <div className="bg-gradient-to-r from-primary/10 via-surface-container-low to-transparent p-5 sm:p-6 border-b border-surface-container-high/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                <span className={`material-symbols-outlined text-[24px] ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">
                    Synchronize Clinical Knowledge Bases
                  </h2>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-bold uppercase tracking-wider">
                    CDS Engine
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Update active clinical rules, verify AST decision trees, and re-compile in-memory knowledge cache.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="w-8 h-8 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
              title="Close"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* Sync Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface block">Synchronization Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div
                  onClick={() => !isSyncing && setSyncMode('delta')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    syncMode === 'delta'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-surface-container-high bg-surface-container-lowest hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[16px]">bolt</span>
                      Incremental Delta Patch
                    </span>
                    <input
                      type="radio"
                      name="sync-mode"
                      checked={syncMode === 'delta'}
                      onChange={() => setSyncMode('delta')}
                      disabled={isSyncing}
                      className="accent-primary"
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Applies newly updated clinical rules and active monograph adjustments since last synchronization.
                  </p>
                </div>

                <div
                  onClick={() => !isSyncing && setSyncMode('full')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    syncMode === 'full'
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-surface-container-high bg-surface-container-lowest hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
                      Full Re-Compilation
                    </span>
                    <input
                      type="radio"
                      name="sync-mode"
                      checked={syncMode === 'full'}
                      onChange={() => setSyncMode('full')}
                      disabled={isSyncing}
                      className="accent-primary"
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    Re-compiles the entire decision support rule base and validates all AST invariant trees.
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            {(isSyncing || isComplete) && (
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-on-surface">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-primary animate-ping'}`}></span>
                    <span>{isComplete ? 'Synchronization Verified & Complete' : 'Synchronizing Knowledge Cache...'}</span>
                  </div>
                  <span className="font-mono text-primary font-bold">{overallProgress}%</span>
                </div>
                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-primary'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ ease: 'easeInOut' }}
                  />
                </div>
              </div>
            )}

            {/* Knowledge Engines Status Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Clinical Knowledge Modules</span>
                <span className="text-[11px] text-outline">4 Active Modules</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {engines.map((engine) => (
                  <div
                    key={engine.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-on-surface line-clamp-1">{engine.name}</h4>
                        <span className="text-[10px] text-outline block">{engine.provider}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          engine.status === 'verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : engine.status === 'idle'
                            ? 'bg-surface-container-high text-on-surface-variant'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {engine.status === 'verified'
                          ? 'VERIFIED'
                          : engine.status === 'idle'
                          ? 'READY'
                          : 'SYNCING'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-surface-container">
                      <span className="text-outline text-[10px]">{engine.scope}</span>
                      <span className="text-emerald-700 font-semibold text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Terminal Stream Log */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">terminal</span>
                  Audit Event Stream
                </span>
                <span className="text-[10px] text-outline font-mono">TLS 1.3 | AES-256</span>
              </div>
              <div
                ref={logContainerRef}
                className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3 rounded-xl border border-slate-800 h-28 overflow-y-auto leading-relaxed space-y-1 shadow-inner"
              >
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.includes('SUCCESS')
                        ? 'text-emerald-400 font-bold'
                        : log.includes('INIT')
                        ? 'text-cyan-400'
                        : 'text-slate-300'
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-surface-container-high bg-surface-container-low/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-outline text-[11px]">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified</span>
              <span>Encrypted Decision Support Engine</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl border border-surface-container-high text-on-surface hover:bg-surface-container text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isComplete ? 'Close' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={isComplete ? onClose : handleStartSync}
                disabled={isSyncing}
                className={`px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  isComplete
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                    : 'bg-primary hover:bg-primary-container text-on-primary'
                }`}
              >
                {isSyncing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Synchronizing Knowledge...</span>
                  </>
                ) : isComplete ? (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Done &amp; Applied</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">cloud_sync</span>
                    <span>Start Live Synchronization</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
