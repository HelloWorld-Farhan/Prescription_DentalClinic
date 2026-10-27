import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualDb } from '../services/prescriptionService';
import { InteractionRule, AlertSeverity } from '../types';
import SyncKnowledgeModal from '../components/SyncKnowledgeModal';
import CustomDropdown from '../components/CustomDropdown';
import CameraCaptureModal from '../components/CameraCaptureModal';
import {
  uploadToR2,
  getDocumentHistory,
  saveDocumentRecord,
  updateDocumentExtractedCount,
  deleteDocumentRecord,
  UploadedDocumentRecord,
} from '../services/storageService';
import { extractPrescriptionData } from '../services/prescriptionExtractor';

interface DraftRuleItem {
  id: string;
  drugA: string;
  drugB: string;
  category: 'Drug-Drug' | 'Drug-Allergy' | 'Drug-Condition' | 'Renal Dose Adjustment';
  severity: AlertSeverity;
  description: string;
}

const emptyDraftRule = (): DraftRuleItem => ({
  id: 'draft-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
  drugA: '',
  drugB: '',
  category: 'Drug-Drug',
  severity: 'contraindicated',
  description: '',
});

export default function RulesAdmin() {
  // Read active logged-in user profile
  let storedUser: any = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('smileclinic_auth_user');
      if (raw) storedUser = JSON.parse(raw);
    } catch {
      storedUser = null;
    }
  }
  const currentUserId = storedUser?.id || storedUser?.email || 'user-current';
  const currentClinicianName = storedUser?.fullName || 'Authorized Clinician';

  const [activeTab, setActiveTab] = useState<'rules' | 'history' | 'knowledge' | 'regression'>('rules');
  const [rules, setRules] = useState<InteractionRule[]>(() => VirtualDb.getRules(currentUserId));
  const [documentHistory, setDocumentHistory] = useState<UploadedDocumentRecord[]>(() =>
    getDocumentHistory(currentUserId)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [inspectRule, setInspectRule] = useState<InteractionRule | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Deletion Modal States
  const [docToDelete, setDocToDelete] = useState<UploadedDocumentRecord | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<InteractionRule | null>(null);

  // Add Rule Multi-Modal Wizard States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState<'select' | 'upload' | 'preview' | 'manual'>('select');
  const [uploadFormat, setUploadFormat] = useState<'pdf' | 'csv' | 'word' | 'image'>('pdf');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadSource, setUploadSource] = useState<'file' | 'camera'>('file');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [draftRules, setDraftRules] = useState<DraftRuleItem[]>([emptyDraftRule()]);
  const [manualFormError, setManualFormError] = useState<string | null>(null);
  const [extractedPreviewRules, setExtractedPreviewRules] = useState<InteractionRule[]>([]);
  const [extractedFileMeta, setExtractedFileMeta] = useState<{
    filename: string;
    filesize: string;
    extractedAt: string;
    storageUrl: string;
    format: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lock body scroll and handle Escape key for active modals
  useEffect(() => {
    if (!isAddModalOpen && !inspectRule && !isCameraModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCameraModalOpen) setIsCameraModalOpen(false);
        else if (inspectRule) setInspectRule(null);
        else if (isAddModalOpen) setIsAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddModalOpen, inspectRule, isCameraModalOpen]);

  const handleOpenAddModal = () => {
    setAddModalMode('select');
    setUploadFormat('pdf');
    setUploadedFile(null);
    setUploadSource('file');
    setIsExtracting(false);
    setManualFormError(null);
    setDraftRules([emptyDraftRule()]);
    setExtractedPreviewRules([]);
    setExtractedFileMeta(null);
    setIsAddModalOpen(true);
  };

  const handleCameraCapture = (file: File) => {
    setUploadedFile(file);
    setUploadSource('camera');
    setUploadFormat('image');
  };

  const handleDraftChange = (id: string, field: keyof DraftRuleItem, value: any) => {
    setDraftRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
    setManualFormError(null);
  };

  const handleAddDraftRow = () => {
    setDraftRules((prev) => [...prev, emptyDraftRule()]);
  };

  const handleRemoveDraftRow = (id: string) => {
    if (draftRules.length <= 1) return;
    setDraftRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSaveManualRules = (e: React.FormEvent) => {
    e.preventDefault();
    for (let i = 0; i < draftRules.length; i++) {
      const r = draftRules[i];
      if (!r.drugA.trim() || !r.drugB.trim() || !r.description.trim()) {
        setManualFormError(`Please complete all required fields for Rule #${i + 1}.`);
        return;
      }
    }

    const newRules: InteractionRule[] = draftRules.map((r, i) => ({
      id: 'rule-' + (Date.now() + i),
      drugA: r.drugA.trim(),
      drugB: r.drugB.trim(),
      category: r.category,
      severity: r.severity,
      description: r.description.trim(),
      active: true,
      userId: currentUserId,
      authorName: currentClinicianName,
      createdAt: new Date().toLocaleString(),
      sourceFile: 'Manual Clinical Entry',
    }));

    const updated = VirtualDb.addRules(newRules);
    setRules([...updated]);

    saveDocumentRecord({
      id: 'manual-' + Date.now(),
      filename: `Manual Entry: ${newRules[0].drugA} + ${newRules[0].drugB}`,
      fileType: 'Manual Entry',
      fileSize: 0,
      uploadedAt: new Date().toLocaleString(),
      storageUrl: '',
      userId: currentUserId,
      authorName: currentClinicianName,
      extractedRulesCount: newRules.length,
      status: 'analyzed',
    });
    setDocumentHistory(getDocumentHistory(currentUserId));

    setIsAddModalOpen(false);
    setToastMessage(`Successfully saved ${newRules.length} clinical rule${newRules.length > 1 ? 's' : ''} to History & Data.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExtractFromDocument = async () => {
    if (!uploadedFile) return;
    setIsExtracting(true);

    try {
      // 1. Upload to Cloudflare R2 (handles duplicate names automatically)
      const r2Result = await uploadToR2(uploadedFile, currentUserId, currentClinicianName);

      // 2. Extract rules from content or format using universal prescription extractor
      const extractionResult = await extractPrescriptionData(
        uploadedFile,
        uploadSource === 'camera' ? 'camera' : 'upload'
      );

      const extracted: InteractionRule[] = extractionResult.rules.map((rule, idx) => ({
        ...rule,
        id: `rule-doc-${Date.now()}-${idx + 1}`,
        userId: currentUserId,
        authorName: currentClinicianName,
        createdAt: new Date().toLocaleString(),
        sourceFile: r2Result.filename,
        storageUrl: r2Result.url,
      }));

      setExtractedPreviewRules(extracted);
      setExtractedFileMeta({
        filename: r2Result.filename,
        filesize: (uploadedFile.size / 1024).toFixed(1) + ' KB',
        extractedAt: new Date().toLocaleString(),
        storageUrl: r2Result.url,
        format: uploadFormat.toUpperCase(),
      });

      // Switch to preview step
      setAddModalMode('preview');
    } catch (err: any) {
      console.error('Extraction error:', err);
      setToastMessage('Failed to extract document. Please check file format.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmPreviewRules = () => {
    if (extractedPreviewRules.length === 0) return;

    const updated = VirtualDb.addRules(extractedPreviewRules);
    setRules([...updated]);

    if (extractedFileMeta?.storageUrl) {
      updateDocumentExtractedCount(extractedFileMeta.storageUrl, extractedPreviewRules.length);
      setDocumentHistory(getDocumentHistory(currentUserId));
    }

    setIsAddModalOpen(false);
    setToastMessage(`Saved ${extractedPreviewRules.length} extracted rules to History & Data.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggle = (id: string) => {
    const updated = VirtualDb.toggleRule(id);
    setRules([...updated]);
    const target = updated.find(r => r.id === id);
    setToastMessage(`Rule ${id} is now ${target?.active ? 'ACTIVE' : 'DISABLED'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDelete = (id: string) => {
    const target = rules.find((r) => r.id === id);
    if (target) {
      setRuleToDelete(target);
    } else {
      const updated = VirtualDb.deleteRule(id);
      setRules([...updated]);
    }
  };

  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    setIsDeletingDoc(true);
    try {
      await deleteDocumentRecord(docToDelete.id, docToDelete.storageUrl);
      VirtualDb.deleteRulesBySource(docToDelete.filename);
      setRules(VirtualDb.getRules(currentUserId));
      setDocumentHistory(getDocumentHistory(currentUserId));
      setToastMessage(`Document "${docToDelete.filename}" and extracted rules vanished from database & R2.`);
      setTimeout(() => setToastMessage(null), 3500);
      setDocToDelete(null);
    } catch {
      setToastMessage('Failed to delete document from storage.');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleConfirmDeleteRule = () => {
    if (!ruleToDelete) return;
    const updated = VirtualDb.deleteRule(ruleToDelete.id);
    setRules([...updated]);
    setToastMessage(`Rule "${ruleToDelete.drugA} + ${ruleToDelete.drugB}" permanently removed.`);
    setTimeout(() => setToastMessage(null), 3000);
    setRuleToDelete(null);
  };

  const handleRunRegression = () => {
    setToastMessage('No test assertion data available. Please author or import clinical decision rules first.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredRules = rules.filter((r) => {
    const matchesCategory =
      categoryFilter === 'ALL' ||
      (categoryFilter === 'Interaction' && (r.category === 'Drug-Drug' || r.category.toLowerCase().includes('interaction'))) ||
      (categoryFilter === 'Allergy' && (r.category === 'Drug-Allergy' || r.category.toLowerCase().includes('allergy'))) ||
      (categoryFilter === 'Dose' && (r.category === 'Renal Dose Adjustment' || r.category.toLowerCase().includes('dose'))) ||
      (categoryFilter === 'Condition' && (r.category === 'Drug-Condition' || r.category.toLowerCase().includes('condition'))) ||
      (categoryFilter === 'Duplicate' && r.category.toLowerCase().includes('duplicate')) ||
      r.category.toLowerCase().includes(categoryFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && r.active) ||
      (statusFilter === 'INACTIVE' && !r.active);

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.drugA.toLowerCase().includes(q) ||
      r.drugB.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.severity.toLowerCase().includes(q);

    return matchesCategory && matchesStatus && matchesSearch;
  });

  // 5 items per page pagination for Tab 1 (Clinical History)
  const [rulesPage, setRulesPage] = useState(1);
  const rulesPageSize = 5;

  useEffect(() => {
    setRulesPage(1);
  }, [categoryFilter, statusFilter, searchQuery]);

  const totalRulesPages = Math.max(1, Math.ceil(filteredRules.length / rulesPageSize));
  const paginatedRules = useMemo(() => {
    return filteredRules.slice((rulesPage - 1) * rulesPageSize, rulesPage * rulesPageSize);
  }, [filteredRules, rulesPage, rulesPageSize]);

  // 5 items per page pagination for Tab 2 (Import & Upload History)
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 5;

  const totalHistoryPages = Math.max(1, Math.ceil(documentHistory.length / historyPageSize));
  const paginatedHistory = useMemo(() => {
    return documentHistory.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);
  }, [documentHistory, historyPage, historyPageSize]);

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto px-1 sm:px-2">
      {/* Top Page Header Section */}
      <div className="w-full flex flex-col gap-3 pb-2">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant font-medium">
          <div className="flex items-center gap-1.5">
            <span>Knowledge Governance</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">History &amp; Data Engine</span>
          </div>
          <div className="text-[11px] text-outline flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Clinician Scope: <strong>{currentClinicianName}</strong></span>
          </div>
        </div>

        {/* Main Header & Action Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                History &amp; Data Governance
              </h1>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high text-primary text-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">cloud_done</span>
                Cloudflare R2 Encrypted Storage • Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-4xl">
              Manage clinical decision rules, ingest multi-format documents (PDF, Word, Excel, Camera Scans) backed by Cloudflare R2 storage, and track per-user historical records.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-primary text-white hover:bg-primary-hover transition-all text-xs font-bold shadow-xs cursor-pointer hover:shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add New Rule / Import</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="group flex items-center gap-1.5 px-4 h-10 rounded-xl bg-primary-container text-on-primary hover:bg-primary transition-all text-xs font-bold shadow-xs cursor-pointer hover:shadow-md"
            >
              <span className="material-symbols-outlined text-[18px] transition-transform group-hover:rotate-180 duration-500">
                sync
              </span>
              <span>Sync Knowledge Bases</span>
            </button>
            {syncStatusText && (
              <span className="text-xs text-primary font-medium hidden lg:inline">
                {syncStatusText}
              </span>
            )}
          </div>
        </div>

        {/* Compliance Callout Strip */}
        <div className="w-full rounded-2xl bg-surface-container-low p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs border border-surface-container-high/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block">Cloudflare R2 Object Storage &amp; AST Engine</span>
              <span className="text-[11px] text-on-surface-variant">
                Uploaded PDF, Word, Excel, and Camera Scans are persisted to Cloudflare R2 bucket <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono text-[10px]">dental-clinic-records</code> and parsed into zero-drift clinical rules.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-700">Storage &amp; Engine: 100% Synced</span>
          </div>
        </div>
      </div>

      {/* Primary Interactive Tabs Navigation */}
      <div className="w-full border-b border-surface-container-high">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rules'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">rule_folder</span>
            <span>Clinical History</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
              {rules.length} active rules
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history_edu</span>
            <span>Import &amp; Upload History</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
              {documentHistory.length} records
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'knowledge'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
            <span>Knowledge Sources</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">
              0 active engines
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('regression')}
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'regression'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">checklist_rtl</span>
            <span>Test Suite &amp; Regression</span>
            <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">
              0 assertions
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: RULES CONTENT */}
      {activeTab === 'rules' && (
        <div className="flex flex-col w-full gap-4">
          {/* Filter Bar Card */}
          <div className="rounded-2xl bg-surface-container-lowest p-4 shadow-xs border border-surface-container-high/60 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[280px]">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Rule ID, clinical mechanism, drug or condition..."
                className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface cursor-pointer p-0.5 rounded-md"
                  title="Clear search"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CustomDropdown
                value={categoryFilter}
                onChange={setCategoryFilter}
                prefixIcon="category"
                menuWidth="w-60"
                options={[
                  { value: 'ALL', label: 'Check Type: All Categories', icon: 'category' },
                  { value: 'Interaction', label: 'Drug-Drug Interaction', icon: 'sync_alt' },
                  { value: 'Allergy', label: 'Allergy Conflict', icon: 'crisis_alert' },
                  { value: 'Dose', label: 'Dose & Frequency', icon: 'medication' },
                  { value: 'Condition', label: 'Drug-Condition Conflict', icon: 'stethoscope' },
                  { value: 'Duplicate', label: 'Duplicate Therapy', icon: 'content_copy' },
                ]}
              />

              <CustomDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                prefixIcon="toggle_on"
                align="right"
                menuWidth="w-52"
                options={[
                  { value: 'ALL', label: 'State: All Rules', icon: 'tune' },
                  { value: 'ACTIVE', label: 'Active Only', icon: 'check_circle', badge: 'Active', badgeColor: 'bg-emerald-100 text-emerald-800' },
                  { value: 'INACTIVE', label: 'Inactive / Staged', icon: 'pause_circle', badge: 'Staged', badgeColor: 'bg-slate-200 text-slate-700' },
                ]}
              />

              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  setToastMessage('Filters cleared: Showing all rules');
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                className={`p-2.5 h-10 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                  searchQuery !== '' || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? 'bg-primary/10 border-primary text-primary hover:bg-primary/20 shadow-xs'
                    : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
                title={searchQuery !== '' || categoryFilter !== 'ALL' || statusFilter !== 'ALL' ? 'Reset active filters' : 'Clear filters'}
                aria-label="Reset filters"
              >
                <span className="material-symbols-outlined text-[19px]">filter_alt_off</span>
              </motion.button>
            </div>
          </div>

          {/* Rules Table */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-outline uppercase tracking-wider font-semibold border-b border-surface-container">
                    <th className="py-3 px-4">Rule Target &amp; Mechanism</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Default Severity</th>
                    <th className="py-3 px-4">Evidence Level</th>
                    <th className="py-3 px-4">Active State</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
                          <span className="material-symbols-outlined text-4xl text-outline">policy</span>
                          <span className="font-bold text-sm text-on-surface">0 Clinical Decision Rules Installed</span>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            {rules.length === 0
                              ? "The environment starts clean with 0 rules. Click 'Sync Clinical Knowledge' to pull authorized pharmacopeia monographs or author new clinical logic."
                              : "No rules match the current category or status filter."}
                          </p>
                          {rules.length === 0 && (
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={handleOpenAddModal}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-primary-hover"
                              >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                <span>Add New Rule</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsSyncModalOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-container text-on-primary text-xs font-bold shadow-xs cursor-pointer hover:bg-primary"
                              >
                                <span className="material-symbols-outlined text-[16px]">sync</span>
                                <span>Sync Knowledge Base</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRules.map((rule) => {
                    const isContra = rule.severity === 'contraindicated';
                    return (
                      <tr key={rule.id} className="hover:bg-surface-container-low/50 transition-colors">
                        <td className="py-3.5 px-4 max-w-md">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-primary font-mono text-[11px] bg-primary/10 px-2 py-0.5 rounded">
                              {rule.drugA}
                            </span>
                            <span className="material-symbols-outlined text-outline text-[14px]">sync_alt</span>
                            <span className="font-bold text-primary font-mono text-[11px] bg-primary/10 px-2 py-0.5 rounded">
                              {rule.drugB}
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant line-clamp-2">
                            {rule.description}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-on-surface-variant">
                          {rule.category}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              isContra
                                ? 'bg-[#FFDAD6] text-[#BA1A1A]'
                                : 'bg-[#FEF3C7] text-[#975A16]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              {isContra ? 'dangerous' : 'warning'}
                            </span>
                            {rule.severity}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          Level 1 - FDB Core
                        </td>

                        <td className="py-3.5 px-4">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.active}
                              onChange={() => handleToggle(rule.id)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-container"></div>
                          </label>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectRule(rule)}
                              className="px-2.5 py-1 rounded-lg text-secondary bg-surface-container hover:bg-surface-container-high transition-colors text-[11px] font-bold border border-surface-container-high shadow-2xs cursor-pointer flex items-center gap-1"
                              title="Inspect Compiled AST Logic"
                            >
                              <span className="material-symbols-outlined text-[13px] text-primary">data_object</span>
                              <span>Inspect AST</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggle(rule.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                rule.active
                                  ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {rule.active ? 'Disable' : 'Enable'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(rule.id)}
                              className="p-1 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Rule"
                              aria-label="Delete rule"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>

            {/* 5 Items per Page Pagination Bar for Clinical History */}
            {filteredRules.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-surface-container-high bg-surface-container-lowest gap-3">
                <span className="text-xs text-on-surface-variant font-medium">
                  Showing <strong className="text-on-surface font-semibold">{(rulesPage - 1) * rulesPageSize + 1}</strong>–<strong className="text-on-surface font-semibold">{Math.min(rulesPage * rulesPageSize, filteredRules.length)}</strong> of <strong className="text-on-surface font-semibold">{filteredRules.length}</strong> clinical history rules
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={rulesPage <= 1}
                    onClick={() => setRulesPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Previous</span>
                  </button>

                  <span className="text-xs font-bold text-outline px-2">
                    Page {rulesPage} of {totalRulesPages}
                  </span>

                  <button
                    type="button"
                    disabled={rulesPage >= totalRulesPages}
                    onClick={() => setRulesPage((p) => Math.min(totalRulesPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: IMPORT & UPLOAD HISTORY */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-5">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">upload_file</span>
              </div>
              <div>
                <span className="text-lg font-bold text-on-surface block leading-tight">{documentHistory.length}</span>
                <span className="text-xs text-outline">Documents &amp; Camera Scans Ingested</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">cloud_done</span>
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 block leading-tight">Cloudflare R2 Bucket</span>
                <span className="text-[11px] text-outline font-mono">dental-clinic-records (APAC)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">account_circle</span>
              </div>
              <div>
                <span className="text-xs font-bold text-on-surface block leading-tight truncate">{currentClinicianName}</span>
                <span className="text-[11px] text-outline">Active Clinician Scope</span>
              </div>
            </div>
          </div>

          {/* History Documents List */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high/60 overflow-hidden">
            <div className="p-4 border-b border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-on-surface">Clinical Document Ingestion &amp; Storage Audit</h3>
                <p className="text-xs text-on-surface-variant">
                  Chronological records of PDF, Word, Excel, and Camera Scans persisted to Cloudflare R2 object storage.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:bg-primary-hover transition-colors cursor-pointer self-start sm:self-center"
              >
                <span className="material-symbols-outlined text-[16px]">add_a_photo</span>
                <span>Upload or Scan Document</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-outline uppercase tracking-wider font-semibold border-b border-surface-container">
                    <th className="py-3 px-4">Document / Source</th>
                    <th className="py-3 px-4">Format / Type</th>
                    <th className="py-3 px-4">Uploaded By</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Extracted Rules</th>
                    <th className="py-3 px-4">R2 Cloud Storage</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {documentHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-on-surface-variant">
                          <span className="material-symbols-outlined text-4xl text-outline">history_edu</span>
                          <span className="font-bold text-sm text-on-surface">0 Ingested Records in History</span>
                          <p className="text-xs text-on-surface-variant leading-relaxed">
                            Upload a clinical PDF, Word document, Excel spreadsheet, or take a photo with your mobile or laptop camera to build your historical repository.
                          </p>
                          <button
                            type="button"
                            onClick={handleOpenAddModal}
                            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-primary-hover"
                          >
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            <span>Upload First Document</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedHistory.map((doc) => {
                      const isCamera = doc.filename.toLowerCase().includes('camera') || doc.fileType.includes('camera');
                      const isManual = doc.fileType === 'Manual Entry';
                      const isPdf = doc.filename.toLowerCase().endsWith('.pdf');
                      const isWord = doc.filename.toLowerCase().includes('.doc');
                      const isCsv = doc.filename.toLowerCase().includes('.csv') || doc.filename.toLowerCase().includes('.xls');

                      return (
                        <tr key={doc.id} className="hover:bg-surface-container-low/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px]">
                                  {isCamera ? 'photo_camera' : isManual ? 'edit_note' : isPdf ? 'picture_as_pdf' : isWord ? 'description' : isCsv ? 'table_chart' : 'image'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-xs text-on-surface block truncate max-w-xs">
                                  {doc.filename}
                                </span>
                                <span className="text-[10px] text-outline">
                                  {doc.fileSize > 0 ? `${(doc.fileSize / 1024).toFixed(1)} KB` : 'Direct Form Input'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface uppercase tracking-wide">
                              {isCamera ? 'Camera Scan' : isManual ? 'Manual Form' : isPdf ? 'PDF Protocol' : isWord ? 'Word Doc' : isCsv ? 'Spreadsheet' : 'Image Scan'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-medium text-xs text-on-surface">
                            {doc.authorName || currentClinicianName}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-on-surface-variant font-mono">
                            {doc.uploadedAt}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              <span className="material-symbols-outlined text-[13px]">check_circle</span>
                              <span>{doc.extractedRulesCount} rules</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {doc.storageUrl ? (
                              <a
                                href={doc.storageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary/10 text-primary transition-colors text-[11px] font-bold border border-surface-container-high"
                                title="Open in Cloudflare R2"
                              >
                                <span className="material-symbols-outlined text-[14px]">cloud_download</span>
                                <span>Cloudflare R2</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-outline italic">Form Stored</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setDocToDelete(doc)}
                              className="p-1.5 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Document & Vanish from R2"
                              aria-label="Delete document"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 5 Items per Page Pagination Bar for Ingested Documents */}
            {documentHistory.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-surface-container-high bg-surface-container-lowest gap-3">
                <span className="text-xs text-on-surface-variant font-medium">
                  Showing <strong className="text-on-surface font-semibold">{(historyPage - 1) * historyPageSize + 1}</strong>–<strong className="text-on-surface font-semibold">{Math.min(historyPage * historyPageSize, documentHistory.length)}</strong> of <strong className="text-on-surface font-semibold">{documentHistory.length}</strong> ingested records
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Previous</span>
                  </button>

                  <span className="text-xs font-bold text-outline px-2">
                    Page {historyPage} of {totalHistoryPages}
                  </span>

                  <button
                    type="button"
                    disabled={historyPage >= totalHistoryPages}
                    onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  >
                    <span>Next</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE SOURCES */}
      {activeTab === 'knowledge' && (
        <div className="p-12 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-surface-container text-outline flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-3xl">account_tree</span>
          </div>
          <h4 className="text-sm font-bold text-on-surface">0 Knowledge Sources Configured</h4>
          <p className="text-xs text-on-surface-variant max-w-md leading-relaxed">
            No external clinical pharmacopeias or knowledge source engines are currently configured. Connect clinical knowledge feeds or author custom rules.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-primary-hover"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Add Clinical Rule</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-container text-on-primary text-xs font-bold shadow-xs cursor-pointer hover:bg-primary"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>Sync Knowledge Base</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: REGRESSION & TEST SUITE */}
      {activeTab === 'regression' && (
        <div className="flex flex-col w-full gap-4">
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-on-surface">Deterministic Test Suite Battery</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Evaluates critical golden test cases across renal clearance, drug-drug contraindications, and allergy cross-reactivity.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunRegression}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              <span>Run All Test Assertions</span>
            </button>
          </div>

          <div className="p-12 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-container text-outline flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-3xl">science</span>
            </div>
            <h4 className="text-sm font-bold text-on-surface">No Test Assertions Configured</h4>
            <p className="text-xs text-on-surface-variant max-w-md leading-relaxed">
              There are currently no deterministic test assertions configured or registered for this environment. Author or import clinical decision rules to establish assertion batteries.
            </p>
          </div>
        </div>
      )}

      {/* Inspect Rule AST Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {inspectRule && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              {/* Animated Full-Screen Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setInspectRule(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 max-w-xl w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
              >
                {/* Modal Top Header */}
                <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">account_tree</span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-on-surface">Compiled Rule AST Inspector</h3>
                      <p className="text-[11px] text-on-surface-variant font-mono font-bold text-primary">
                        {inspectRule.id}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectRule(null)}
                    className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="py-4 overflow-y-auto flex-1 space-y-3.5 text-xs pr-1">
                  <div>
                    <span className="text-outline font-semibold block mb-1">Target Interactions:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-primary/10 text-primary font-bold px-2 py-0.5 rounded">
                        {inspectRule.drugA}
                      </span>
                      <span className="material-symbols-outlined text-outline text-[14px]">sync_alt</span>
                      <span className="font-mono bg-primary/10 text-primary font-bold px-2 py-0.5 rounded">
                        {inspectRule.drugB}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-outline font-semibold block mb-1">Deterministic AST Pattern:</span>
                    <div className="bg-slate-950 text-emerald-400 font-mono text-[11px] p-3 rounded-xl border border-slate-800 leading-relaxed overflow-x-auto">
                      {`IF candidate_prescription.matches("${inspectRule.drugA}")\n` +
                        `AND patient.active_medications.contains("${inspectRule.drugB}")\n` +
                        `THEN TRIGGER_CDS_ALERT(\n` +
                        `    severity = "${inspectRule.severity.toUpperCase()}",\n` +
                        `    category = "${inspectRule.category}",\n` +
                        `    mechanism = "Pharmacokinetic enzyme pathway interference",\n` +
                        `    evidence_grade = "Level 1 - FDB Core",\n` +
                        `    action_required = TRUE\n` +
                        `);`}
                    </div>
                  </div>

                  <div>
                    <span className="text-outline font-semibold block mb-1">Clinical Impact & Description:</span>
                    <p className="text-on-surface-variant bg-surface-container-low p-3 rounded-xl border border-surface-container leading-relaxed">
                      {inspectRule.description}
                    </p>
                  </div>
                </div>

                {/* Modal Bottom Actions */}
                <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setInspectRule(null)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Close Inspector
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleToggle(inspectRule.id);
                      setInspectRule({ ...inspectRule, active: !inspectRule.active });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      inspectRule.active
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {inspectRule.active ? 'check_circle' : 'pause_circle'}
                    </span>
                    <span>{inspectRule.active ? 'Active & Enforced' : 'Disabled / Staged'}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}



      {/* Add Rule Multi-Step Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              {/* Animated Full-Screen Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setIsAddModalOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 max-w-2xl w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
              >
              {/* Modal Top Header */}
              <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
                <div className="flex items-center gap-2.5">
                  {addModalMode !== 'select' && (
                    <button
                      type="button"
                      onClick={() => setAddModalMode('select')}
                      className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                      title="Back to method selection"
                    >
                      <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    </button>
                  )}
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">
                      {addModalMode === 'upload' ? 'upload_file' : addModalMode === 'preview' ? 'visibility' : addModalMode === 'manual' ? 'edit_note' : 'add_circle'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-on-surface">
                      {addModalMode === 'select'
                        ? 'Add Clinical Decision Rules'
                        : addModalMode === 'upload'
                        ? 'Upload Document to Import Rules'
                        : addModalMode === 'preview'
                        ? 'Extracted Clinical Rules Preview'
                        : 'Manual Clinical Rule Entry'}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant">
                      {addModalMode === 'select'
                        ? 'Choose your preferred ingestion method: upload documentation or manual entry.'
                        : addModalMode === 'upload'
                        ? 'Select document format, upload the file, and extract interaction rules.'
                        : addModalMode === 'preview'
                        ? 'Verify extracted drug pairs, clinical mechanisms, and Cloudflare R2 storage link.'
                        : 'Author single or multiple interaction rules directly with clinical formulas.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="py-4 overflow-y-auto flex-1 pr-1">
                {/* STEP 1: Method Selection */}
                {addModalMode === 'select' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                    {/* Method A: Document Upload */}
                    <button
                      type="button"
                      onClick={() => setAddModalMode('upload')}
                      className="p-5 rounded-2xl border-2 border-surface-container-high bg-surface-container-lowest hover:border-primary hover:bg-primary/5 transition-all text-left flex flex-col justify-between gap-4 group cursor-pointer shadow-xs hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[26px]">upload_file</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase">
                          Document Import
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                          Upload Clinical Document
                        </h4>
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                          Extract rules from PDF clinical protocols, CSV/Excel spreadsheets, Word files, or image scans.
                        </p>
                        <div className="flex items-center gap-1.5 mt-3 text-[11px] font-medium text-outline">
                          <span className="material-symbols-outlined text-[14px]">attach_file</span>
                          <span>PDF · CSV · Word · Image</span>
                        </div>
                      </div>
                    </button>

                    {/* Method B: Manual Entry */}
                    <button
                      type="button"
                      onClick={() => setAddModalMode('manual')}
                      className="p-5 rounded-2xl border-2 border-surface-container-high bg-surface-container-lowest hover:border-emerald-500 hover:bg-emerald-50/20 transition-all text-left flex flex-col justify-between gap-4 group cursor-pointer shadow-xs hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[26px]">edit_note</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          Single &amp; Multiple
                        </span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-on-surface group-hover:text-emerald-700 transition-colors">
                          Manual Rule Entry
                        </h4>
                        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                          Directly author single or multiple clinical decision rules with custom molecules, categories, and severity.
                        </p>
                        <div className="flex items-center gap-1.5 mt-3 text-[11px] font-medium text-outline">
                          <span className="material-symbols-outlined text-[14px]">format_list_bulleted</span>
                          <span>Batch authoring supported</span>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* STEP 2A: Upload Document */}
                {addModalMode === 'upload' && (
                  <div className="space-y-4">
                    {/* Format Tabs */}
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-2">
                        1. Select Document Format to Upload
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: 'image', label: 'Image Scan', exts: '.png, .jpg, .jpeg', icon: 'image' },
                          { id: 'pdf', label: 'PDF Document', exts: '.pdf', icon: 'picture_as_pdf' },
                          { id: 'csv', label: 'CSV / Excel', exts: '.csv, .xlsx', icon: 'table_chart' },
                          { id: 'word', label: 'Word Document', exts: '.docx, .doc', icon: 'description' },
                        ].map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() => {
                              setUploadFormat(fmt.id as any);
                              setUploadedFile(null);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                              uploadFormat === fmt.id
                                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                                : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[20px]">{fmt.icon}</span>
                            <span className="text-xs">{fmt.label}</span>
                            <span className="text-[10px] text-outline font-normal">{fmt.exts}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hidden Native File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept={
                        uploadFormat === 'image'
                          ? '.png,.jpg,.jpeg'
                          : uploadFormat === 'pdf'
                          ? '.pdf'
                          : uploadFormat === 'csv'
                          ? '.csv,.xlsx'
                          : '.docx,.doc'
                      }
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadedFile(e.target.files[0]);
                        }
                      }}
                    />

                    {/* Dropzone & Live Camera Area */}
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        2. Choose or Capture Document
                      </label>

                      {uploadFormat === 'image' && !uploadedFile && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                          <button
                            type="button"
                            onClick={() => setIsCameraModalOpen(true)}
                            className="p-3.5 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-left flex items-center gap-3 cursor-pointer group shadow-2xs"
                          >
                            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                            </div>
                            <div>
                              <span className="text-xs font-bold text-primary block group-hover:underline">Open Live Camera</span>
                              <span className="text-[10px] text-on-surface-variant">Phone &amp; laptop front/back scanner</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setUploadSource('file');
                              fileInputRef.current?.click();
                            }}
                            className="p-3.5 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container transition-all text-left flex items-center gap-3 cursor-pointer group shadow-2xs"
                          >
                            <div className="w-9 h-9 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[20px]">folder_open</span>
                            </div>
                            <div>
                              <span className="text-xs font-bold text-on-surface block group-hover:underline">Browse Image File</span>
                              <span className="text-[10px] text-outline">PNG, JPG, JPEG, WEBP</span>
                            </div>
                          </button>
                        </div>
                      )}

                      {!uploadedFile ? (
                        <div
                          onClick={() => {
                            setUploadSource('file');
                            fileInputRef.current?.click();
                          }}
                          className="border-2 border-dashed border-surface-container-high hover:border-primary rounded-2xl p-7 text-center cursor-pointer bg-surface-container-low/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2"
                        >
                          <div className="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-[26px]">cloud_upload</span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-on-surface">Click to browse or drag file here</span>
                            <p className="text-[11px] text-outline mt-0.5">
                              Accepts {uploadFormat.toUpperCase()} ({
                                uploadFormat === 'image'
                                  ? '.png, .jpg, .jpeg'
                                  : uploadFormat === 'pdf'
                                  ? '.pdf'
                                  : uploadFormat === 'csv'
                                  ? '.csv, .xlsx'
                                  : '.docx, .doc'
                              })
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[20px]">
                                {uploadSource === 'camera' ? 'photo_camera' : uploadFormat === 'image' ? 'image' : uploadFormat === 'pdf' ? 'picture_as_pdf' : uploadFormat === 'csv' ? 'table_chart' : 'description'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-on-surface truncate block">
                                  {uploadedFile.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary shrink-0">
                                  {uploadSource === 'camera' ? 'Camera Scan' : 'Uploaded File'}
                                </span>
                              </div>
                              <span className="text-[11px] text-outline">
                                {(uploadedFile.size / 1024).toFixed(1)} KB · Ready to save to Cloudflare R2 &amp; parse
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedFile(null);
                              setUploadSource('file');
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2B: Manual Entry (Single & Multiple supported) */}
                {addModalMode === 'manual' && (
                  <form id="manual-rules-form" onSubmit={handleSaveManualRules} className="space-y-4">
                    {manualFormError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">error</span>
                        <span>{manualFormError}</span>
                      </div>
                    )}

                    <div className="space-y-3.5">
                      {draftRules.map((draft, idx) => (
                        <div
                          key={draft.id}
                          className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high space-y-3 relative group"
                        >
                          <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-on-surface">Rule #{idx + 1}</span>
                            </div>
                            {draftRules.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftRow(draft.id)}
                                className="text-outline hover:text-rose-600 text-xs flex items-center gap-1 cursor-pointer"
                                title="Remove this rule row"
                              >
                                <span className="material-symbols-outlined text-[15px]">delete</span>
                                <span>Remove</span>
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-xs font-semibold text-on-surface mb-1">
                                Drug / Molecule A *
                              </label>
                              <input
                                type="text"
                                required
                                value={draft.drugA}
                                onChange={(e) => handleDraftChange(draft.id, 'drugA', e.target.value)}
                                placeholder="e.g. Warfarin"
                                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-on-surface mb-1">
                                Drug B / Condition *
                              </label>
                              <input
                                type="text"
                                required
                                value={draft.drugB}
                                onChange={(e) => handleDraftChange(draft.id, 'drugB', e.target.value)}
                                placeholder="e.g. Ibuprofen"
                                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-xs font-semibold text-on-surface mb-1">
                                Category
                              </label>
                              <select
                                value={draft.category}
                                onChange={(e) => handleDraftChange(draft.id, 'category', e.target.value as any)}
                                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
                              >
                                <option value="Drug-Drug">Drug-Drug</option>
                                <option value="Drug-Allergy">Drug-Allergy</option>
                                <option value="Drug-Condition">Drug-Condition</option>
                                <option value="Renal Dose Adjustment">Renal Dose Adjustment</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-on-surface mb-1">
                                Severity Level
                              </label>
                              <select
                                value={draft.severity}
                                onChange={(e) => handleDraftChange(draft.id, 'severity', e.target.value as AlertSeverity)}
                                className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary cursor-pointer"
                              >
                                <option value="contraindicated">Contraindicated</option>
                                <option value="major">Major</option>
                                <option value="moderate">Moderate</option>
                                <option value="minor">Minor</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-on-surface mb-1">
                              Clinical Warning &amp; Mechanism *
                            </label>
                            <textarea
                              required
                              rows={2}
                              value={draft.description}
                              onChange={(e) => handleDraftChange(draft.id, 'description', e.target.value)}
                              placeholder="Enter mechanism of interaction and recommended clinical action..."
                              className="w-full px-3 py-2 bg-surface-container-lowest rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddDraftRow}
                      className="w-full py-2.5 rounded-xl border-2 border-dashed border-surface-container-high hover:border-primary text-primary hover:bg-primary/5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Add Another Rule to Batch</span>
                    </button>
                  </form>
                )}
                {/* STEP 2C: Extraction Preview & Verification */}
                {addModalMode === 'preview' && (
                  <div className="space-y-4">
                    {/* Cloudflare R2 Storage Confirmation Card */}
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <span className="material-symbols-outlined text-[24px]">cloud_done</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-emerald-950 truncate max-w-xs block">
                              {extractedFileMeta?.filename}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/80 text-emerald-900 shrink-0">
                              Cloudflare R2 Stored
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800 mt-0.5 font-medium">
                            {extractedFileMeta?.filesize} · Extracted {extractedFileMeta?.extractedAt}
                          </p>
                        </div>
                      </div>

                      {extractedFileMeta?.storageUrl && (
                        <a
                          href={extractedFileMeta.storageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-[11px] font-bold hover:bg-emerald-50 transition-colors shadow-2xs self-start sm:self-center shrink-0"
                          title="Open original file from Cloudflare R2 bucket"
                        >
                          <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                          <span>View in Cloudflare R2</span>
                        </a>
                      )}
                    </div>

                    {/* Section Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                          <span>Extracted Clinical Rules ({extractedPreviewRules.length})</span>
                        </h4>
                        <p className="text-[11px] text-on-surface-variant">
                          Verified against active user scope. Confirm to install these rules into your decision engine.
                        </p>
                      </div>
                    </div>

                    {/* Rules List / Cards */}
                    <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {extractedPreviewRules.map((r, idx) => (
                        <div
                          key={r.id || idx}
                          className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 font-bold text-xs text-on-surface">
                              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px]">
                                {r.drugA}
                              </span>
                              <span className="text-outline text-xs">+</span>
                              <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-[11px]">
                                {r.drugB}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                r.severity === 'contraindicated'
                                  ? 'bg-rose-100 text-rose-800'
                                  : r.severity === 'major'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {r.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant leading-relaxed">
                            {r.description}
                          </p>
                          <div className="text-[10px] text-outline flex items-center gap-2 pt-1 border-t border-surface-container-high/40">
                            <span>Category: <strong>{r.category}</strong></span>
                            <span>•</span>
                            <span>Scope: <strong>{currentClinicianName}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Bottom Actions */}
              <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                {addModalMode !== 'preview' && (
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                )}

                {addModalMode === 'select' && (
                  <span className="text-[11px] text-on-surface-variant font-medium">
                    Choose an ingestion method above to proceed
                  </span>
                )}

                {addModalMode === 'upload' && (
                  <button
                    type="button"
                    disabled={!uploadedFile || isExtracting}
                    onClick={handleExtractFromDocument}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      uploadedFile && !isExtracting
                        ? 'bg-primary hover:bg-primary-hover text-white shadow-xs'
                        : 'bg-outline/20 text-on-surface/40 cursor-not-allowed'
                    }`}
                  >
                    {isExtracting ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                        <span>Saving to R2 &amp; Extracting...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">document_scanner</span>
                        <span>Extract &amp; Preview Rules</span>
                      </>
                    )}
                  </button>
                )}

                {addModalMode === 'preview' && (
                  <div className="flex items-center justify-between w-full">
                    <button
                      type="button"
                      onClick={() => setAddModalMode('upload')}
                      className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                    >
                      Back to Upload
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmPreviewRules}
                      className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      <span>Confirm &amp; Save All {extractedPreviewRules.length} Rules</span>
                    </button>
                  </div>
                )}

                {addModalMode === 'manual' && (
                  <button
                    type="submit"
                    form="manual-rules-form"
                    className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Save {draftRules.length > 1 ? `All ${draftRules.length} Rules` : 'Rule'}</span>
                  </button>
                )}
              </div>
            </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Live Camera Viewfinder Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />

      {/* Sync Knowledge Modal */}
      <SyncKnowledgeModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={() => {
          setSyncStatusText('Knowledge feeds synchronized just now');
          setToastMessage('Knowledge Base Feeds Synchronized & Verified');
          setTimeout(() => setToastMessage(null), 3000);
        }}
      />

      {/* ========================================================================= */}
      {/* THEMED CONFIRMATION MODAL 1: DELETE DOCUMENT RECORD & R2 VANISH */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {docToDelete && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={isDeletingDoc ? undefined : () => setDocToDelete(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col gap-4 z-10"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">delete_sweep</span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-on-surface leading-tight">
                        Delete Document &amp; Vanish Data?
                      </h3>
                      <p className="text-[11px] text-outline mt-0.5">
                        Permanent purge from Cloudflare R2 and database.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isDeletingDoc}
                    onClick={() => setDocToDelete(null)}
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Details Box */}
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-outline">File Name:</span>
                    <span className="font-bold text-on-surface truncate max-w-[220px]" title={docToDelete.filename}>
                      {docToDelete.filename}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-outline">File Size:</span>
                    <span className="font-mono text-on-surface">
                      {docToDelete.fileSize > 0 ? `${(docToDelete.fileSize / 1024).toFixed(1)} KB` : 'Direct Form'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-outline">Extracted Rules:</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200/60">
                      {docToDelete.extractedRulesCount} rules associated
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-outline">Cloud Storage:</span>
                    <span className="text-[11px] font-mono text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">cloud</span>
                      <span>Cloudflare R2 Bucket</span>
                    </span>
                  </div>
                </div>

                {/* Warning Banner */}
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 leading-relaxed">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">warning</span>
                  <span>
                    This action will permanently delete this image/document from Cloudflare R2 object storage, delete its audit ledger entry, and cascade-remove all {docToDelete.extractedRulesCount} extracted rules from the active decision matrix.
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-container">
                  <button
                    type="button"
                    disabled={isDeletingDoc}
                    onClick={() => setDocToDelete(null)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingDoc}
                    onClick={handleConfirmDeleteDoc}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isDeletingDoc ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Vanishing...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                        <span>Confirm &amp; Vanish</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* THEMED CONFIRMATION MODAL 2: DELETE CLINICAL RULE */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {ruleToDelete && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setRuleToDelete(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col gap-4 z-10"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/70 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">delete</span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-on-surface leading-tight">
                        Delete Clinical Rule?
                      </h3>
                      <p className="text-[11px] text-outline mt-0.5">
                        Permanent removal from the active decision matrix.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRuleToDelete(null)}
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Details */}
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high/60 space-y-1.5">
                  <div className="text-xs font-bold text-on-surface">
                    {ruleToDelete.drugA} + {ruleToDelete.drugB}
                  </div>
                  <div className="text-[11px] text-on-surface-variant leading-relaxed">
                    {ruleToDelete.description}
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[10px] text-outline">
                    <span>Severity: <strong className="text-on-surface uppercase">{ruleToDelete.severity}</strong></span>
                    <span>•</span>
                    <span>Category: <strong className="text-on-surface">{ruleToDelete.category}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-container">
                  <button
                    type="button"
                    onClick={() => setRuleToDelete(null)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteRule}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Delete Rule</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-emerald-500 backdrop-blur-md"
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-200">verified</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
