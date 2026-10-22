import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VirtualDb } from '../data/virtualDb';
import { SafetyCheckRecord, DrugInteractionAlert } from '../types';
import PrintableReportModal from '../components/PrintableReportModal';
import AlertDetailDrawer from '../components/AlertDetailDrawer';

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedUnit, setSelectedUnit] = useState('All Units');
  const [timeRange, setTimeRange] = useState('Today');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeReportCheck, setActiveReportCheck] = useState<SafetyCheckRecord | null>(null);
  const [activeDrawerAlert, setActiveDrawerAlert] = useState<DrugInteractionAlert | null>(null);
  const [activeDrawerCheckId, setActiveDrawerCheckId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const checks = VirtualDb.getChecks();
  const highSeverityCount = checks.filter(c => c.alerts.some(a => a.severity === 'contraindicated' && !a.overridden)).length;
  const inQueueCount = checks.filter(c => c.overallStatus === 'Requires Review' || c.overallStatus === 'Contraindicated').length;

  const filteredChecks = checks.filter(c => {
    const matchesUnit = selectedUnit === 'All Units' || c.unit.toLowerCase().includes(selectedUnit.toLowerCase());
    const drugNames = c.prescriptions ? c.prescriptions.map(p => p.drugName) : (c.prescribedDrugs || []);
    const pKey = c.patientKey || c.mrn;
    const matchesSearch =
      c.checkNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      pKey.toLowerCase().includes(searchFilter.toLowerCase()) ||
      drugNames.some((d: string) => d.toLowerCase().includes(searchFilter.toLowerCase())) ||
      c.unit.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesUnit && matchesSearch;
  });

  const units = ['All Units', 'Dental Surgery', 'Emergency / ICU', 'Periodontics', 'General Operatory'];

  const handleInspect = (check: SafetyCheckRecord) => {
    if (check.alerts.length > 0) {
      setActiveDrawerAlert(check.alerts[0]);
      setActiveDrawerCheckId(check.id);
      setIsDrawerOpen(true);
    } else {
      setActiveReportCheck(check);
    }
  };

  const handleBatchSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* 1. TOP CONTEXT & FILTER BAR */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              Prescription Safety Dashboard
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs shadow-xs">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              <span>Auto-synced via FHIR R4: {isSyncing ? 'Syncing...' : 'Just now'}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Real-time clinical drug-drug, dosing, renal clearance, and interaction screening feed.
          </p>
        </div>

        {/* Quick shift / dept / time filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-surface-container-high rounded-xl text-on-surface">
            {units.map((unit) => (
              <button
                key={unit}
                onClick={() => setSelectedUnit(unit)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedUnit === unit
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-surface-container-highest mx-1 hidden sm:block"></div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-surface-container-lowest border border-surface-container-high text-on-surface text-xs font-medium px-3 py-2 rounded-xl shadow-xs outline-none cursor-pointer"
          >
            <option>Today</option>
            <option>Last 24 Hours</option>
            <option>Last 7 Days</option>
          </select>
        </div>
      </section>

      {/* 2. FOUR STAT CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Checks Today */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Checks Today</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">1,284</span>
                <span className="inline-flex items-center text-xs text-primary font-bold">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  +12.4%
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[22px]">fact_check</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container">
            {/* Mini sparkline */}
            <div className="flex items-end gap-1 h-5 mb-2 opacity-80">
              <div className="w-full bg-primary-fixed-dim rounded-t h-[40%]"></div>
              <div className="w-full bg-primary-fixed-dim rounded-t h-[60%]"></div>
              <div className="w-full bg-primary-fixed-dim rounded-t h-[55%]"></div>
              <div className="w-full bg-primary-fixed-dim rounded-t h-[80%]"></div>
              <div className="w-full bg-primary-fixed-dim rounded-t h-[70%]"></div>
              <div className="w-full bg-primary-container rounded-t h-[100%]"></div>
            </div>
            <p className="text-[11px] text-on-surface-variant truncate">189 auto-verified, 1,095 prescriber checked</p>
          </div>
        </div>

        {/* Card 2: Alerts In Queue */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Alerts In Queue</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">{inQueueCount || 23}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-[#FEF3C7] text-[#975A16] font-bold">
                  Action Req.
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#975A16]">
              <span className="material-symbols-outlined text-[22px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant">Median queue wait: <strong>3.8 mins</strong></span>
            <span className="material-symbols-outlined text-outline text-[16px]">schedule</span>
          </div>
        </div>

        {/* Card 3: High-Severity Open */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-error-container/30 pointer-events-none"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">High-Severity Open</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-error tracking-tight font-bold">{highSeverityCount || 7}</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-[#FFDAD6] text-[#BA1A1A] font-bold">
                  <span className="material-symbols-outlined text-[14px]">error</span>
                  Urgent
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FFDAD6] flex items-center justify-center text-[#BA1A1A]">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container">
            <p className="text-[11px] text-on-surface-variant">Critical contraindicated combinations flagged</p>
          </div>
        </div>

        {/* Card 4: Unable to Assess */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Unable to Assess</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">4</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FAF5FF] text-[#553C9A] font-bold">
                  <span className="material-symbols-outlined text-[13px]">help</span>
                  Missing Lab
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FAF5FF] flex items-center justify-center text-[#553C9A]">
              <span className="material-symbols-outlined text-[22px]">rule</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container">
            <p className="text-[11px] text-on-surface-variant truncate">Missing lab values / novel compounding</p>
          </div>
        </div>
      </section>

      {/* 3. 2-COLUMN MAIN CONTENT (8 cols Left / 4 cols Right) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (8 cols): Recent Checks Table */}
        <div className="lg:col-span-8 flex flex-col gap-4 bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-surface-container-high/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-on-surface tracking-tight">Recent Screening Checks</h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold">
                  {filteredChecks.length} entries
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">Live clinical interaction and regimen evaluation stream</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-surface-container-low px-3 py-1.5 rounded-xl text-on-surface border border-surface-container-high">
                <span className="material-symbols-outlined text-outline text-[18px] mr-1.5">filter_list</span>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter patient or drug..."
                  className="bg-transparent text-xs outline-none text-on-surface placeholder:text-outline w-36 sm:w-44"
                />
              </div>
              <button
                type="button"
                onClick={handleBatchSync}
                aria-label="Refresh check feed"
                className="p-2 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors"
                title="Refresh feed"
              >
                <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>
          </div>

          {/* Table Wrapper */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="text-outline text-xs uppercase tracking-wider border-b border-surface-container font-semibold">
                  <th className="py-2.5 px-2">Check ID</th>
                  <th className="py-2.5 px-2">Patient Key</th>
                  <th className="py-2.5 px-2">Prescribed Regimen</th>
                  <th className="py-2.5 px-2">Highest Severity</th>
                  <th className="py-2.5 px-2">Reviewer / Status</th>
                  <th className="py-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs text-on-surface">
                {filteredChecks.map((check) => {
                  const hasContra = check.alerts.some(a => a.severity === 'contraindicated');
                  const hasMajor = check.alerts.some(a => a.severity === 'major');

                  return (
                    <tr key={check.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                          <span>{check.checkNumber}</span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(check.checkNumber)}
                            className="text-outline hover:text-primary"
                            title="Copy ID"
                          >
                            <span className="material-symbols-outlined text-[13px]">content_copy</span>
                          </button>
                        </div>
                        <span className="text-[11px] text-outline">{check.timestamp}</span>
                      </td>

                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-secondary">shield</span>
                          <span className="font-semibold">{check.patientKey || check.mrn}</span>
                        </div>
                        <span className="text-[11px] text-outline">{check.unit}</span>
                      </td>

                      <td className="py-3 px-2 max-w-xs">
                        {check.prescriptions && check.prescriptions.length > 0 ? (
                          <>
                            <div className="font-medium text-on-surface truncate">
                              {check.prescriptions[0].drugName}
                            </div>
                            {check.prescriptions.length > 1 && (
                              <div className="text-[11px] text-on-surface-variant flex items-center gap-1 truncate">
                                <span className="material-symbols-outlined text-[13px] text-error">add</span>
                                <span>{check.prescriptions.slice(1).map(p => p.drugName).join(', ')}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="font-medium text-on-surface truncate">
                            {check.prescribedDrugs?.[0] || 'Unspecified'}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        {hasContra ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-[#FFDAD6] text-[#BA1A1A] font-bold">
                            <span className="material-symbols-outlined text-[14px]">error</span>
                            High Severity
                          </span>
                        ) : hasMajor ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-[#FEF3C7] text-[#975A16] font-bold">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            Moderate
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 font-bold">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Clear / Clean
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2">
                        <div className="inline-flex items-center gap-1.5 font-medium text-primary">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                          <span>{check.reviewerName || check.prescriberName}</span>
                        </div>
                        <div className="text-[11px] text-outline font-semibold">{check.overallStatus}</div>
                      </td>

                      <td className="py-3 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleInspect(check)}
                          className="px-3 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-bold"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer of Table */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-surface-container gap-2">
            <span className="text-xs text-on-surface-variant">
              Showing {filteredChecks.length} of {checks.length} screening checks
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/audit-log')}
                className="text-xs text-primary hover:underline font-bold flex items-center gap-1"
              >
                <span>View Full Audit Registry</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): Action CTA & Critical Review Queue */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* CTAs Card */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/check')}
              className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary py-3 px-4 rounded-xl shadow-sm hover:bg-primary transition-all group text-sm font-bold"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:scale-110">
                add_circle
              </span>
              <span>Start New Safety Check</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleBatchSync}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container shadow-xs text-xs font-semibold border border-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                <span>Batch EHR Sync</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/check')}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container shadow-xs text-xs font-semibold border border-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                <span>Scan Rx Barcode</span>
              </button>
            </div>
          </div>

          {/* High Priority Queue Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-on-surface">Needs Your Review</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FFDAD6] text-[#BA1A1A]">
                  {highSeverityCount || 3} Critical
                </span>
              </div>
              <span className="text-[11px] text-outline font-semibold">Urgency ↓</span>
            </div>

            {/* Priority Item 1 */}
            <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 transition-all hover:bg-surface-container border border-surface-container-high/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-on-surface">PT-9042-X</span>
                  <span className="text-outline text-xs block">Warfarin + Fluconazole</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FFDAD6] text-[#BA1A1A] font-bold">
                  Contraindicated
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1">
                CYP2C9 inhibition dramatically spikes free warfarin bioavailability and fatal bleeding risk.
              </p>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-surface-container-high">
                <span className="text-[10px] text-outline">Queue wait: 4m</span>
                <button
                  type="button"
                  onClick={() => {
                    const chk = checks[0];
                    handleInspect(chk);
                  }}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Review Alert →
                </button>
              </div>
            </div>

            {/* Priority Item 2 */}
            <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 transition-all hover:bg-surface-container border border-surface-container-high/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-on-surface">PT-3811-M</span>
                  <span className="text-outline text-xs block">Lisinopril + Spironolactone</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FEF3C7] text-[#975A16] font-bold">
                  Major
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1">
                Dual potassium-sparing effect risking acute hyperkalemia and cardiac arrhythmia.
              </p>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-surface-container-high">
                <span className="text-[10px] text-outline">Queue wait: 12m</span>
                <button
                  type="button"
                  onClick={() => {
                    const chk = checks[1] || checks[0];
                    handleInspect(chk);
                  }}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Review Alert →
                </button>
              </div>
            </div>

            {/* Priority Item 3 */}
            <div className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 transition-all hover:bg-surface-container border border-surface-container-high/40">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-on-surface">PT-1104-E</span>
                  <span className="text-outline text-xs block">Atorvastatin + Clarithromycin</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FFDAD6] text-[#BA1A1A] font-bold">
                  Contraindicated
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1">
                CYP3A4 blockade increases statin AUC by 400%, high danger of rhabdomyolysis.
              </p>
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-surface-container-high">
                <span className="text-[10px] text-outline">Queue wait: 1h 15m</span>
                <button
                  type="button"
                  onClick={() => {
                    const chk = checks[2] || checks[0];
                    handleInspect(chk);
                  }}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Review Alert →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modals & Drawers */}
      <AlertDetailDrawer
        alert={activeDrawerAlert}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onOverride={(alertId, reason) => {
          VirtualDb.overrideAlert(activeDrawerCheckId || checks[0]?.id, alertId, reason, 'Dr. Sarah Lin, PharmD');
          setIsDrawerOpen(false);
        }}
      />

      <PrintableReportModal
        check={activeReportCheck}
        isOpen={!!activeReportCheck}
        onClose={() => setActiveReportCheck(null)}
      />
    </div>
  );
}
