import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getDocumentHistory, UploadedDocumentRecord, isAvatarFile } from '../services/r2StorageService';
import { PrescriptionStorage as VirtualDb } from '../services/prescriptionService';
import { InteractionRule, SafetyCheckRecord } from '../types';
import { showConfirmation } from '../services/confirmation';
import {
  getMultiKnowledgeBaseState,
  saveKnowledgeBase,
  clearKnowledgeBase,
  KnowledgeBaseProfile,
} from '../services/knowledgeBaseService';

interface SyncKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetKbId?: string;
  onSyncComplete?: (version?: string, timestamp?: string) => void;
}

export interface SyncableItem {
  id: string;
  type: 'document' | 'check' | 'rule';
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  filename?: string;
  date?: string;
}

export default function SyncKnowledgeModal({
  isOpen,
  onClose,
  targetKbId,
  onSyncComplete,
}: SyncKnowledgeModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [activeStepText, setActiveStepText] = useState('');
  const [syncCompleted, setSyncCompleted] = useState(false);

  // Multi-KB profiles and currently configured slot
  const [multiKbs, setMultiKbs] = useState<KnowledgeBaseProfile[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>('kb-1');
  const [kbName, setKbName] = useState<string>('');

  // Syncable items list and selection
  const [items, setItems] = useState<SyncableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'history' | 'check'>('all');

  // Load real data from storage when opened
  useEffect(() => {
    if (!isOpen) {
      setIsSyncing(false);
      setSyncProgress(0);
      setActiveStepText('');
      setSyncCompleted(false);
      return;
    }

    const state = getMultiKnowledgeBaseState();
    setMultiKbs(state.knowledgeBases);
    const initialKbId = targetKbId && state.knowledgeBases.some(k => k.id === targetKbId)
      ? targetKbId
      : state.activeKbId;
    setSelectedKbId(initialKbId);
    const initialProfile = state.knowledgeBases.find(k => k.id === initialKbId);
    setKbName(initialProfile?.name || '');

    const loadedItems: SyncableItem[] = [];

    // 1. Uploaded Clinical History Documents (e.g. Kidney_History.pdf, Liver_History.pdf)
    try {
      const docs: UploadedDocumentRecord[] = getDocumentHistory();
      docs
        .filter(
          (doc) =>
            !isAvatarFile(doc.filename) &&
            !isAvatarFile(doc.storageUrl) &&
            doc.category !== 'prescription' &&
            !doc.id.startsWith('doc-chk-')
        )
        .forEach((doc) => {
          let icon = 'description';
          const ft = (doc.fileType || '').toLowerCase();
          const fn = (doc.filename || '').toLowerCase();
          if (ft.includes('pdf') || fn.endsWith('.pdf')) icon = 'picture_as_pdf';
          else if (ft.includes('image') || /\.(png|jpg|jpeg|webp)$/.test(fn)) icon = 'image';
          else if (ft.includes('sheet') || ft.includes('csv') || /\.(xlsx|xls|csv)$/.test(fn)) icon = 'table_view';

          const sizeKb = doc.fileSize ? (doc.fileSize / 1024).toFixed(1) : '0';
          loadedItems.push({
            id: `doc-${doc.id || doc.filename}`,
            type: 'document',
            title: doc.filename || 'Uploaded History Document',
            subtitle: `Uploaded Clinical History • ${sizeKb} KB • ${doc.extractedRulesCount || 0} extracted rules`,
            icon,
            badge: 'Uploaded History',
            filename: doc.filename,
            date: doc.uploadedAt,
          });
        });
    } catch {}

    // 2. Clinical Screening Checks (Prior Prescriptions)
    try {
      const checks: SafetyCheckRecord[] = VirtualDb.getChecks();
      checks.forEach((check) => {
        loadedItems.push({
          id: `check-${check.id}`,
          type: 'check',
          title: `Prescription #${check.checkNumber || check.id} — ${check.patientName || 'Patient'}`,
          subtitle: `${check.prescriptions?.length || 0} medications • Status: ${check.overallStatus || 'Safe to Dispense'}`,
          icon: 'fact_check',
          badge: 'Prior Regimen',
          date: check.timestamp,
        });
      });
    } catch {}

    // 3. Custom Decision Rules
    try {
      const rules: InteractionRule[] = VirtualDb.getRules();
      rules.forEach((rule) => {
        loadedItems.push({
          id: `rule-${rule.id}`,
          type: 'rule',
          title: `${rule.drugA} ↔ ${rule.drugB}`,
          subtitle: `${rule.category} • ${(rule.severity || 'moderate').toUpperCase()} severity`,
          icon: 'rule',
          badge: 'Clinical Rule',
          date: rule.createdAt,
        });
      });
    } catch {}

    setItems(loadedItems);

    // Initialize selection from the target knowledge base profile
    const targetKb = state.knowledgeBases.find((k) => k.id === initialKbId);
    if (targetKb && targetKb.selection && targetKb.selection.length > 0) {
      const validSet = new Set(targetKb.selection.filter((id) => loadedItems.some((i) => i.id === id)));
      setSelectedIds(validSet);
    } else {
      setSelectedIds(new Set());
    }
  }, [isOpen, targetKbId]);

  // Handle switching which KB profile is being configured in this modal
  const handleSwitchTargetKb = (kbId: string) => {
    if (isSyncing) return;
    setSelectedKbId(kbId);
    const targetKb = multiKbs.find((k) => k.id === kbId);
    if (targetKb) {
      setKbName(targetKb.name);
    }
    if (targetKb && targetKb.selection && targetKb.selection.length > 0) {
      const validSet = new Set(targetKb.selection.filter((id) => items.some((i) => i.id === id)));
      setSelectedIds(validSet);
    } else {
      setSelectedIds(new Set());
    }
  };

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

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return items;
    if (categoryFilter === 'history') return items.filter((i) => i.type === 'document' || i.type === 'rule');
    if (categoryFilter === 'check') return items.filter((i) => i.type === 'check');
    return items;
  }, [items, categoryFilter]);

  const handleToggleItem = (id: string) => {
    if (isSyncing) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (isSyncing) return;
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleClearCurrentKb = () => {
    if (isSyncing) return;
    clearKnowledgeBase(selectedKbId);
    setSelectedIds(new Set());
    const currentName = multiKbs.find((k) => k.id === selectedKbId)?.name || 'Knowledge Base';
    showConfirmation(`Cleared all knowledge sources from "${currentName}"`, 'info');
  };

  const handleStartSync = () => {
    // Gather specific selected subsets
    const selectedDocs: string[] = [];
    const selectedChecks: string[] = [];
    const selectedRules: string[] = [];

    items.forEach((item) => {
      if (!selectedIds.has(item.id)) return;
      if (item.type === 'document' && item.filename) {
        selectedDocs.push(item.filename);
      } else if (item.type === 'check') {
        selectedChecks.push(item.id.replace('check-', ''));
      } else if (item.type === 'rule') {
        selectedRules.push(item.id.replace('rule-', ''));
      }
    });

    // Derive active condition summaries from selected clinical history documents
    const derivedConditions = selectedDocs.map((docName) => {
      return docName.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
    });

    const targetKbName = multiKbs.find((k) => k.id === selectedKbId)?.name || 'Knowledge Base';
    const trimmedName = kbName.trim() || targetKbName;

    setIsSyncing(true);
    setSyncProgress(25);
    setActiveStepText(`Validating ${selectedIds.size} selected sources for ${trimmedName}...`);

    setTimeout(() => {
      setSyncProgress(60);
      const docsSummary = selectedDocs.length > 0 ? selectedDocs.join(', ') : 'No document history';
      setActiveStepText(`Binding clinical history records (${docsSummary})...`);
    }, 600);

    setTimeout(() => {
      setSyncProgress(85);
      setActiveStepText(`Injecting knowledge sources into "${trimmedName}"...`);
    }, 1200);

    setTimeout(() => {
      setSyncProgress(100);
      setActiveStepText('Knowledge base successfully synchronized.');
      setSyncCompleted(true);

      const selectionArray = Array.from(selectedIds);

      // Save into the targeted Knowledge Base profile with user-provided name
      saveKnowledgeBase(selectedKbId, {
        name: trimmedName,
        selection: selectionArray,
        docs: selectedDocs,
        checks: selectedChecks,
        rules: selectedRules,
        conditions: derivedConditions,
      });

      showConfirmation(
        `Synchronized ${selectedDocs.length} history documents and ${selectedChecks.length} prior prescriptions into "${trimmedName}"`,
        'success'
      );

      setTimeout(() => {
        if (onSyncComplete) {
          onSyncComplete('v2.5.0', 'Just now');
        }
        onClose();
      }, 700);
    }, 1800);
  };

  if (typeof document === 'undefined') return null;

  const hasData = items.length > 0;
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const currentKbObj = multiKbs.find((k) => k.id === selectedKbId);

  const docCount = items.filter((i) => i.type === 'document').length;
  const checkCount = items.filter((i) => i.type === 'check').length;

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
                  <span className="material-symbols-outlined text-[18px]">account_tree</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Synchronize Knowledge Base</h3>
                  <p className="text-xs text-on-surface-variant">
                    Configuring:{' '}
                    <span className="font-semibold text-primary">{currentKbObj?.name || 'Selected Protocol'}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isSyncing}
                className="w-8 h-8 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Target Knowledge Base Profile Switcher (3 Slots) */}
            <div className="pt-3 pb-1 shrink-0">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-on-surface-variant">Target Knowledge Base Slot:</span>
                <span className="text-[11px] text-outline">Select slot to configure</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface-container-low border border-surface-container-high/60">
                {multiKbs.map((kb, idx) => {
                  const isTarget = kb.id === selectedKbId;
                  return (
                    <button
                      key={kb.id}
                      type="button"
                      disabled={isSyncing}
                      onClick={() => handleSwitchTargetKb(kb.id)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center truncate cursor-pointer ${
                        isTarget
                          ? 'bg-primary text-white shadow-2xs'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                      }`}
                      title={kb.name}
                    >
                      Slot {idx + 1}: {kb.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Knowledge Base Name Customization Field */}
            <div className="pt-2 pb-1 shrink-0">
              <label className="flex items-center justify-between text-xs font-semibold text-on-surface-variant mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">badge</span>
                  <span>Knowledge Base Name:</span>
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Saves to DB & syncs to all devices</span>
              </label>
              <input
                type="text"
                disabled={isSyncing}
                value={kbName}
                onChange={(e) => setKbName(e.target.value)}
                placeholder="Enter Knowledge Base Name (e.g. Pediatric & Geriatric Safety)"
                className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors shadow-2xs"
              />
            </div>

            {/* Category Filter Pills & Select All Row */}
            <div className="flex items-center justify-between py-3 border-b border-surface-container shrink-0 gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('history')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    categoryFilter === 'history'
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  History ({docCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('check')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    categoryFilter === 'check'
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  Regimens ({checkCount})
                </button>
              </div>

              {hasData && (
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleToggleAll}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                </button>
              )}
            </div>

            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1 my-1">
              {!hasData ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-4xl">folder_off</span>
                  <p className="text-xs font-medium">No clinical history documents or prior prescriptions found.</p>
                  <p className="text-[11px] text-on-surface-variant max-w-xs">
                    Upload clinical history documents or run prior prescription checks to sync them into this knowledge base.
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      className={`p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                        isChecked
                          ? 'bg-primary/5 border-primary/40 shadow-2xs'
                          : 'bg-surface-container-lowest border-surface-container hover:border-outline/30'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          disabled={isSyncing}
                          className="w-4 h-4 rounded text-primary border-outline/40 focus:ring-primary cursor-pointer"
                        />
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-surface-container text-on-surface flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-primary">{item.icon}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-on-surface truncate max-w-[260px]">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                            {item.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-outline truncate mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* In-Flight Synchronization Progress */}
            {isSyncing && (
              <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-2 mb-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] animate-spin text-primary">
                      progress_activity
                    </span>
                    {activeStepText || 'Synchronizing with Knowledge Base...'}
                  </span>
                  <span className="font-bold text-primary">{syncProgress}%</span>
                </div>

                <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    initial={{ width: 0 }}
                    animate={{ width: `${syncProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-surface-container shrink-0 gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSyncing || selectedIds.size === 0}
                  onClick={handleClearCurrentKb}
                  className="px-2.5 py-1.5 text-xs font-semibold text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
                  title="Clear all knowledge sources from this slot"
                >
                  <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                  <span>Clear Slot</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isSyncing}
                onClick={handleStartSync}
                className="px-4 py-2 text-xs font-bold bg-primary text-on-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>
                  {isSyncing
                    ? 'Synchronizing...'
                    : syncCompleted
                    ? 'Synchronized!'
                    : `Save & Sync (${selectedIds.size})`}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
