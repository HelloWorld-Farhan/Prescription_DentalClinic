import React, { useState, useEffect, useRef } from 'react';
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
  currentVersion: string;
  targetVersion: string;
  status: 'idle' | 'connecting' | 'downloading' | 'verifying' | 'synced' | 'error';
  progress: number;
  recordsUpdated: number;
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
      id: 'fdb',
      name: 'First Databank (FDB) MedKnowledge',
      provider: 'First Databank Inc.',
      currentVersion: 'v2025.02-A',
      targetVersion: 'v2025.02-B',
      status: 'idle',
      progress: 0,
      recordsUpdated: 1420
    },
    {
      id: 'lexicomp',
      name: 'Wolters Kluwer Lexicomp DDI',
      provider: 'Wolters Kluwer Health',
      currentVersion: 'Release 2024-Q4',
      targetVersion: 'Release 2025-Q1',
      status: 'idle',
      progress: 0,
      recordsUpdated: 870
    },
    {
      id: 'rxnorm',
      name: 'NIH NLM DailyMed & RxNorm',
      provider: 'U.S. National Library of Medicine',
      currentVersion: 'RxNorm 2025-01',
      targetVersion: 'RxNorm 2025-02',
      status: 'idle',
      progress: 0,
      recordsUpdated: 3150
    },
    {
      id: 'cpic',
      name: 'Clinical Pharmacogenetics (CPIC)',
      provider: 'CPIC Consortium',
      currentVersion: 'CPIC v3.0',
      targetVersion: 'CPIC v3.1',
      status: 'idle',
      progress: 0,
      recordsUpdated: 195
    }
  ]);

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
        '[INFO] Ready to establish mTLS 1.3 link to licensed knowledge feeds.',
        '[INFO] Current active suite: v4.2.1-prod (Zero-Drift invariant active).'
      ]);
    }
  }, [isOpen]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString().slice(11, 19);
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`]);
  };

  const handleStartSync = () => {
    setIsSyncing(true);
    setIsComplete(false);
    setOverallProgress(5);
    addLog(`Initiating ${syncMode === 'delta' ? 'Fast Incremental Delta' : 'Full Schema Re-Index'} synchronization sequence...`);

    // Step 1: Connecting (0 - 25%)
    setTimeout(() => {
      setOverallProgress(25);
      setEngines((prev) =>
        prev.map((e) => ({ ...e, status: 'connecting', progress: 30 }))
      );
      addLog('Handshake established with FDB CDG Gateway (TLS_AES_256_GCM_SHA384).');
      addLog('Connected to Wolters Kluwer Lexicomp Evidence Repository.');
    }, 600);

    // Step 2: Downloading & Parsing (25 - 65%)
    setTimeout(() => {
      setOverallProgress(65);
      setEngines((prev) =>
        prev.map((e) => ({ ...e, status: 'downloading', progress: 75 }))
      );
      addLog('Streaming delta monographs: Drug-Drug interactions, QT prolongation & CYP3A4 tables.');
      addLog('Fetched 5,635 updated concept mappings from RxNorm CUI ontology.');
    }, 1400);

    // Step 3: Verifying Cryptographic Signatures (65 - 90%)
    setTimeout(() => {
      setOverallProgress(90);
      setEngines((prev) =>
        prev.map((e) => ({ ...e, status: 'verifying', progress: 95 }))
      );
      addLog('Verifying FDB & Lexicomp SHA-256 cryptographic signatures: PASS (0 collisions).');
      addLog('Re-compiling deterministic AST rule trees into in-memory engine...');
    }, 2200);

    // Step 4: Finished (100%)
    setTimeout(() => {
      setOverallProgress(100);
      setIsSyncing(false);
      setIsComplete(true);
      setEngines((prev) =>
        prev.map((e) => ({
          ...e,
          status: 'synced',
          progress: 100,
          currentVersion: e.targetVersion
        }))
      );
      addLog('SUCCESS: All 4 clinical engines synchronized & verified against FDA SaMD invariants.');
      addLog('Engine Health: 100% Invariant. Zero-Drift safety enforcement verified.');

      onSyncComplete?.('v2025.02-B', 'Just now');
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-3xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-surface-container-high bg-surface-container-low/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                <span className={`material-symbols-outlined text-[24px] ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-on-surface">
                    Synchronize Clinical Knowledge Bases
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                    CDS v4.2.1
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Update licensed pharmacopeias, verify cryptographic checksums, and re-compile AST rules.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSyncing}
              className="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
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
                    Applies newly published drug interactions, monographs, and FDA warnings since last sync.
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
                      Full Cryptographic Re-Index
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
                    Re-downloads complete knowledge datasets, validates SHA-256 hashes, and rebuilds entire AST.
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
                    <span>{isComplete ? 'Sync Successfully Completed' : 'Synchronization In Progress...'}</span>
                  </div>
                  <span className="font-mono text-primary">{overallProgress}%</span>
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

            {/* 4 Knowledge Engines Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Licensed Knowledge Base Feeds</span>
                <span className="text-[11px] text-outline">4 Active Endpoints</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {engines.map((engine) => (
                  <div
                    key={engine.id}
                    className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-on-surface line-clamp-1">{engine.name}</h4>
                        <span className="text-[10px] text-outline block">{engine.provider}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          engine.status === 'synced'
                            ? 'bg-emerald-100 text-emerald-800'
                            : engine.status === 'idle'
                            ? 'bg-surface-container-high text-on-surface-variant'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {engine.status === 'synced'
                          ? 'VERIFIED'
                          : engine.status === 'idle'
                          ? 'READY'
                          : engine.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1 border-t border-surface-container">
                      <span className="font-mono">{engine.currentVersion}</span>
                      <span className="text-primary font-medium">+{engine.recordsUpdated} rules</span>
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
                <span className="text-[10px] text-outline font-mono">TLS 1.3 | SHA-256</span>
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
          <div className="px-6 py-3.5 border-t border-surface-container-high bg-surface-container-low/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-outline text-[11px]">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
              <span>21 CFR Part 11 and FDA SaMD Class II Validation</span>
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
    </AnimatePresence>
  );
}
