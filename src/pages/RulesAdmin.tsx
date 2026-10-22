import { useState } from 'react';
import { VirtualDb } from '../data/virtualDb';
import { InteractionRule } from '../types';

export default function RulesAdmin() {
  const [activeTab, setActiveTab] = useState<'rules' | 'knowledge' | 'regression'>('rules');
  const [rules, setRules] = useState<InteractionRule[]>(VirtualDb.getRules());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('All engines synchronized 14m ago');
  const [regressionRunning, setRegressionRunning] = useState(false);

  const handleToggle = (id: string) => {
    const updated = VirtualDb.toggleRule(id);
    setRules([...updated]);
  };

  const handleSyncEngines = () => {
    setIsSyncing(true);
    setSyncStatusText('Connecting to FDB & Lexicomp CDG gateways...');
    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatusText('All 4 knowledge engines synchronized just now (v2025.02-B)');
    }, 1200);
  };

  const handleRunRegression = () => {
    setRegressionRunning(true);
    setTimeout(() => {
      setRegressionRunning(false);
    }, 900);
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
    <div className="flex flex-col w-full gap-6">
      {/* Top Page Header Section */}
      <div className="w-full flex flex-col gap-3 pb-2">
        {/* Breadcrumb & Governance Tier Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant font-medium">
          <div className="flex items-center gap-1.5">
            <span>Knowledge Governance</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Decision Logic Engine</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">Active Policy Suite (v4.2.1-prod)</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary text-xs">
            <span className="material-symbols-outlined text-[14px]">verified_user</span>
            <span>FDA SaMD Tier II / MDR Class IIa Deterministic Engine Mode: Active</span>
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
              onClick={handleSyncEngines}
              className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-primary-container text-on-primary hover:bg-primary transition-all text-xs font-bold shadow-xs cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>Sync Knowledge Bases</span>
            </button>
            <span className="text-xs text-primary font-medium hidden lg:inline">
              {syncStatusText}
            </span>
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
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all ${
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
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all ${
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
            className={`flex items-center gap-2 pb-3 border-b-2 text-xs font-bold transition-all ${
              activeTab === 'regression'
                ? 'border-primary-container text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">checklist_rtl</span>
            <span>Test Suite & Regression</span>
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
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold outline-none border border-surface-container-high cursor-pointer"
              >
                <option value="ALL">Check Type: All Categories</option>
                <option value="Interaction">Drug-Drug Interaction</option>
                <option value="Allergy">Allergy Conflict</option>
                <option value="Dose">Dose & Frequency</option>
                <option value="Duplicate">Duplicate Therapy</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold outline-none border border-surface-container-high cursor-pointer"
              >
                <option value="ALL">State: All Rules</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive / Staged</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="p-2 h-10 rounded-xl hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-all flex items-center justify-center cursor-pointer"
                title="Reset Filters"
              >
                <span className="material-symbols-outlined text-[20px]">filter_alt_off</span>
              </button>
            </div>
          </div>

          {/* Rules Table */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px] text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-outline uppercase tracking-wider font-semibold border-b border-surface-container">
                    <th className="py-3 px-4">Rule Target & Mechanism</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Default Severity</th>
                    <th className="py-3 px-4">Evidence Level</th>
                    <th className="py-3 px-4">Active State</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {filteredRules.map((rule) => {
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

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggle(rule.id)}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            {rule.active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE SOURCES */}
      {activeTab === 'knowledge' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3">
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
                Active & Synced
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Provides primary deterministic clinical rules for drug-drug interactions, duplicate therapies, and dose ceiling validation.
            </p>
            <div className="pt-2 border-t border-surface-container flex items-center justify-between text-[11px] text-outline font-mono">
              <span>Database v2025.02-B</span>
              <span>Updated: Today 09:22 UTC</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3">
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
                Active & Synced
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Provides deep pharmacokinetics explanations, severity grading matrices, CYP enzyme inhibition pathways, and patient guidance.
            </p>
            <div className="pt-2 border-t border-surface-container flex items-center justify-between text-[11px] text-outline font-mono">
              <span>Release 2025-Q1</span>
              <span>Updated: Today 09:22 UTC</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  RXN
                </div>
                <div>
                  <h3 className="text-sm font-bold text-on-surface">NIH NLM DailyMed & RxNorm</h3>
                  <span className="text-[11px] text-on-surface-variant font-medium">Standardized Drug Ontology</span>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                Active & Synced
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Maps national drug codes (NDC), concept unique identifiers (RxCUI), package inserts, and FDA black-box warnings.
            </p>
            <div className="pt-2 border-t border-surface-container flex items-center justify-between text-[11px] text-outline font-mono">
              <span>RxNorm 2025-02</span>
              <span>Updated: 2 days ago</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs space-y-3">
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
                Active & Synced
              </span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Provides genotype-guided drug dosing algorithms (CYP2C9, VKORC1, HLA-B*5701) for personalized prescribing precision.
            </p>
            <div className="pt-2 border-t border-surface-container flex items-center justify-between text-[11px] text-outline font-mono">
              <span>CPIC v3.1</span>
              <span>Updated: Weekly auto-fetch</span>
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
                play_arrow
              </span>
              <span>{regressionRunning ? 'Executing Test Assertions...' : 'Run All Test Assertions'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'TEST-01', name: 'Warfarin + Fluconazole CYP2C9 Potentiation', status: 'PASS', time: '12ms' },
              { id: 'TEST-02', name: 'Lisinopril + Spironolactone Hyperkalemia', status: 'PASS', time: '9ms' },
              { id: 'TEST-03', name: 'Penicillin Anaphylaxis vs Amoxicillin', status: 'PASS', time: '14ms' },
              { id: 'TEST-04', name: 'Ciprofloxacin eGFR < 50mL Renal Threshold', status: 'PASS', time: '11ms' },
              { id: 'TEST-05', name: 'Atorvastatin + Clarithromycin Rhabdo Warning', status: 'PASS', time: '16ms' },
              { id: 'TEST-06', name: 'Levothyroxine + Calcium Chelation Window', status: 'PASS', time: '8ms' },
              { id: 'TEST-07', name: 'Duplicate Opioid / Sedative Co-prescribing', status: 'PASS', time: '10ms' },
              { id: 'TEST-08', name: 'Methotrexate + NSAID Clearance Suppression', status: 'PASS', time: '15ms' },
              { id: 'TEST-09', name: 'Pregnancy Category D / X Teratogenicity Guard', status: 'PASS', time: '13ms' },
            ].map((tc) => (
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
                  <span className="font-mono">{tc.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
