import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VirtualDb } from '../data/virtualDb';
import { InteractionRule, AlertSeverity } from '../types';
import CustomDropdown from '../components/CustomDropdown';

export default function RulesAdmin() {
  const [rules, setRules] = useState<InteractionRule[]>(VirtualDb.getRules());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add Rule Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDrugA, setNewDrugA] = useState('');
  const [newDrugB, setNewDrugB] = useState('');
  const [newCategory, setNewCategory] = useState<'Drug-Drug' | 'Drug-Allergy' | 'Drug-Condition' | 'Renal Dose Adjustment'>('Drug-Drug');
  const [newSeverity, setNewSeverity] = useState<AlertSeverity>('contraindicated');
  const [newDescription, setNewDescription] = useState('');

  // Inspect Rule Modal
  const [inspectRule, setInspectRule] = useState<InteractionRule | null>(null);

  const handleToggle = (id: string) => {
    const updated = VirtualDb.toggleRule(id);
    setRules([...updated]);
    const target = updated.find(r => r.id === id);
    setToastMessage(`Rule for ${target?.drugA} + ${target?.drugB} is now ${target?.active ? 'ACTIVE' : 'DISABLED'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDelete = (id: string) => {
    const updated = VirtualDb.deleteRule(id);
    setRules([...updated]);
    setToastMessage('Rule removed successfully.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrugA.trim() || !newDrugB.trim() || !newDescription.trim()) {
      return;
    }

    const created: InteractionRule = {
      id: 'rule-' + Date.now(),
      drugA: newDrugA.trim(),
      drugB: newDrugB.trim(),
      category: newCategory,
      severity: newSeverity,
      description: newDescription.trim(),
      active: true,
    };

    const updated = VirtualDb.addRule(created);
    setRules([...updated]);
    setIsAddModalOpen(false);
    setNewDrugA('');
    setNewDrugB('');
    setNewDescription('');
    setToastMessage(`New rule for ${created.drugA} + ${created.drugB} created.`);
    setTimeout(() => setToastMessage(null), 3000);
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
        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant font-medium">
          <div className="flex items-center gap-1.5">
            <span>Knowledge Governance</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-bold">Decision Logic Rules</span>
          </div>
        </div>

        {/* Main Header & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                Rules &amp; Data Governance
              </h1>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-high text-primary text-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                Clinical Rules Admin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1 max-w-4xl">
              Configure and manage custom clinical interaction rules, drug-drug contraindications, and dose adjustments.
            </p>
          </div>

          {/* Action Button: Add Rule */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-primary text-on-primary hover:bg-primary-container transition-all text-xs font-bold shadow-xs cursor-pointer hover:shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Add New Rule</span>
            </button>
          </div>
        </div>
      </div>

      {/* Rules Section */}
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
              placeholder="Search by drug name or clinical description..."
              className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface-container-low text-on-surface text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CustomDropdown
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: 'ALL', label: 'All Categories' },
                { value: 'Drug-Drug', label: 'Drug-Drug' },
                { value: 'Drug-Allergy', label: 'Drug-Allergy' },
                { value: 'Drug-Condition', label: 'Drug-Condition' },
                { value: 'Renal Dose Adjustment', label: 'Renal Dose' }
              ]}
              prefixIcon="tune"
            />

            <CustomDropdown
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All States' },
                { value: 'ACTIVE', label: 'Active Rules' },
                { value: 'INACTIVE', label: 'Disabled Rules' }
              ]}
              prefixIcon="toggle_on"
            />
          </div>
        </div>

        {/* Table or Empty State */}
        <div className="w-full rounded-2xl bg-surface-container-lowest shadow-xs border border-surface-container-high/60 overflow-hidden">
          {rules.length === 0 ? (
            /* Clean Empty State when 0 rules exist */
            <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface-container-high text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px]">rule_folder</span>
              </div>
              <h3 className="text-base font-bold text-on-surface">No Clinical Decision Rules Configured</h3>
              <p className="text-xs text-on-surface-variant max-w-md">
                There are currently no custom drug-drug, allergy, or clinical condition rules configured. Add your first clinical rule to enforce automated safety screening.
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add First Rule</span>
              </button>
            </div>
          ) : filteredRules.length === 0 ? (
            /* Filter Match Empty State */
            <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-outline text-[32px]">filter_list_off</span>
              <p className="text-xs font-semibold text-on-surface">No rules match your filters</p>
              <p className="text-[11px] text-on-surface-variant">Try adjusting your search terms or category filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-surface-container-high text-on-surface-variant font-bold text-[11px] tracking-wider uppercase">
                    <th className="py-3.5 px-4 font-bold">Rule Target &amp; Mechanism</th>
                    <th className="py-3.5 px-4 font-bold">Category</th>
                    <th className="py-3.5 px-4 font-bold">Default Severity</th>
                    <th className="py-3.5 px-4 font-bold text-center">Active State</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/60">
                  {filteredRules.map((rule) => {
                    const severityColors = {
                      contraindicated: 'bg-rose-50 text-rose-800 border-rose-200',
                      major: 'bg-amber-50 text-amber-800 border-amber-200',
                      moderate: 'bg-sky-50 text-sky-800 border-sky-200',
                      minor: 'bg-slate-50 text-slate-800 border-slate-200',
                      safe: 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    };

                    return (
                      <tr key={rule.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface font-mono font-bold text-[11px]">
                                {rule.drugA}
                              </span>
                              <span className="material-symbols-outlined text-[14px] text-outline">sync_alt</span>
                              <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface font-mono font-bold text-[11px]">
                                {rule.drugB}
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant line-clamp-1 max-w-xl">
                              {rule.description}
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-on-surface-variant font-medium">
                          {rule.category}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${severityColors[rule.severity] || severityColors.minor}`}>
                            {rule.severity}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(rule.id)}
                            className="cursor-pointer inline-flex items-center"
                            title={rule.active ? 'Click to disable' : 'Click to activate'}
                          >
                            <span className={`material-symbols-outlined text-[28px] transition-colors ${rule.active ? 'text-primary' : 'text-outline'}`}>
                              {rule.active ? 'toggle_on' : 'toggle_off'}
                            </span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectRule(rule)}
                              className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-[11px] font-bold transition-all cursor-pointer"
                            >
                              Inspect
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(rule.id)}
                              className="p-1 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              title="Delete rule"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Inspect Rule Modal */}
      <AnimatePresence>
        {inspectRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-surface-container pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </div>
                  <h3 className="font-bold text-on-surface text-sm">Rule Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectRule(null)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-outline block">Interacting Targets</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-bold text-on-surface">{inspectRule.drugA}</span>
                    <span className="text-outline">with</span>
                    <span className="font-bold text-on-surface">{inspectRule.drugB}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-outline block">Category</span>
                    <span className="font-semibold text-on-surface mt-0.5 block">{inspectRule.category}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-outline block">Default Severity</span>
                    <span className="font-semibold text-on-surface mt-0.5 uppercase block">{inspectRule.severity}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-outline block">Clinical Warning &amp; Mechanism</span>
                  <p className="text-on-surface-variant mt-1 leading-relaxed bg-surface-container-low p-3 rounded-xl border border-surface-container-high/60">
                    {inspectRule.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setInspectRule(null)}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Rule Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-surface-container pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  </div>
                  <h3 className="font-bold text-on-surface text-sm">Add New Clinical Decision Rule</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Drug / Molecule A *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDrugA}
                      onChange={(e) => setNewDrugA(e.target.value)}
                      placeholder="e.g. Warfarin"
                      className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Drug B / Condition *
                    </label>
                    <input
                      type="text"
                      required
                      value={newDrugB}
                      onChange={(e) => setNewDrugB(e.target.value)}
                      placeholder="e.g. Ibuprofen"
                      className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
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
                      value={newSeverity}
                      onChange={(e) => setNewSeverity(e.target.value as AlertSeverity)}
                      className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
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
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Enter mechanism of interaction and recommended clinical action..."
                    className="w-full px-3 py-2 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-surface-container-highest text-on-surface text-xs font-semibold shadow-lg border border-surface-container-high flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
