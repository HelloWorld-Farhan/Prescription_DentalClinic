import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualDb } from '../services/prescriptionService';
import { InteractionRule, AlertSeverity, PrescriptionItem } from '../types';
import SyncKnowledgeModal from '../components/SyncKnowledgeModal';
import { showConfirmation } from '../services/confirmation';
import CustomDropdown from '../components/CustomDropdown';
import CameraCaptureModal from '../components/CameraCaptureModal';
import OpticalScanOverlay from '../components/OpticalScanOverlay';
import MinimalExtractionOverlay from '../components/MinimalExtractionOverlay';
import {
  uploadToR2,
  getDocumentHistory,
  saveDocumentRecord,
  updateDocumentExtractedCount,
  deleteDocumentRecord,
  UploadedDocumentRecord,
} from '../services/storageService';
import { extractPrescriptionData, extractDocumentRules } from '../services/prescriptionExtractor';

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

function getRelativeSyncText(): string {
  if (typeof window === 'undefined') return 'Just now';
  try {
    const raw = localStorage.getItem('smileclinic_last_rules_sync');
    if (!raw) return 'Just now';
    const diff = Math.max(0, Date.now() - new Date(raw).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(raw).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return 'Just now';
  }
}

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

  const [activeTab, setActiveTab] = useState<'rules' | 'history' | 'knowledge'>('rules');
  const [rules, setRules] = useState<InteractionRule[]>(() => VirtualDb.getRules(currentUserId));
  const [documentHistory, setDocumentHistory] = useState<UploadedDocumentRecord[]>(() =>
    getDocumentHistory(currentUserId)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [lastSyncText, setLastSyncText] = useState<string>(() => getRelativeSyncText());
  const [inspectRule, setInspectRule] = useState<InteractionRule | null>(null);

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
  const [extractedPreviewMedicines, setExtractedPreviewMedicines] = useState<PrescriptionItem[]>([]);
  const [extractedFileMeta, setExtractedFileMeta] = useState<{
    filename: string;
    filesize: string;
    extractedAt: string;
    storageUrl: string;
    format: string;
  } | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isSavingStagedDoc, setIsSavingStagedDoc] = useState(false);
  const [inspectDocModal, setInspectDocModal] = useState<UploadedDocumentRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setUploadedFile(null);
    setImagePreviewUrl(null);
    setUploadSource('file');
    setIsExtracting(false);
    setIsSavingStagedDoc(false);
    setManualFormError(null);
    setDraftRules([emptyDraftRule()]);
    setExtractedPreviewRules([]);
    setExtractedPreviewMedicines([]);
    setExtractedFileMeta(null);
    setAddModalMode('select');
  };

  const handleBackToUpload = () => {
    setImagePreviewUrl(null);
    setExtractedFileMeta(null);
    setExtractedPreviewRules([]);
    setExtractedPreviewMedicines([]);
    setAddModalMode('upload');
  };

  // Real-time synchronization of rules and document history across tabs and components
  useEffect(() => {
    const handleSync = () => {
      setRules(VirtualDb.getRules(currentUserId));
      setDocumentHistory(getDocumentHistory(currentUserId));
    };
    window.addEventListener('smileclinic_rules_updated', handleSync);
    window.addEventListener('smileclinic_documents_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('smileclinic_rules_updated', handleSync);
      window.removeEventListener('smileclinic_documents_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [currentUserId]);

  // Lock body scroll and handle Escape key for active modals
  useEffect(() => {
    if (!isAddModalOpen && !inspectRule && !isCameraModalOpen && !inspectDocModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectDocModal) setInspectDocModal(null);
        else if (isCameraModalOpen) setIsCameraModalOpen(false);
        else if (inspectRule) setInspectRule(null);
        else if (isAddModalOpen) handleCloseAddModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddModalOpen, inspectRule, isCameraModalOpen, inspectDocModal, extractedFileMeta]);

  const handleOpenAddModal = () => {
    setAddModalMode('select');
    setUploadFormat('pdf');
    setUploadedFile(null);
    setImagePreviewUrl(null);
    setUploadSource('file');
    setIsExtracting(false);
    setManualFormError(null);
    setDraftRules([emptyDraftRule()]);
    setExtractedPreviewRules([]);
    setExtractedPreviewMedicines([]);
    setExtractedFileMeta(null);
    setIsAddModalOpen(true);
  };

  const handleCameraCapture = (file: File) => {
    setUploadedFile(file);
    setUploadSource('camera');
    setUploadFormat('image');
    setImagePreviewUrl(URL.createObjectURL(file));
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
    showConfirmation(`Successfully saved ${newRules.length} clinical rule${newRules.length > 1 ? 's' : ''} to History & Data.`, 'success');
  };

  const handleExtractFromDocument = async () => {
    if (!uploadedFile) return;
    setIsExtracting(true);

    try {
      const isImage =
        uploadFormat === 'image' ||
        uploadSource === 'camera' ||
        uploadedFile.type.startsWith('image/');

      if (isImage && !imagePreviewUrl) {
        setImagePreviewUrl(URL.createObjectURL(uploadedFile));
      }

      // 1. Extract rules and medications using PropNexAI Engine directly in-memory (DO NOT upload to R2 yet)
      const docResult = await extractDocumentRules(uploadedFile);
      let rulesToStage = docResult.rules;

      // If no explicit rules but medicines found, generate clinical pairing/clearance rules
      if (rulesToStage.length === 0 && docResult.medicines.length > 0) {
        rulesToStage = docResult.medicines.map((m, idx) => ({
          id: `rule-doc-${Date.now()}-${idx + 1}`,
          drugA: m.drugName,
          drugB: 'Renal / Hepatic Clearance Matrix',
          category: 'Renal Dose Adjustment' as const,
          severity: 'major' as const,
          description: `Clinical alert for ${m.drugName} (${m.dosage}): Titrate dosage when organ clearance is reduced; screen for cross-sensitivity.`,
          active: true,
          sourceFile: uploadedFile.name,
        }));
      }

      const extracted: InteractionRule[] = rulesToStage.map((rule, idx) => ({
        ...rule,
        id: `rule-doc-${Date.now()}-${idx + 1}`,
        userId: currentUserId,
        authorName: currentClinicianName,
        createdAt: new Date().toLocaleString(),
        sourceFile: uploadedFile.name,
      }));

      setExtractedPreviewMedicines(docResult.medicines);
      setExtractedPreviewRules(extracted);
      setExtractedFileMeta({
        filename: uploadedFile.name,
        filesize: (uploadedFile.size / 1024).toFixed(1) + ' KB',
        extractedAt: new Date().toLocaleString(),
        storageUrl: '', // Staged in memory - not committed to vault yet
        format: uploadFormat.toUpperCase(),
      });
    } catch (err: any) {
      console.error('Extraction error:', err);
      showConfirmation('Failed to extract document. Please check file format.', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmPreviewRules = async () => {
    if (extractedPreviewRules.length === 0 || !uploadedFile) return;
    setIsSavingStagedDoc(true);

    try {
      // 1. Permanently upload to Cloudflare R2 and save document record in vault
      const r2Result = await uploadToR2(uploadedFile, currentUserId, currentClinicianName);

      // 2. Finalize rules with verified R2 storageUrl and non-colliding filename
      const finalizedRules: InteractionRule[] = extractedPreviewRules.map((rule) => ({
        ...rule,
        sourceFile: r2Result.filename,
        storageUrl: r2Result.url,
      }));

      const updated = VirtualDb.addRules(finalizedRules);
      setRules([...updated]);

      // 3. Update extracted count and refresh Document History table
      updateDocumentExtractedCount(r2Result.url, finalizedRules.length);
      setDocumentHistory(getDocumentHistory(currentUserId));

      setIsAddModalOpen(false);
      setUploadedFile(null);
      setImagePreviewUrl(null);
      setExtractedPreviewRules([]);
      setExtractedPreviewMedicines([]);
      setExtractedFileMeta(null);
      setAddModalMode('select');

      showConfirmation(`Saved document to Secure Vault and imported ${finalizedRules.length} extracted rules.`, 'success');
    } catch (err) {
      console.error('Save error:', err);
      showConfirmation('Failed to save document to secure vault. Please try again.', 'error');
    } finally {
      setIsSavingStagedDoc(false);
    }
  };

  const handleToggle = (id: string) => {
    const updated = VirtualDb.toggleRule(id);
    setRules([...updated]);
    const target = updated.find(r => r.id === id);
    showConfirmation(`Rule ${id} is now ${target?.active ? 'ACTIVE' : 'DISABLED'}`, 'success');
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
      await Promise.all([
        deleteDocumentRecord(docToDelete.id, docToDelete.storageUrl),
        new Promise((resolve) => setTimeout(resolve, 850))
      ]);
      VirtualDb.deleteRulesBySource(docToDelete.filename);
      setRules(VirtualDb.getRules(currentUserId));
      setDocumentHistory(getDocumentHistory(currentUserId));
      showConfirmation(`Document "${docToDelete.filename}" and extracted rules vanished from database & secure vault.`, 'success');
      setDocToDelete(null);
    } catch {
      showConfirmation('Failed to delete document from storage.', 'error');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleConfirmDeleteRule = () => {
    if (!ruleToDelete) return;
    const updated = VirtualDb.deleteRule(ruleToDelete.id);
    setRules([...updated]);
    showConfirmation(`Rule "${ruleToDelete.drugA} + ${ruleToDelete.drugB}" permanently removed.`, 'success');
    setRuleToDelete(null);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || categoryFilter !== 'ALL' || statusFilter !== 'ALL';

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
                Encrypted Cloud Vault • Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-4xl">
              Manage clinical decision rules, ingest multi-format documents (PDF, Word, Excel, Camera Scans) backed by encrypted cloud vault storage, and track per-user historical records.
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
              <span className="text-xs font-bold text-on-surface block">Clinical Document Vault &amp; Decision Engine</span>
              <span className="text-[11px] text-on-surface-variant">
                Uploaded clinical documents and prescription scans are safely preserved in your encrypted vault and parsed into active clinical decision rules.
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-700">
                Vault &amp; Engine: Synced ({lastSyncText || 'Just now'})
              </span>
            </div>
            <span className="hidden sm:inline text-xs text-outline">•</span>
            <span className="text-[11px] font-medium text-on-surface-variant">
              {rules.filter((r) => r.active).length} Rules Active • {documentHistory.length} Vault Records
            </span>
          </div>
        </div>
      </div>

      {/* Primary Interactive Tabs Navigation */}
      <div className="w-full border-b border-surface-container-high overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 sm:gap-4 min-w-max pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'rules'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">rule_folder</span>
            <span>Clinical History</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold whitespace-nowrap">
              <span className="font-mono">{rules.length}</span>
              <span>active rules</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">history_edu</span>
            <span>Import &amp; Upload History</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold whitespace-nowrap">
              <span className="font-mono">{documentHistory.length}</span>
              <span>records</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'knowledge'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_tree</span>
            <span>Knowledge Sources</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-bold whitespace-nowrap">
              <span className="font-mono">0</span>
              <span>engines</span>
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
                  if (!hasActiveFilters) return;
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  showConfirmation('Filters cleared: Showing all rules', 'info');
                }}
                className={`w-10 h-10 shrink-0 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                  hasActiveFilters
                    ? 'bg-primary/10 border-primary text-primary hover:bg-primary/20 shadow-xs'
                    : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface-variant hover:text-on-surface'
                }`}
                title={hasActiveFilters ? 'Reset active filters' : 'Filters clear'}
                aria-label={hasActiveFilters ? 'Reset active filters' : 'Filter status'}
              >
                <span className="material-symbols-outlined text-[19px]">
                  {hasActiveFilters ? 'filter_alt_off' : 'filter_alt'}
                </span>
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
                <span className="text-xs font-bold text-emerald-800 block leading-tight">Encrypted Storage Vault</span>
                <span className="text-[11px] text-outline font-mono">Protected Health Data (APAC)</span>
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
                  Chronological records of PDF, Word, Excel, and Camera Scans securely archived in encrypted vault.
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
                    <th className="py-3 px-4">Vault Document Status</th>
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
                              <button
                                type="button"
                                disabled={!doc.storageUrl}
                                onClick={() => {
                                  if (doc.storageUrl) setInspectDocModal(doc);
                                }}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                                  doc.storageUrl
                                    ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white cursor-pointer shadow-2xs hover:scale-105'
                                    : 'bg-primary/10 text-primary cursor-default'
                                }`}
                                title={doc.storageUrl ? 'Click to inspect document scan & OCR' : 'Form Stored'}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {isCamera ? 'photo_camera' : isManual ? 'edit_note' : isPdf ? 'picture_as_pdf' : isWord ? 'description' : isCsv ? 'table_chart' : 'image'}
                                </span>
                              </button>
                              <div className="min-w-0">
                                {doc.storageUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setInspectDocModal(doc)}
                                    className="font-bold text-xs text-on-surface hover:text-primary text-left block truncate max-w-xs cursor-pointer transition-colors"
                                  >
                                    {doc.filename}
                                  </button>
                                ) : (
                                  <span className="font-bold text-xs text-on-surface block truncate max-w-xs">
                                    {doc.filename}
                                  </span>
                                )}
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
                            <div className="flex items-center gap-1.5">
                              {doc.storageUrl ? (
                                <button
                                  type="button"
                                  onClick={() => setInspectDocModal(doc)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary/10 text-primary transition-colors text-[11px] font-bold border border-surface-container-high cursor-pointer shadow-2xs"
                                  title="Inspect Document & OCR Extraction"
                                >
                                  <span className="material-symbols-outlined text-[14px]">visibility</span>
                                  <span>Inspect</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-outline italic">Form Stored</span>
                              )}
                              {doc.storageUrl && (
                                <a
                                  href={doc.storageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors"
                                  title="Open original file from secure vault"
                                >
                                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                                </a>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setDocToDelete(doc)}
                              className="p-1.5 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete Document &amp; Purge from Vault"
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
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-5">
              {/* Animated Full-Screen Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={handleCloseAddModal}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 bg-surface-container-lowest rounded-3xl p-4 sm:p-6 max-w-2xl w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[88dvh] sm:max-h-[90vh] overflow-hidden my-auto"
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
                        ? 'Verify extracted drug pairs, clinical mechanisms, and secure vault storage link.'
                        : 'Author single or multiple interaction rules directly with clinical formulas.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAddModal}
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
                  <div className="relative space-y-4 rounded-2xl overflow-hidden min-h-[320px]">
                    {/* Content that blurs gracefully during extraction without unmounting */}
                    <div
                      className={`space-y-4 transition-all duration-300 ${
                        isExtracting
                          ? 'filter blur-[2px] opacity-75 pointer-events-none select-none scale-[0.99]'
                          : ''
                      }`}
                    >
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
                        disabled={isExtracting}
                        accept={
                          uploadFormat === 'image'
                            ? '.png,.jpg,.jpeg'
                            : uploadFormat === 'pdf'
                            ? '.pdf'
                            : uploadFormat === 'csv'
                            ? '.csv,.xlsx'
                            : '.docx,.doc'
                        }
                        onClick={(e) => {
                          (e.target as HTMLInputElement).value = '';
                        }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setUploadedFile(file);
                            if (uploadFormat === 'image' || file.type.startsWith('image/')) {
                              setImagePreviewUrl(URL.createObjectURL(file));
                            } else {
                              setImagePreviewUrl(null);
                            }
                          }
                          e.target.value = '';
                        }}
                      />

                      {/* Dropzone & Live Camera Area */}
                      <div className={`transition-all duration-300 ${isExtracting ? 'opacity-10 blur-sm pointer-events-none select-none' : ''}`}>
                        <label className="block text-xs font-bold text-on-surface mb-1.5">
                          2. Choose or Capture Document
                        </label>

                        {uploadFormat === 'image' && !uploadedFile && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 mb-2.5">
                            <button
                              type="button"
                              onClick={() => setIsCameraModalOpen(true)}
                              className="p-3 sm:p-3.5 rounded-xl border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-left flex items-center gap-2.5 sm:gap-3 cursor-pointer group shadow-2xs"
                            >
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">photo_camera</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-primary block group-hover:underline truncate">Open Live Camera</span>
                                <span className="text-[10px] text-on-surface-variant truncate block">Phone & laptop front/back scanner</span>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (isExtracting) return;
                                setUploadSource('file');
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = '';
                                  fileInputRef.current.click();
                                }
                              }}
                              className="p-3 sm:p-3.5 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container transition-all text-left flex items-center gap-2.5 sm:gap-3 cursor-pointer group shadow-2xs"
                            >
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">folder_open</span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-on-surface block group-hover:underline truncate">Browse Image File</span>
                                <span className="text-[10px] text-outline truncate block">PNG, JPG, JPEG, WEBP</span>
                              </div>
                            </button>
                          </div>
                        )}

                        {!uploadedFile ? (
                          <div
                            onClick={() => {
                              if (isExtracting) return;
                              setUploadSource('file');
                              fileInputRef.current?.click();
                            }}
                            className="border-2 border-dashed border-surface-container-high hover:border-primary rounded-2xl p-4 sm:p-6 text-center cursor-pointer bg-surface-container-low/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2"
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
                          <div className="space-y-3">
                            {imagePreviewUrl && (
                              <div className="relative rounded-2xl overflow-hidden border border-surface-container-high bg-surface-container-lowest flex items-center justify-center max-h-[240px]">
                                <img src={imagePreviewUrl} alt="Document Preview" className="w-full max-h-[240px] object-contain" />
                              </div>
                            )}

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
                                    {(uploadedFile.size / 1024).toFixed(1)} KB · Ready to save to secure vault & parse
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFile(null);
                                  setImagePreviewUrl(null);
                                  setUploadSource('file');
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Minimal Real-Time Percentage Overlay Floating Over Blurred Upload Area */}
                    <MinimalExtractionOverlay
                      isExtracting={isExtracting}
                      onComplete={() => setAddModalMode('preview')}
                    />
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
                    {imagePreviewUrl && (
                      <OpticalScanOverlay
                        imageUrl={imagePreviewUrl}
                        isScanning={false}
                        title="Optical OCR & Rules Extracted"
                        className="max-h-[240px]"
                      />
                    )}
                    {/* Staged Document Preview Confirmation Card */}
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                          <span className="material-symbols-outlined text-[24px]">visibility</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-on-surface truncate max-w-xs block">
                              {extractedFileMeta?.filename}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shrink-0 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              <span>Staged Preview (Unsaved)</span>
                            </span>
                          </div>
                          <p className="text-[11px] text-on-surface-variant mt-0.5 font-medium">
                            {extractedFileMeta?.filesize} · Extracted {extractedFileMeta?.extractedAt} · Click Save below to ingest to Vault &amp; add rules
                          </p>
                        </div>
                      </div>
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

                    {/* Extracted Prescribed Medications Banner */}
                    {extractedPreviewMedicines.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/25 flex flex-col gap-2 shadow-2xs">
                        <div className="flex items-center justify-between text-xs font-bold text-teal-900">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-teal-700">prescriptions</span>
                            <span>Extracted Prescribed Medications ({extractedPreviewMedicines.length})</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {extractedPreviewMedicines.map((m, idx) => (
                            <span key={idx} className="px-2.5 py-1 rounded-lg bg-white border border-teal-200 text-[11px] font-semibold text-teal-950 flex items-center gap-1.5 shadow-2xs">
                              <span className="material-symbols-outlined text-primary text-[14px]">pill</span>
                              <span>{m.drugName}</span>
                              {m.dosage && <span className="text-outline text-[10px]">({m.dosage})</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

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
                    onClick={handleCloseAddModal}
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
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer relative overflow-hidden select-none ${
                      uploadedFile && !isExtracting
                        ? 'bg-primary hover:bg-primary-hover text-white shadow-xs'
                        : isExtracting
                        ? 'bg-gradient-to-r from-teal-700 via-primary to-teal-800 text-white shadow-md animate-pulse cursor-wait'
                        : 'bg-outline/20 text-on-surface/40 cursor-not-allowed'
                    }`}
                  >
                    {isExtracting ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                          className="inline-flex shrink-0 items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[17px]">sync</span>
                        </motion.span>
                        <span className="tracking-wide">Analyzing &amp; Extracting Clinical Rules...</span>
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
                  <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-2.5">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={isSavingStagedDoc}
                        onClick={handleCloseAddModal}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                        title="Discard extracted rules without saving"
                      >
                        <span className="material-symbols-outlined text-[15px]">close</span>
                        <span>Cancel &amp; Discard</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSavingStagedDoc}
                        onClick={handleBackToUpload}
                        className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors disabled:opacity-50"
                      >
                        Back to Upload
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={isSavingStagedDoc}
                      onClick={handleConfirmPreviewRules}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {isSavingStagedDoc ? (
                        <>
                          <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                          <span>Saving to Vault &amp; Rules...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">save</span>
                          <span>Confirm &amp; Save All {extractedPreviewRules.length} Rules to Vault</span>
                        </>
                      )}
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
          setLastSyncText('Just now');
          setSyncStatusText('Knowledge feeds synchronized just now');
          showConfirmation('Vault & Knowledge Bases Synchronized Successfully', 'success');
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
                        Permanent purge from secure vault and database.
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
                      <span>Encrypted Cloud Vault</span>
                    </span>
                  </div>
                </div>

                {/* Warning Banner */}
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 leading-relaxed">
                  <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0 mt-0.5">warning</span>
                  <span>
                    This action will permanently delete this image/document from secure encrypted vault storage, delete its audit ledger entry, and cascade-remove all {docToDelete.extractedRulesCount} extracted rules from the active decision matrix.
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
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.75, ease: 'linear' }}
                          className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full shrink-0"
                        />
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

      {/* ========================================================================= */}
      {/* DOCUMENT IMAGE INSPECTION & OCR MODAL */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {inspectDocModal && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-5">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setInspectDocModal(null)}
                className="fixed inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-2xl bg-surface-container-lowest border border-surface-container-high rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col gap-3.5 sm:gap-4 z-10 max-h-[88dvh] sm:max-h-[90vh] overflow-hidden my-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-container pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">
                        {inspectDocModal.filename.toLowerCase().includes('camera') ? 'photo_camera' : 'document_scanner'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-on-surface truncate max-w-sm">
                        {inspectDocModal.filename}
                      </h3>
                      <p className="text-[11px] text-on-surface-variant">
                        Ingested {inspectDocModal.uploadedAt} · {inspectDocModal.extractedRulesCount} clinical rules active
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectDocModal(null)}
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Body Content */}
                <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                  {/* Optical Scan Display for Images */}
                  {inspectDocModal.storageUrl && (
                    <OpticalScanOverlay
                      imageUrl={inspectDocModal.storageUrl}
                      isScanning={false}
                      title="Optical Scan Verified"
                      className="max-h-[340px]"
                    />
                  )}

                  {/* Associated Rules List */}
                  <div>
                    <h4 className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-primary">rule</span>
                      <span>Extracted Clinical Rules from this Document</span>
                    </h4>

                    {(() => {
                      const matchedRules = rules.filter((r) => r.sourceFile === inspectDocModal.filename);
                      if (matchedRules.length === 0) {
                        return (
                          <div className="p-3.5 rounded-xl bg-surface-container-low text-xs text-outline text-center">
                            No rules currently linked to this exact document filename.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {matchedRules.map((r) => (
                            <div
                              key={r.id}
                              className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-on-surface">
                                  {r.drugA} + {r.drugB}
                                </span>
                                <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">
                                  {r.description}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
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
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-surface-container pt-3">
                  {inspectDocModal.storageUrl ? (
                    <a
                      href={inspectDocModal.storageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-primary/10 text-primary text-xs font-bold transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Open Original File</span>
                    </a>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const target = inspectDocModal;
                        setInspectDocModal(null);
                        setDocToDelete(target);
                      }}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50/70 hover:bg-rose-100 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                      <span>Delete Document</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectDocModal(null)}
                      className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
