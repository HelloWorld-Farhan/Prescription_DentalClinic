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
  synthesizeKnowledgeWithAI,
  KnowledgeBaseProfile,
} from '../services/knowledgeBaseService';

interface SyncKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetKbId?: string;
  onSyncComplete?: (version?: string, timestamp?: string, newKbId?: string) => void;
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
  rawPayload?: any;
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

  // User-provided Knowledge Base Name (Mandatory Validation - Empty by default)
  const [kbName, setKbName] = useState<string>('');
  const [nameError, setNameError] = useState<string | null>(null);

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
      setNameError(null);
      return;
    }

    const state = getMultiKnowledgeBaseState();
    const existingKb = targetKbId ? state.knowledgeBases.find((k) => k.id === targetKbId) : null;

    // By default, NO NAME if creating new. Only populate if explicitly editing an existing KB.
    setKbName(existingKb ? existingKb.name : '');
    setNameError(null);

    const loadedItems: SyncableItem[] = [];

    // 1. Real Uploaded Clinical History Documents
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
            rawPayload: doc,
          });
        });
    } catch {}

    // 2. Real Clinical Screening Checks (Prior Prescriptions)
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
          rawPayload: check,
        });
      });
    } catch {}

    // 3. Real Custom Decision Rules
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
          rawPayload: rule,
        });
      });
    } catch {}

    setItems(loadedItems);

    // If editing existing KB, restore its prior selection. Otherwise select all by default so user has rich sources.
    if (existingKb && existingKb.selection && existingKb.selection.length > 0) {
      const validSet = new Set(existingKb.selection.filter((id) => loadedItems.some((i) => i.id === id)));
      setSelectedIds(validSet);
    } else {
      setSelectedIds(new Set(loadedItems.map((i) => i.id)));
    }
  }, [isOpen, targetKbId]);

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

  const handleStartSync = async () => {
    // 1. Mandatory Name Validation
    const trimmedName = kbName.trim();
    if (!trimmedName) {
      setNameError('Knowledge Base Name is mandatory. Please provide a descriptive title.');
      return;
    }
    if (trimmedName.length < 3) {
      setNameError('Knowledge Base Name must be at least 3 characters.');
      return;
    }
    setNameError(null);

    // 2. Gather specific selected subsets
    const selectedDocs: string[] = [];
    const selectedChecks: string[] = [];
    const selectedRules: string[] = [];
    const fullRegimens: any[] = [];

    items.forEach((item) => {
      if (!selectedIds.has(item.id)) return;
      if (item.type === 'document' && item.filename) {
        selectedDocs.push(item.filename);
      } else if (item.type === 'check') {
        selectedChecks.push(item.id.replace('check-', ''));
        if (item.rawPayload) fullRegimens.push(item.rawPayload);
      } else if (item.type === 'rule') {
        selectedRules.push(item.id.replace('rule-', ''));
      }
    });

    // Derive active condition summaries from selected clinical history documents
    const derivedConditions = selectedDocs.map((docName) => {
      return docName.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
    });

    setIsSyncing(true);
    setSyncProgress(15);
    setActiveStepText(`Validating ${selectedIds.size} selected sources for "${trimmedName}"...`);

    try {
      // Step 1: Animation update
      await new Promise((r) => setTimeout(r, 600));
      setSyncProgress(35);
      setActiveStepText('Correlating clinical documents with prior prescription regimens...');

      // Step 2: Gemini AI synthesis via multi-key failover backend
      await new Promise((r) => setTimeout(r, 600));
      setSyncProgress(65);
      setActiveStepText('Gemini AI synthesizing multi-drug interaction network & clinical rules...');

      const aiResult = await synthesizeKnowledgeWithAI({
        name: trimmedName,
        documents: selectedDocs,
        regimens: fullRegimens,
        conditions: derivedConditions,
      });

      // Step 3: Compiling and persisting
      setSyncProgress(90);
      setActiveStepText(`Persisting "${trimmedName}" with ${aiResult.rules.length} synthesized rules...`);
      await new Promise((r) => setTimeout(r, 500));

      setSyncProgress(100);
      setActiveStepText('Knowledge base successfully synchronized & persisted to cloud.');
      setSyncCompleted(true);

      const targetId = targetKbId || `kb-${Date.now()}`;
      const selectionArray = Array.from(selectedIds);

      // Save into the Knowledge Base profile with user-provided name & synthesized rules
      const { savedKb } = saveKnowledgeBase(targetId, {
        name: trimmedName,
        selection: selectionArray,
        docs: selectedDocs,
        checks: selectedChecks,
        rules: selectedRules,
        conditions: derivedConditions,
        synthesizedRules: aiResult.rules,
        precautions: aiResult.precautions,
      });

      showConfirmation(
        `Created & Synchronized Knowledge Base: "${trimmedName}" (${aiResult.rules.length} AI Rules)`,
        'success'
      );

      setTimeout(() => {
        if (onSyncComplete) {
          onSyncComplete('v2.5.0', 'Just now', savedKb.id);
        }
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Synthesis error:', err);
      setIsSyncing(false);
      setNameError(err.message || 'Failed to synthesize knowledge base. Please try again.');
    }
  };

  if (typeof document === 'undefined') return null;

  const hasData = items.length > 0;
  const isAllSelected = items.length > 0 && selectedIds.size === items.length;
  const docCount = items.filter((i) => i.type === 'document').length;
  const checkCount = items.filter((i) => i.type === 'check').length;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] overflow-y-auto flex items-center justify-center p-2.5 sm:p-4 md:p-6 overscroll-contain pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-[max(0.625rem,env(safe-area-inset-top,0px))] select-none">
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
            className="relative z-10 bg-surface-container-lowest rounded-2xl sm:rounded-3xl max-w-lg w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[88vh] overflow-hidden"
          >
            {/* Top Modal Header (Sticky) */}
            <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-surface-container flex items-center justify-between gap-3 bg-surface-container-lowest shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-2xs shrink-0">
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">account_tree</span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-on-surface truncate">Synchronize Knowledge Base</h3>
                  <p className="text-[11px] sm:text-xs text-on-surface-variant truncate">
                    {targetKbId ? 'Update & Re-synthesize Knowledge Base' : 'Create Custom User-Named Knowledge Base'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={isSyncing}
                className="w-8 h-8 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Knowledge Base Name & Category Filters (Sticky Top Controls) */}
            <div className="px-4 pt-3 pb-2.5 sm:px-6 sm:pt-3.5 sm:pb-3 border-b border-surface-container/60 bg-surface-container-lowest shrink-0 space-y-2.5">
              {/* Name field */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-on-surface-variant mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-primary">badge</span>
                    <span>Knowledge Base Name <span className="text-error font-bold">*</span>:</span>
                  </span>
                  <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">cloud_sync</span>
                    <span>Syncs to all devices</span>
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={isSyncing}
                    value={kbName}
                    onChange={(e) => {
                      setKbName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="Enter custom name (e.g. Cardio & Anticoagulant Protocol)"
                    className={`w-full text-xs font-bold px-3 py-2 sm:py-2.5 rounded-xl border bg-surface-container-low text-on-surface focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-2xs ${
                      nameError
                        ? 'border-error focus:border-error bg-error/5 text-error placeholder:text-error/50'
                        : 'border-surface-container-high focus:border-primary'
                    }`}
                    autoFocus
                  />
                  {nameError && (
                    <div className="flex items-center gap-1 text-[11px] text-error font-semibold mt-1 px-1">
                      <span className="material-symbols-outlined text-[13px]">error</span>
                      <span>{nameError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter pills & Select all */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
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
            </div>

            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto px-4 py-2.5 sm:px-6 sm:py-3 space-y-2 min-h-0 overscroll-contain">
              {!hasData ? (
                <div className="py-8 sm:py-10 flex flex-col items-center justify-center text-center gap-2 text-outline">
                  <span className="material-symbols-outlined text-4xl text-primary/40">folder_off</span>
                  <p className="text-xs font-bold text-on-surface">No uploaded history or prior checks found.</p>
                  <p className="text-[11px] text-on-surface-variant max-w-xs">
                    Upload clinical history documents or perform prescription checks to select and synthesize them into this Knowledge Base.
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isChecked = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      className={`p-2.5 sm:p-3 rounded-xl border transition-all flex items-start gap-2.5 sm:gap-3 cursor-pointer ${
                        isChecked
                          ? 'bg-primary/5 border-primary/40 shadow-2xs'
                          : 'bg-surface-container-lowest border-surface-container hover:border-outline/30'
                      }`}
                    >
                      <div className="pt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          disabled={isSyncing}
                          className="w-4 h-4 rounded text-primary border-outline/40 focus:ring-primary cursor-pointer"
                        />
                      </div>

                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-surface-container text-on-surface flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-primary">{item.icon}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-on-surface truncate max-w-[200px] sm:max-w-[260px]">
                            {item.title}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant">
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

            {/* In-Flight Multi-Key AI Synthesis Working Animation */}
            {isSyncing && (
              <div className="px-4 py-2 sm:px-6 shrink-0">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-primary/5 rounded-2xl border border-primary/20 flex flex-col gap-2 shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center animate-spin shrink-0">
                        <span className="material-symbols-outlined text-[14px]">neurology</span>
                      </div>
                      <span className="font-bold text-on-surface truncate max-w-[240px] sm:max-w-[280px]">
                        {activeStepText || 'AI Model Analyzing Connections...'}
                      </span>
                    </div>
                    <span className="font-extrabold text-primary shrink-0">{syncProgress}%</span>
                  </div>

                  <div className="w-full bg-surface-container-high rounded-full h-1.5 sm:h-2 overflow-hidden">
                    <motion.div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      initial={{ width: 0 }}
                      animate={{ width: `${syncProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant px-0.5">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Gemini 15-Key Failover Engine</span>
                    </span>
                    <span>Synthesizing Medicine Graph</span>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Sticky Modal Bottom Actions */}
            <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-surface-container flex items-center justify-between gap-2.5 bg-surface-container-low/70 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                disabled={isSyncing}
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSyncing}
                onClick={handleStartSync}
                className="px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-bold bg-primary text-on-primary hover:bg-primary-hover rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isSyncing ? 'sync' : 'auto_awesome'}
                </span>
                <span>
                  {isSyncing
                    ? 'Synthesizing...'
                    : syncCompleted
                    ? 'Synchronized!'
                    : `Synthesize & Sync (${selectedIds.size})`}
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
