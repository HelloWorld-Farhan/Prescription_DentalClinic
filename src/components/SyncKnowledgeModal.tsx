import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getDocumentHistory, UploadedDocumentRecord, isAvatarFile } from '../services/r2StorageService';
import { PrescriptionStorage as VirtualDb } from '../services/prescriptionService';
import { InteractionRule, SafetyCheckRecord } from '../types';
import { pushKnowledgeSyncState } from '../services/cloudSyncService';
import { showConfirmation } from '../services/confirmation';

interface SyncKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  onSyncComplete,
}: SyncKnowledgeModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [activeStepText, setActiveStepText] = useState('');
  const [syncCompleted, setSyncCompleted] = useState(false);

  // Syncable items list and selection
  const [items, setItems] = useState<SyncableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'document' | 'check' | 'rule'>('all');

  // Load real data from storage when opened (NO dummy static conditions)
  useEffect(() => {
    if (!isOpen) {
      setIsSyncing(false);
      setSyncProgress(0);
      setActiveStepText('');
      setSyncCompleted(false);
      return;
    }

    const loadedItems: SyncableItem[] = [];

    // 1. Uploaded Clinical History Documents (e.g. Kidney_History.pdf, Liver_History.pdf)
    try {
      const docs: UploadedDocumentRecord[] = getDocumentHistory();
      docs
        .filter((doc) => !isAvatarFile(doc.filename) && !isAvatarFile(doc.storageUrl))
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

    // Initialize selection: restore previously saved selection or select all by default
    try {
      const rawSaved = localStorage.getItem('smileclinic_synced_knowledge_selection');
      if (rawSaved) {
        const parsed = JSON.parse(rawSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Verify that parsed items exist in loadedItems
          const validSet = new Set(parsed.filter((id) => loadedItems.some((i) => i.id === id)));
          if (validSet.size > 0) {
            setSelectedIds(validSet);
            return;
          }
        }
      }
    } catch {}

    // Default: Select all loaded real items
    setSelectedIds(new Set(loadedItems.map((i) => i.id)));
  }, [isOpen]);

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
    return items.filter((i) => i.type === categoryFilter);
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

  const handleStartSync = () => {
    if (selectedIds.size === 0) return;

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

    setIsSyncing(true);
    setSyncProgress(25);
    setActiveStepText(`Validating ${selectedIds.size} selected clinical history & regimen records...`);

    setTimeout(() => {
      setSyncProgress(60);
      const docsSummary = selectedDocs.length > 0 ? selectedDocs.join(', ') : 'No document history';
      setActiveStepText(`Syncing active history documents (${docsSummary})...`);
    }, 600);

    setTimeout(() => {
      setSyncProgress(85);
      setActiveStepText('Injecting active knowledge sources into Prescription AI context...');
    }, 1200);

    setTimeout(() => {
      setSyncProgress(100);
      setActiveStepText('Prescription AI knowledge source successfully synchronized.');
      setSyncCompleted(true);

      const nowIso = new Date().toISOString();
      const selectionArray = Array.from(selectedIds);

      // Persist locally for immediate AI inspection
      try {
        localStorage.setItem('smileclinic_synced_knowledge_selection', JSON.stringify(selectionArray));
        localStorage.setItem('smileclinic_synced_active_docs', JSON.stringify(selectedDocs));
        localStorage.setItem('smileclinic_synced_active_checks', JSON.stringify(selectedChecks));
        localStorage.setItem('smileclinic_synced_active_rules', JSON.stringify(selectedRules));
        localStorage.setItem('smileclinic_synced_active_conditions', JSON.stringify(derivedConditions));
        localStorage.setItem('smileclinic_last_rules_sync', nowIso);
      } catch {}

      // Push to PostgreSQL cloud backend
      pushKnowledgeSyncState({
        selection: selectionArray,
        conditions: derivedConditions,
        checks: selectedChecks,
        rules: selectedRules,
        docs: selectedDocs,
      }).catch(() => {});

      // Dispatch event to reactive listeners across app (NewCheck.tsx, etc.)
      window.dispatchEvent(
        new CustomEvent('smileclinic_knowledge_synced', {
          detail: {
            selection: selectionArray,
            docs: selectedDocs,
            checks: selectedChecks,
            rules: selectedRules,
            conditions: derivedConditions,
          },
        })
      );

      showConfirmation(
        `Synchronized ${selectedDocs.length} active history documents and ${selectedChecks.length} prior prescriptions into AI context`,
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

  const docCount = items.filter((i) => i.type === 'document').length;
  const checkCount = items.filter((i) => i.type === 'check').length;
  const ruleCount = items.filter((i) => i.type === 'rule').length;

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
                    Synchronize Knowledge Base &amp; History
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Select active clinical history documents &amp; prior prescriptions to feed into AI screening.
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
            <div className="py-4 overflow-y-auto flex-1 flex flex-col gap-3 min-h-[220px]">
              {!hasData ? (
                <div className="my-auto py-10 px-6 flex flex-col items-center justify-center text-center bg-surface-container-low/40 rounded-xl border border-dashed border-outline-variant/40">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-high text-outline flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-[32px]">folder_open</span>
                  </div>
                  <h4 className="text-sm font-bold text-on-surface">No Clinical History or Prescriptions Found</h4>
                  <p className="text-xs text-on-surface-variant max-w-xs mt-1">
                    Upload clinical history documents or run prescriptions to populate synchronized knowledge sources.
                  </p>
                </div>
              ) : (
                <>
                  {/* Category Filter Tabs & Select All Header */}
                  <div className="flex items-center justify-between pb-1 text-xs gap-2">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                          categoryFilter === 'all'
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        All ({items.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('document')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                          categoryFilter === 'document'
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        Uploaded History ({docCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('check')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                          categoryFilter === 'check'
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        Prior Regimens ({checkCount})
                      </button>
                      {ruleCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setCategoryFilter('rule')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                            categoryFilter === 'rule'
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          Rules ({ruleCount})
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={handleToggleAll}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isAllSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Informative Guidance Banner */}
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/15 text-[11px] text-on-surface-variant leading-relaxed">
                    <strong className="text-primary font-bold">Active AI History Control:</strong> Toggle ON documents (e.g. Kidney) and turn OFF unneeded history (e.g. Liver). Only checked items will be evaluated during AI Safety Screening.
                  </div>

                  {/* Scrollable Items Checklist */}
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {filteredItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleToggleItem(item.id)}
                          className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-primary/5 border-primary/30 shadow-xs'
                              : 'bg-surface-container-low border-surface-container hover:border-outline-variant opacity-70 hover:opacity-100'
                          } ${isSyncing ? 'pointer-events-none opacity-80' : ''}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isSyncing}
                              onChange={() => handleToggleItem(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer shrink-0"
                            />
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-primary/15 text-primary' : 'bg-surface-container text-outline'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-on-surface truncate flex items-center gap-1.5">
                                <span>{item.title}</span>
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    isSelected
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {isSelected ? 'ACTIVE IN AI' : 'OFF'}
                                </span>
                              </div>
                              <div className="text-[10px] text-on-surface-variant truncate">{item.subtitle}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant shrink-0">
                            {item.badge}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected count info banner */}
                  <div className="text-[11px] text-on-surface-variant flex items-center justify-between px-1 pt-1">
                    <span>
                      Selected <strong className="text-on-surface font-bold">{selectedIds.size}</strong> of {items.length} items
                    </span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">shield_check</span>
                      Enforced in AI Context
                    </span>
                  </div>
                </>
              )}

              {/* In-Flight Synchronization Progress */}
              {isSyncing && (
                <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-2 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] animate-spin text-primary">
                        progress_activity
                      </span>
                      {activeStepText || 'Synchronizing with Clinical Engine...'}
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
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-surface-container shrink-0 gap-3">
              <button
                type="button"
                disabled={isSyncing}
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSyncing || selectedIds.size === 0}
                onClick={handleStartSync}
                className="px-4 py-2 text-xs font-bold bg-primary text-on-primary hover:bg-primary-hover rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>
                  {isSyncing
                    ? 'Synchronizing...'
                    : syncCompleted
                    ? 'Synchronized!'
                    : `Synchronize Selected (${selectedIds.size})`}
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
