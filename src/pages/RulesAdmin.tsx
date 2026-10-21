import { useState } from 'react';
import { VirtualDb } from '../data/virtualDb';
import { InteractionRule } from '../types';

export default function RulesAdmin() {
  const [rules, setRules] = useState<InteractionRule[]>(VirtualDb.getRules());
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggle = (id: string) => {
    const updated = VirtualDb.toggleRule(id);
    setRules([...updated]);
  };

  const filteredRules = rules.filter((r) => {
    const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter;
    const matchesSearch =
      r.drugA.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.drugB.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">database</span>
            <h1 className="text-2xl font-black text-on-surface">Rules Engine & Pharmacopeia Admin</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Configure clinic-specific drug interaction rules, allergy cross-reactivity matrices, and threshold triggers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center bg-surface-container-lowest rounded-xl px-3 py-2 border border-surface-container-high shadow-xs">
            <span className="material-symbols-outlined text-outline text-[16px] mr-2">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drug rule..."
              className="w-full text-xs text-on-surface bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['All', 'Drug-Drug', 'Drug-Allergy', 'Drug-Condition', 'Renal Dose Adjustment'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              categoryFilter === cat
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container-lowest border border-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.map((rule) => {
          const isContra = rule.severity === 'contraindicated';

          return (
            <div
              key={rule.id}
              className={`p-5 rounded-2xl border transition-all ${
                rule.active
                  ? 'bg-surface-container-lowest border-surface-container-high shadow-xs hover:border-primary/40'
                  : 'bg-surface-container-low/40 border-dashed border-surface-container-high opacity-70'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-surface-container-low border border-surface-container-high font-bold text-xs text-primary font-mono">
                      {rule.drugA}
                    </span>
                    <span className="material-symbols-outlined text-outline text-[16px]">sync_alt</span>
                    <span className="px-3 py-1 rounded-lg bg-surface-container-low border border-surface-container-high font-bold text-xs text-primary font-mono">
                      {rule.drugB}
                    </span>
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-container-high text-on-surface-variant">
                    {rule.category}
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    isContra ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {rule.severity}
                  </span>
                </div>

                {/* Toggle Action */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-on-surface">
                    {rule.active ? 'Rule Active' : 'Disabled'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggle(rule.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      rule.active ? 'bg-primary' : 'bg-surface-container-high'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        rule.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <p className="text-xs text-on-surface-variant mt-3 leading-relaxed">
                {rule.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
