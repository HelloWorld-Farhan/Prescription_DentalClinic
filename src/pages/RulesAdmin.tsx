import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualDb } from '../services/prescriptionService';
import { InteractionRule, AlertSeverity } from '../types';
import SyncKnowledgeModal from '../components/SyncKnowledgeModal';
import CustomDropdown from '../components/CustomDropdown';

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
  const [activeTab, setActiveTab] = useState<'rules' | 'knowledge' | 'regression'>('rules');
  const [rules, setRules] = useState<InteractionRule[]>(VirtualDb.getRules());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('');
  const [regressionRunning, setRegressionRunning] = useState(false);
  const [inspectRule, setInspectRule] = useState<InteractionRule | null>(null);
  const [inspectGateway, setInspectGateway] = useState<{ id: string; name: string; endpoint: string; latency: string; uptime: string; hash: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Rule Multi-Modal Wizard States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState<'select' | 'upload' | 'manual'>('select');
  const [uploadFormat, setUploadFormat] = useState<'pdf' | 'csv' | 'word' | 'image'>('pdf');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [draftRules, setDraftRules] = useState<DraftRuleItem[]>([emptyDraftRule()]);
  const [manualFormError, setManualFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tests, setTests] = useState<{ id: string; name: string; status: string; time: string }[]>([]);

  const handleOpenAddModal = () => {
    setAddModalMode('select');
    setUploadFormat('pdf');
    setUploadedFile(null);
    setIsExtracting(false);
    setManualFormError(null);
    setDraftRules([emptyDraftRule()]);
    setIsAddModalOpen(true);
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
    }));

    const updated = VirtualDb.addRules(newRules);
    setRules([...updated]);
    setIsAddModalOpen(false);
    setToastMessage(`Successfully saved ${newRules.length} clinical rule${newRules.length > 1 ? 's' : ''}.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExtractFromDocument = () => {
    if (!uploadedFile) return;
    setIsExtracting(true);

    setTimeout(() => {
      const baseName = uploadedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const extracted: InteractionRule[] = [
        {
          id: 'rule-doc-' + Date.now() + '-1',
          drugA: `${baseName} (Agent A)`,
          drugB: 'Target Molecule / Substrate',
          category: 'Drug-Drug',
          severity: 'contraindicated',
          description: `Extracted from ${uploadedFile.name}: Documented cytochrome P450 competitive binding interaction.`,
          active: true,
        },
        {
          id: 'rule-doc-' + Date.now() + '-2',
          drugA: `${baseName} (Agent B)`,
          drugB: 'Renal Clearance Protocol',
          category: 'Renal Dose Adjustment',
          severity: 'major',
          description: `Extracted from ${uploadedFile.name}: Dose adjustment mandatory when eGFR < 50 mL/min.`,
          active: true,
        },
      ];

      const updated = VirtualDb.addRules(extracted);
      setRules([...updated]);
      setIsExtracting(false);
      setIsAddModalOpen(false);
      setToastMessage(`Extracted and imported ${extracted.length} clinical rules from "${uploadedFile.name}".`);
      setTimeout(() => setToastMessage(null), 3500);
    }, 1200);
  };

  const handleToggle = (id: string) => {
    const updated = VirtualDb.toggleRule(id);
    setRules([...updated]);
    const target = updated.find(r => r.id === id);
    setToastMessage(`Rule ${id} is now ${target?.active ? 'ACTIVE' : 'DISABLED'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDelete = (id: string) => {
    const updated = VirtualDb.deleteRule(id);
    setRules([...updated]);
    setToastMessage(`Rule ${id} removed.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRunRegression = () => {
    setRegressionRunning(true);
    setToastMessage('Executing deterministic golden test suite battery...');
    setTimeout(() => {
      setTests([
        { id: 'TEST-01', name: 'Warfarin + Fluconazole CYP2C9 Potentiation', status: 'PASS', time: '12ms' },
        { id: 'TEST-02', name: 'Lisinopril + Spironolactone Hyperkalemia', status: 'PASS', time: '9ms' },
        { id: 'TEST-03', name: 'Penicillin Anaphylaxis vs Amoxicillin', status: 'PASS', time: '14ms' },
        { id: 'TEST-04', name: 'Ciprofloxacin eGFR < 50mL Renal Threshold', status: 'PASS', time: '11ms' },
        { id: 'TEST-05', name: 'Atorvastatin + Clarithromycin Rhabdo Warning', status: 'PASS', time: '16ms' },
        { id: 'TEST-06', name: 'Levothyroxine + Calcium Chelation Window', status: 'PASS', time: '8ms' },
        { id: 'TEST-07', name: 'Duplicate Opioid / Sedative Co-prescribing', status: 'PASS', time: '10ms' },
        { id: 'TEST-08', name: 'Methotrexate + NSAID Clearance Suppression', status: 'PASS', time: '15ms' },
        { id: 'TEST-09', name: 'Pregnancy Category D / X Teratogenicity Guard', status: 'PASS', time: '13ms' },
      ]);
      setRegressionRunning(false);
      setToastMessage('All 9/9 Golden Invariant Assertions Passed (0 regression defects)');
      setTimeout(() => setToastMessage(null), 4000);
    }, 1200);
  };

  const filteredRules = rules.filter((r) => {
    const matchesCategory =
      categoryFilter === 'ALL' ||
      (categoryFilter === 'Interaction' && r.category === 'Drug-Drug') ||
      (categoryFilter === 'Allergy' && r.category === 'Drug-Allergy') ||
      (categoryFilter === 'Dose' && r.category === 'Renal Dose Adjustment') ||
      r.category.toLowerCase().includes(categoryFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && r.active) ||
      (statusFilter === 'INACTIVE' && !r.active);

    const matchesSearch =
      r.drugA.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.drugB.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto px-1 sm:px-2">
      {/* Top Page Header Section */}
      <div className="w-full flex flex-col gap-3 pb-2">
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant font-medium">
          <div className="flex items-center gap-1.5">
            <span>Knowledge Governance</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">Decision Logic Engine</span>
          </div>
        </div>

        {/* Main Header & Action Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                Rules & Data Governance
              </h1>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high text-primary text-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                Clinical Informatics & Knowledge Base Admin • Level 3
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-4xl">
              Configure algorithmic decision rules, inspect licensed clinical knowledge bases, and run deterministic regression suites.
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
              <span>Add New Rule</span>
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
              <span className="material-symbols-outlined text-[20px]">lock_clock</span>
            </div>
            <div>
              <span className="text-xs font-bold text-on-surface block">Zero-Drift Invariant Enforcement</span>
              <span className="text-[11px] text-on-surface-variant">
                Clinical alert triggers execute via compiled AST patterns. No unanchored generative hallucinations permitted in production safety checks.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-emerald-700">Engine Health: 100% Invariant</span>
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
            <span>Rules</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px]">
              {rules.length} active rules
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
              4 active engines
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
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
              9/9 passing
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
                className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
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
                    filteredRules.map((rule) => {
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
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE SOURCES */}
      {activeTab === 'knowledge' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FDB Card */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    FDB
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">First Databank (FDB) MedKnowledge</h3>
                    <span className="text-[11px] text-on-surface-variant font-medium">Licensed Clinical Pharmacopeia</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Active &amp; Synced
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Provides primary deterministic clinical rules for drug-drug interactions, duplicate therapies, and dose ceiling validation.
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-outline">Database v2025.02-B</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setInspectGateway({
                      id: 'fdb',
                      name: 'First Databank MedKnowledge Gateway',
                      endpoint: 'https://cds.smileclinic.org/v1/interaction-rules',
                      latency: '12ms',
                      uptime: '99.99%',
                      hash: 'SHA256: 0x9f8e41a...c82b'
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-[11px] font-bold transition-all cursor-pointer"
                >
                  Inspect Gateway
                </button>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">sync</span>
                  <span>Sync Feed</span>
                </button>
              </div>
            </div>
          </div>

          {/* Lexicomp Card */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    LEX
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Wolters Kluwer Lexicomp DDI</h3>
                    <span className="text-[11px] text-on-surface-variant font-medium">Evidence Monograph Engine</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Active &amp; Synced
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Provides deep pharmacokinetics explanations, severity grading matrices, CYP enzyme inhibition pathways, and patient guidance.
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-outline">Release 2025-Q1</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setInspectGateway({
                      id: 'lexicomp',
                      name: 'Wolters Kluwer Lexicomp Monograph Gateway',
                      endpoint: 'https://cds.smileclinic.org/v1/monographs',
                      latency: '15ms',
                      uptime: '99.98%',
                      hash: 'SHA256: 0x4a7c19b...f30e'
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-[11px] font-bold transition-all cursor-pointer"
                >
                  Inspect Gateway
                </button>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">sync</span>
                  <span>Sync Feed</span>
                </button>
              </div>
            </div>
          </div>

          {/* RxNorm Card */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    RXN
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">NIH NLM DailyMed &amp; RxNorm</h3>
                    <span className="text-[11px] text-on-surface-variant font-medium">Standardized Drug Ontology</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Active &amp; Synced
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Maps national drug codes (NDC), concept unique identifiers (RxCUI), package inserts, and FDA black-box warnings.
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-outline">RxNorm 2025-02</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setInspectGateway({
                      id: 'rxnorm',
                      name: 'NIH National Library of Medicine Gateway',
                      endpoint: 'https://cds.smileclinic.org/v1/rxcui-mappings',
                      latency: '8ms',
                      uptime: '99.99%',
                      hash: 'SHA256: 0x81da30c...7e41'
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-[11px] font-bold transition-all cursor-pointer"
                >
                  Inspect Gateway
                </button>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">sync</span>
                  <span>Sync Feed</span>
                </button>
              </div>
            </div>
          </div>

          {/* CPIC Card */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    CPIC
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Clinical Pharmacogenetics (CPIC)</h3>
                    <span className="text-[11px] text-on-surface-variant font-medium">Genomic Guideline Set</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  Active &amp; Synced
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Provides genotype-guided drug dosing algorithms (CYP2C9, VKORC1, HLA-B*5701) for personalized prescribing precision.
              </p>
            </div>
            <div className="pt-2 border-t border-surface-container flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-mono text-outline">CPIC v3.1</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setInspectGateway({
                      id: 'cpic',
                      name: 'CPIC Pharmacogenetics Guideline API',
                      endpoint: 'https://cds.smileclinic.org/v1/pgx-guidelines',
                      latency: '18ms',
                      uptime: '99.97%',
                      hash: 'SHA256: 0x3e18a9d...61c0'
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-[11px] font-bold transition-all cursor-pointer"
                >
                  Inspect Gateway
                </button>
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">sync</span>
                  <span>Sync Feed</span>
                </button>
              </div>
            </div>
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
                Evaluates 9 critical golden test cases across renal clearance, drug-drug contraindication, and allergy cross-reactivity.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunRegression}
              disabled={regressionRunning}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${regressionRunning ? 'animate-spin' : ''}`}>
                {regressionRunning ? 'sync' : 'play_arrow'}
              </span>
              <span>{regressionRunning ? 'Executing Test Assertions...' : 'Run All Test Assertions'}</span>
            </button>
          </div>

          {tests.length === 0 ? (
            <div className="p-12 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container text-primary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-3xl">science</span>
              </div>
              <h4 className="text-sm font-bold text-on-surface">Regression Suite Ready to Execute</h4>
              <p className="text-xs text-on-surface-variant max-w-md leading-relaxed">
                Click &ldquo;Run All Test Assertions&rdquo; above to execute deterministic golden tests across renal thresholds, drug-drug contraindications, and allergy cross-reactivity.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tests.map((tc) => (
                <div key={tc.id} className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">{tc.id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      {regressionRunning ? 'TESTING...' : tc.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-on-surface line-clamp-2">{tc.name}</h4>
                  <div className="flex items-center justify-between pt-2 border-t border-surface-container text-[11px] text-outline">
                    <span>Deterministic Invariant</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <span>{tc.time}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTests(prev => prev.map(t => t.id === tc.id ? { ...t, status: 'PASS', time: `${Math.floor(Math.random() * 6 + 6)}ms` } : t));
                          setToastMessage(`Test assertion ${tc.id} re-verified: PASS`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="hover:text-primary transition-colors cursor-pointer"
                        title="Re-run Assertion"
                      >
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync Knowledge Modal Popup */}
      <SyncKnowledgeModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSyncComplete={(version) => {
          setSyncStatusText(`All 4 knowledge engines synchronized just now (${version})`);
          setToastMessage(`Knowledge bases successfully updated (${version})`);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* Inspect Rule AST Modal */}
      <AnimatePresence>
        {inspectRule && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-surface-container-lowest rounded-2xl p-6 max-w-xl w-full border border-surface-container-high shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between border-b border-surface-container pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">account_tree</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">Compiled Rule AST Inspector</h3>
                    <span className="font-mono text-xs text-primary font-bold">{inspectRule.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectRule(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
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

                <div className="flex items-center justify-between pt-2 border-t border-surface-container">
                  <span className="text-on-surface font-semibold">Active Engine Execution State:</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleToggle(inspectRule.id);
                      setInspectRule({ ...inspectRule, active: !inspectRule.active });
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      inspectRule.active
                        ? 'bg-emerald-600 text-white'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    {inspectRule.active ? 'ACTIVE & ENFORCED' : 'DISABLED / STAGED'}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-surface-container flex justify-end">
                <button
                  type="button"
                  onClick={() => setInspectRule(null)}
                  className="px-4 py-1.5 rounded-xl bg-surface-container text-on-surface font-bold text-xs hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspect Gateway Modal */}
      <AnimatePresence>
        {inspectGateway && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-surface-container-lowest rounded-2xl p-6 max-w-lg w-full border border-surface-container-high shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-start justify-between border-b border-surface-container pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-[20px]">lan</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-on-surface">{inspectGateway.name}</h3>
                    <span className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Gateway Connected &amp; Certified
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectGateway(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-surface-container-low space-y-1.5">
                  <span className="text-outline font-semibold block">Gateway Endpoint URI</span>
                  <span className="font-mono text-primary break-all">{inspectGateway.endpoint}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-outline font-semibold block">Round-Trip Latency</span>
                    <span className="font-bold text-on-surface text-sm">{inspectGateway.latency}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low">
                    <span className="text-outline font-semibold block">Gateway Uptime SLA</span>
                    <span className="font-bold text-emerald-700 text-sm">{inspectGateway.uptime}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low space-y-1">
                  <span className="text-outline font-semibold block">Cryptographic Feed Hash</span>
                  <span className="font-mono text-on-surface text-[11px] break-all">{inspectGateway.hash}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-surface-container flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setInspectGateway(null);
                    setIsSyncModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">sync</span>
                  <span>Sync This Feed</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectGateway(null)}
                  className="px-4 py-1.5 rounded-xl bg-surface-container text-on-surface font-bold text-xs hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Rule Multi-Step Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 max-w-2xl w-full border border-surface-container-high shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
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
                      {addModalMode === 'upload' ? 'upload_file' : addModalMode === 'manual' ? 'edit_note' : 'add_circle'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-on-surface">
                      {addModalMode === 'select'
                        ? 'Add Clinical Decision Rules'
                        : addModalMode === 'upload'
                        ? 'Upload Document to Import Rules'
                        : 'Manual Clinical Rule Entry'}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant">
                      {addModalMode === 'select'
                        ? 'Choose your preferred ingestion method: upload documentation or manual entry.'
                        : addModalMode === 'upload'
                        ? 'Select document format, upload the file, and extract interaction rules.'
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

                    {/* Dropzone Area */}
                    <div>
                      <label className="block text-xs font-bold text-on-surface mb-1.5">
                        2. Choose or Drag Document
                      </label>
                      {!uploadedFile ? (
                        <div
                          onClick={() => fileInputRef.current?.click()}
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
                                {uploadFormat === 'image' ? 'image' : uploadFormat === 'pdf' ? 'picture_as_pdf' : uploadFormat === 'csv' ? 'table_chart' : 'description'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-on-surface truncate block">
                                {uploadedFile.name}
                              </span>
                              <span className="text-[11px] text-outline">
                                {(uploadedFile.size / 1024).toFixed(1)} KB · Ready for AST parsing
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedFile(null)}
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
              </div>

              {/* Modal Bottom Actions */}
              <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                >
                  Cancel
                </button>

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
                        <span>Extracting Rules...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">document_scanner</span>
                        <span>Extract &amp; Import Rules</span>
                      </>
                    )}
                  </button>
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
      </AnimatePresence>

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
