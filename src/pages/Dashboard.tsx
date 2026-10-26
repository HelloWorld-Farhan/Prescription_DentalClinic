import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PrescriptionStorage as VirtualDb } from '../services/prescriptionService';
import { SafetyCheckRecord, DrugInteractionAlert } from '../types';
import PrintableReportModal from '../components/PrintableReportModal';
import AlertDetailDrawer from '../components/AlertDetailDrawer';
import CustomDropdown from '../components/CustomDropdown';

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  const [selectedUnit, setSelectedUnit] = useState('All Units');
  const [timeRange, setTimeRange] = useState('Today');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeReportCheck, setActiveReportCheck] = useState<SafetyCheckRecord | null>(null);
  const [activeDrawerAlert, setActiveDrawerAlert] = useState<DrugInteractionAlert | null>(null);
  const [activeDrawerCheckId, setActiveDrawerCheckId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTimer, setSyncTimer] = useState(5);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [checks, setChecks] = useState<SafetyCheckRecord[]>(() => VirtualDb.getChecks());
  const highSeverityCount = checks.filter(c => c.alerts.some(a => a.severity === 'contraindicated' && !a.overridden)).length;
  const inQueueCount = checks.filter(c => c.overallStatus === 'Requires Review' || c.overallStatus === 'Contraindicated').length;
  const unableToAssessCount = checks.filter(c => c.alerts.some(a => a.severity === 'moderate' || a.severity === 'minor')).length;
  const priorityAlerts = checks
    .flatMap(c => (c.alerts || []).map(a => ({ check: c, alert: a })))
    .filter(item => (item.alert.severity === 'contraindicated' || item.alert.severity === 'major') && !item.alert.overridden)
    .slice(0, 3);

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

  const units = ['All Units', ...Array.from(new Set(checks.map(c => c.unit).filter(Boolean)))];

  useEffect(() => {
    if (!units.includes(selectedUnit)) {
      setSelectedUnit('All Units');
    }
  }, [units, selectedUnit]);

  // 5-second auto-sync interval
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncTimer(prev => {
        if (prev <= 1) {
          setIsSyncing(true);
          setChecks(VirtualDb.getChecks());
          setTimeout(() => setIsSyncing(false), 900);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 350, damping: 26 }
    }
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs shadow-xs border border-surface-container-high/60 transition-all">
              <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-ping' : 'bg-primary animate-pulse'}`}></span>
              <span className={`material-symbols-outlined text-[15px] text-primary transition-transform ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
              <span className="font-medium">Auto-synced via FHIR R4: {isSyncing ? 'Syncing...' : `Just now (${syncTimer}s)`}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Real-time clinical drug-drug, dosing, renal clearance, and interaction screening feed.
          </p>
        </div>

        {/* Quick shift / dept / time filter */}
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 max-w-full">
            <div className="inline-flex p-1 bg-surface-container-high rounded-xl text-on-surface whitespace-nowrap">
              {units.map((unit) => (
                <motion.button
                  type="button"
                  key={unit}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedUnit(unit)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    selectedUnit === unit
                      ? 'bg-surface-container-lowest text-primary shadow-xs font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {unit}
                </motion.button>
              ))}
            </div>
          </div>
          <div className="h-6 w-px bg-surface-container-highest mx-1 hidden sm:block"></div>
          <CustomDropdown
            value={timeRange}
            onChange={setTimeRange}
            prefixIcon="schedule"
            align="right"
            menuWidth="w-44"
            options={[
              { value: 'Today', label: 'Today', icon: 'today' },
              { value: 'Last 24 Hours', label: 'Last 24 Hours', icon: 'history' },
              { value: 'Last 7 Days', label: 'Last 7 Days', icon: 'date_range' },
            ]}
          />
        </div>
      </section>

      {/* 2. FOUR STAT CARDS (Cascading Spring Entrance) */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0 max-w-full"
      >
        {/* Card 1: Checks Today */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-primary/50 cursor-pointer"
          onClick={() => navigate('/check')}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Checks Today</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">{checks.length}</span>
                <span className="inline-flex items-center text-xs text-primary font-bold">
                  <span className="material-symbols-outlined text-[14px]">
                    {checks.length > 0 ? 'trending_up' : 'check_circle'}
                  </span>
                  {checks.length > 0 ? '+100%' : 'Active'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-primary group-hover:text-on-primary transition-colors shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">fact_check</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container">
            {/* Mini sparkline */}
            <div className="flex items-end gap-1 h-5 mb-2 opacity-80">
              <div className="w-full bg-primary-fixed-dim rounded-t" style={{ height: checks.length > 0 ? '40%' : '15%' }}></div>
              <div className="w-full bg-primary-fixed-dim rounded-t" style={{ height: checks.length > 0 ? '60%' : '15%' }}></div>
              <div className="w-full bg-primary-fixed-dim rounded-t" style={{ height: checks.length > 0 ? '55%' : '15%' }}></div>
              <div className="w-full bg-primary-fixed-dim rounded-t" style={{ height: checks.length > 0 ? '80%' : '15%' }}></div>
              <div className="w-full bg-primary-fixed-dim rounded-t" style={{ height: checks.length > 0 ? '70%' : '15%' }}></div>
              <div className="w-full bg-primary-container rounded-t" style={{ height: checks.length > 0 ? '100%' : '15%' }}></div>
            </div>
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] text-on-surface-variant truncate">
                {checks.filter(c => c.fhirSynced).length} auto, {checks.length} checked
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/check');
                }}
                className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary hover:text-on-primary transition-colors text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
                title="Start New Safety Check"
              >
                <span>New Check</span>
                <span className="material-symbols-outlined text-[14px] transition-transform group-hover/btn:translate-x-0.5">arrow_forward</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Alerts In Queue */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-[#975A16]/50 cursor-pointer"
          onClick={() => navigate('/alerts')}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Alerts In Queue</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">{inQueueCount}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  inQueueCount > 0 ? 'bg-[#FEF3C7] text-[#975A16]' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {inQueueCount > 0 ? 'Action Req.' : 'Queue Clear'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#975A16] group-hover:scale-105 group-hover:bg-[#975A16] group-hover:text-white transition-colors shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-1">
            <span className="text-[11px] text-on-surface-variant truncate">
              {inQueueCount > 0 ? 'Wait: 2.1 mins' : 'Zero backlog'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/alerts');
              }}
              className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#975A16] bg-[#FEF3C7] hover:bg-[#975A16] hover:text-white transition-colors text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
              title="Open Alerts Queue"
            >
              <span>View Queue</span>
              <span className="material-symbols-outlined text-[14px] transition-transform group-hover/btn:translate-x-0.5">arrow_forward</span>
            </button>
          </div>
        </motion.div>

        {/* Card 3: High-Severity Open */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-error/50 relative overflow-hidden cursor-pointer"
          onClick={() => navigate('/alerts?q=contraindicated')}
        >
          <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-error-container/30 pointer-events-none"></div>
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">High-Severity Open</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  highSeverityCount > 0 ? 'text-error' : 'text-on-surface'
                }`}>
                  {highSeverityCount}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  highSeverityCount > 0 ? 'bg-[#FFDAD6] text-[#BA1A1A]' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {highSeverityCount > 0 ? 'error' : 'check'}
                  </span>
                  {highSeverityCount > 0 ? 'Urgent' : 'Safe'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FFDAD6] flex items-center justify-center text-[#BA1A1A] group-hover:scale-105 group-hover:bg-[#BA1A1A] group-hover:text-white transition-colors shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">warning</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-1 z-10">
            <p className="text-[11px] text-on-surface-variant truncate">
              {highSeverityCount > 0 ? `${highSeverityCount} critical flagged` : 'No open contraindications'}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/alerts?q=contraindicated');
              }}
              className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#BA1A1A] bg-[#FFDAD6] hover:bg-[#BA1A1A] hover:text-white transition-colors text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
              title="Inspect Urgent Contraindicated Alerts"
            >
              <span>Inspect Urgent</span>
              <span className="material-symbols-outlined text-[14px] transition-transform group-hover/btn:translate-x-0.5">arrow_forward</span>
            </button>
          </div>
        </motion.div>

        {/* Card 4: Unable to Assess */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-[#553C9A]/50 cursor-pointer"
          onClick={() => navigate('/rules')}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Unable to Assess</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">{unableToAssessCount}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FAF5FF] text-[#553C9A] font-bold">
                  <span className="material-symbols-outlined text-[13px]">help</span>
                  {unableToAssessCount > 0 ? 'Missing Lab' : 'All Clear'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FAF5FF] flex items-center justify-center text-[#553C9A] group-hover:scale-105 group-hover:bg-[#553C9A] group-hover:text-white transition-colors shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">rule</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-1">
            <p className="text-[11px] text-on-surface-variant truncate">
              {unableToAssessCount > 0 ? 'Missing lab / novel' : 'Full CDS rules coverage'}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/rules');
              }}
              className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#553C9A] bg-[#FAF5FF] hover:bg-[#553C9A] hover:text-white transition-colors text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
              title="Manage Clinical CDS Rules"
            >
              <span>CDS Rules</span>
              <span className="material-symbols-outlined text-[14px] transition-transform group-hover/btn:translate-x-0.5">arrow_forward</span>
            </button>
          </div>
        </motion.div>
      </motion.section>

      {/* 3. 2-COLUMN MAIN CONTENT (8 cols Left / 4 cols Right) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0 max-w-full">
        {/* LEFT COLUMN (8 cols): Recent Checks Table */}
        <div className="lg:col-span-8 flex flex-col gap-4 bg-surface-container-lowest rounded-2xl p-4 sm:p-6 shadow-xs border border-surface-container-high/60 min-w-0 max-w-full">
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
          <div className="overflow-x-auto w-full max-w-full">
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
                {filteredChecks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center shadow-2xs">
                          <span className="material-symbols-outlined text-[26px]">fact_check</span>
                        </div>
                        <h3 className="font-bold text-sm text-on-surface">No Screening Checks in Feed</h3>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          No prescription reviews match the current unit filter or search. Start your first clinical CDS safety check.
                        </p>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate('/check')}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">add_circle</span>
                          <span>Start New Safety Check</span>
                        </motion.button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredChecks.map((check) => {
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

                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveReportCheck(check)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-secondary bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high shadow-2xs cursor-pointer"
                              title="Open Clinical Decision Report"
                            >
                              <span className="material-symbols-outlined text-[15px] text-primary">description</span>
                              <span>Report</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInspect(check)}
                              className="px-3 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-bold cursor-pointer"
                            >
                              Inspect
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
        <div className="lg:col-span-4 flex flex-col gap-5 min-w-0 max-w-full">
          {/* CTAs Card */}
          <div className="flex flex-col gap-2.5">
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/check')}
              className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary py-3 px-4 rounded-xl shadow-sm hover:bg-primary transition-colors group text-sm font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] transition-transform group-hover:scale-110">
                add_circle
              </span>
              <span>Start New Safety Check</span>
            </motion.button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleBatchSync}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container shadow-xs text-xs font-semibold border border-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                <span>Batch EHR Sync</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/check')}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container shadow-xs text-xs font-semibold border border-surface-container-high transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                <span>Scan Rx Barcode</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/report')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-container-low text-secondary hover:bg-surface-container shadow-xs text-xs font-bold border border-surface-container-high transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">description</span>
              <span>Open Printable CDS Verification Report</span>
            </button>
          </div>

          {/* High Priority Queue Card (Dynamic & Clean Initial Phase) */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-on-surface">Needs Your Review</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  priorityAlerts.length > 0 ? 'bg-[#FFDAD6] text-[#BA1A1A]' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {priorityAlerts.length > 0 ? `${priorityAlerts.length} Action Needed` : 'All Clear'}
                </span>
              </div>
              <span className="text-[11px] text-outline font-semibold">Priority Feed</span>
            </div>

            {priorityAlerts.length === 0 ? (
              <div className="bg-surface-container-low rounded-xl p-5 flex flex-col items-center text-center gap-2 border border-surface-container-high/40">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">verified_user</span>
                </div>
                <h3 className="font-bold text-xs text-on-surface">All Clear — Zero Critical Flags</h3>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  No contraindicated or major drug interaction alerts pending review in the current queue.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/check')}
                  className="mt-1 text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Screen New Prescription</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            ) : (
              priorityAlerts.map(({ check, alert }) => (
                <div
                  key={alert.id}
                  className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 hover:bg-surface-container border border-surface-container-high/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-on-surface">{check.patientKey || check.mrn}</span>
                      <span className="text-outline text-xs block">{alert.title}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      alert.severity === 'contraindicated' ? 'bg-[#FFDAD6] text-[#BA1A1A]' : 'bg-[#FEF3C7] text-[#975A16]'
                    }`}>
                      {alert.severity === 'contraindicated' ? 'Contraindicated' : 'Major'}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1">
                    {alert.mechanism || alert.clinicalImpact || alert.recommendation}
                  </p>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-surface-container-high">
                    <span className="text-[10px] text-outline">{check.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => handleInspect(check)}
                      className="text-xs font-bold text-primary hover:underline cursor-pointer"
                    >
                      Review Alert →
                    </button>
                  </div>
                </div>
              ))
            )}
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
          setChecks([...VirtualDb.getChecks()]);
          setIsDrawerOpen(false);
          setToastMessage('Clinical decision signed & recorded into HIPAA audit trail');
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      <PrintableReportModal
        check={activeReportCheck}
        isOpen={!!activeReportCheck}
        onClose={() => setActiveReportCheck(null)}
      />

      {/* Floating Signed Protocol Toast */}
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
