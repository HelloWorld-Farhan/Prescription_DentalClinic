import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PrescriptionStorage as VirtualDb, getActiveClinicianName } from '../services/prescriptionService';
import { SafetyCheckRecord, DrugInteractionAlert } from '../types';
import AlertDetailDrawer from '../components/AlertDetailDrawer';
import CustomDropdown from '../components/CustomDropdown';
import AnimatedCounter from '../components/AnimatedCounter';

interface LiveSyncBadgeProps {
  onSync: () => void;
}

const LiveSyncBadge = memo(function LiveSyncBadge({ onSync }: LiveSyncBadgeProps) {
  const [seconds, setSeconds] = useState(5);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsSyncing(true);
          onSync();
          setTimeout(() => setIsSyncing(false), 600);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onSync]);

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs shadow-xs border border-surface-container-high/60 select-none transform-gpu">
      <span className={`w-2 h-2 rounded-full transition-colors duration-200 ${isSyncing ? 'bg-amber-500' : 'bg-primary'}`}></span>
      <span className={`material-symbols-outlined text-[15px] text-primary transition-transform duration-300 ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
      <span className="font-medium">Live Sync: {isSyncing ? 'Syncing...' : `Just now (${seconds}s)`}</span>
    </div>
  );
});

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const [selectedUnit, setSelectedUnit] = useState('All Units');
  const [timeRange, setTimeRange] = useState('Today');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeDrawerAlert, setActiveDrawerAlert] = useState<DrugInteractionAlert | null>(null);
  const [activeDrawerCheckId, setActiveDrawerCheckId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [checks, setChecks] = useState<SafetyCheckRecord[]>(() => VirtualDb.getChecks());

  // Memoized metrics to prevent recalculation churn
  const highSeverityCount = useMemo(() => 
    checks.filter(c => c.alerts.some(a => a.severity === 'contraindicated' && !a.overridden)).length,
    [checks]
  );

  const inQueueCount = useMemo(() => 
    checks.filter(c => c.overallStatus === 'Requires Review' || c.overallStatus === 'Contraindicated').length,
    [checks]
  );

  const rulesCount = useMemo(() => VirtualDb.getRules().length, []);

  const priorityAlerts = useMemo(() => 
    checks
      .flatMap(c => (c.alerts || []).map(a => ({ check: c, alert: a })))
      .filter(item => (item.alert.severity === 'contraindicated' || item.alert.severity === 'major') && !item.alert.overridden)
      .slice(0, 3),
    [checks]
  );

  const units = useMemo(() => 
    ['All Units', ...Array.from(new Set(checks.map(c => c.unit).filter(Boolean)))],
    [checks]
  );

  const filteredChecks = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return checks.filter(c => {
      const matchesUnit = selectedUnit === 'All Units' || c.unit.toLowerCase().includes(selectedUnit.toLowerCase());
      if (!matchesUnit) return false;
      if (!q) return true;
      const drugNames = c.prescriptions ? c.prescriptions.map(p => p.drugName) : (c.prescribedDrugs || []);
      const pKey = c.patientKey || c.mrn;
      return (
        c.checkNumber.toLowerCase().includes(q) ||
        pKey.toLowerCase().includes(q) ||
        drugNames.some((d: string) => d.toLowerCase().includes(q)) ||
        c.unit.toLowerCase().includes(q)
      );
    });
  }, [checks, selectedUnit, searchFilter]);

  // 5 Recent Screening Checks per page pagination
  const [checksPage, setChecksPage] = useState(1);
  const checksPageSize = 5;

  useEffect(() => {
    setChecksPage(1);
  }, [searchFilter, selectedUnit]);

  const totalChecksPages = Math.max(1, Math.ceil(filteredChecks.length / checksPageSize));
  const paginatedChecks = useMemo(() => {
    return filteredChecks.slice((checksPage - 1) * checksPageSize, checksPage * checksPageSize);
  }, [filteredChecks, checksPage, checksPageSize]);

  useEffect(() => {
    if (!units.includes(selectedUnit)) {
      setSelectedUnit('All Units');
    }
  }, [units, selectedUnit]);

  // Stable sync handler: only trigger re-render if data actually changed
  const handleAutoSync = useCallback(() => {
    const fresh = VirtualDb.getChecks();
    setChecks(prev => {
      if (prev.length !== fresh.length) return fresh;
      if (prev.length > 0 && fresh.length > 0 && prev[0].id !== fresh[0].id) return fresh;
      return prev;
    });
  }, []);

  const handleInspect = useCallback((check: SafetyCheckRecord) => {
    if (check.alerts.length > 0) {
      setActiveDrawerAlert(check.alerts[0]);
      setActiveDrawerCheckId(check.id);
      setIsDrawerOpen(true);
    } else {
      navigate(`/report?id=${check.id}`);
    }
  }, [navigate]);

  const handleBatchSync = useCallback(() => {
    setIsBatchSyncing(true);
    setChecks(VirtualDb.getChecks());
    setTimeout(() => {
      setIsBatchSyncing(false);
    }, 600);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }
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
            <LiveSyncBadge onSync={handleAutoSync} />
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Real-time clinical drug-drug, dosing, renal clearance, and interaction screening feed.
          </p>
        </div>

        {/* Quick shift / dept / time filter with sliding layoutId indicator */}
        <div className="flex items-center gap-2 flex-wrap max-w-full">
          <div className="w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 max-w-full">
            <div className="inline-flex p-1 bg-surface-container-high rounded-xl text-on-surface whitespace-nowrap">
              {units.map((unit) => {
                const isSelected = selectedUnit === unit;
                return (
                  <motion.button
                    type="button"
                    key={unit}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedUnit(unit)}
                    className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors duration-150 ${
                      isSelected
                        ? 'text-primary font-bold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="activeUnitTab"
                        className="absolute inset-0 bg-surface-container-lowest rounded-lg shadow-2xs"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{unit}</span>
                  </motion.button>
                );
              })}
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

      {/* 2. FOUR STAT CARDS (Cascading Staggered Spring Entrance) */}
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
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-primary/50 cursor-pointer transition-colors duration-200 transform-gpu will-change-transform"
          onClick={() => navigate('/check')}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Checks Today</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                  <AnimatedCounter value={checks.length} />
                </span>
                <span className="inline-flex items-center text-xs text-primary font-bold">
                  <span className="material-symbols-outlined text-[14px]">
                    {checks.length > 0 ? 'trending_up' : 'check_circle'}
                  </span>
                  {checks.length > 0 ? '+100%' : 'Active'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors duration-200 shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">fact_check</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container">
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
                className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary hover:text-on-primary transition-colors duration-150 text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
                title="Start New Safety Check"
              >
                <span>New Check</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Alerts In Queue */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-[#975A16]/50 cursor-pointer transition-colors duration-200 transform-gpu will-change-transform"
          onClick={() => navigate('/alerts')}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Alerts In Queue</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                  <AnimatedCounter value={inQueueCount} />
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  inQueueCount > 0 ? 'bg-[#FEF3C7] text-[#975A16]' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {inQueueCount > 0 ? 'Action Req.' : 'Queue Clear'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#975A16] group-hover:bg-[#975A16] group-hover:text-white transition-colors duration-200 shadow-2xs">
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
              className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#975A16] bg-[#FEF3C7] hover:bg-[#975A16] hover:text-white transition-colors duration-150 text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
              title="Open Alerts Queue"
            >
              <span>View Queue</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </motion.div>

        {/* Card 3: Critical Safety Alerts */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className={`group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-colors duration-200 transform-gpu will-change-transform ${
            highSeverityCount > 0 ? 'hover:border-error/50' : 'hover:border-emerald-500/40'
          }`}
          onClick={() => navigate(highSeverityCount > 0 ? '/alerts?q=contraindicated' : '/alerts')}
          title="Critical Safety Alerts: Real-time contraindicated drug interactions & safety conflicts"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Critical Safety Alerts</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  highSeverityCount > 0 ? 'text-error' : 'text-on-surface'
                }`}>
                  <AnimatedCounter value={highSeverityCount} />
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  highSeverityCount > 0 ? 'bg-[#FFDAD6] text-[#BA1A1A]' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {highSeverityCount > 0 ? 'error' : 'check_circle'}
                  </span>
                  {highSeverityCount > 0 ? 'Urgent' : 'All Clear'}
                </span>
              </div>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 shadow-2xs ${
              highSeverityCount > 0
                ? 'bg-[#FFDAD6] text-[#BA1A1A] group-hover:bg-[#BA1A1A] group-hover:text-white'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 group-hover:bg-emerald-600 group-hover:text-white'
            }`}>
              <span className="material-symbols-outlined text-[22px]">
                {highSeverityCount > 0 ? 'warning' : 'health_and_safety'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-1 z-10">
            <p className="text-[11px] text-on-surface-variant truncate">
              {highSeverityCount > 0 ? `${highSeverityCount} critical flagged` : 'No active contraindications'}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(highSeverityCount > 0 ? '/alerts?q=contraindicated' : '/alerts');
              }}
              className={`group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors duration-150 text-[11px] font-bold shadow-2xs cursor-pointer shrink-0 ${
                highSeverityCount > 0
                  ? 'text-[#BA1A1A] bg-[#FFDAD6] hover:bg-[#BA1A1A] hover:text-white'
                  : 'text-on-surface-variant bg-surface-container-high hover:bg-primary hover:text-white'
              }`}
              title={highSeverityCount > 0 ? 'Inspect Urgent Contraindicated Alerts' : 'View Safety Alerts Queue'}
            >
              <span>{highSeverityCount > 0 ? 'Inspect Urgent' : 'View Queue'}</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </motion.div>

        {/* Card 4: Rules & Clinical Data */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-[#553C9A]/50 cursor-pointer transition-colors duration-200 transform-gpu will-change-transform"
          onClick={() => navigate('/rules')}
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Rules &amp; Data</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                  <AnimatedCounter value={rulesCount} />
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FAF5FF] text-[#553C9A] font-bold">
                  <span className="material-symbols-outlined text-[13px]">verified</span>
                  <span>Active Rules</span>
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#FAF5FF] flex items-center justify-center text-[#553C9A] group-hover:bg-[#553C9A] group-hover:text-white transition-colors duration-200 shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">database</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-1">
            <p className="text-[11px] text-on-surface-variant truncate">
              Clinical CDS rules &amp; knowledge base
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/rules');
              }}
              className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#553C9A] bg-[#FAF5FF] hover:bg-[#553C9A] hover:text-white transition-colors duration-150 text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
              title="Manage Clinical History & Data"
            >
              <span>History &amp; Data</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </motion.div>
      </motion.section>

      {/* 3. 2-COLUMN MAIN CONTENT (8 cols Left / 4 cols Right) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0 max-w-full">
        {/* LEFT COLUMN: Recent Checks Table */}
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
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleBatchSync}
                aria-label="Refresh check feed"
                className="p-2 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface transition-colors duration-150 cursor-pointer"
                title="Refresh feed"
              >
                <span className={`material-symbols-outlined text-[18px] ${isBatchSyncing ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </motion.button>
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
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate('/check')}
                          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-primary-hover transition-colors duration-150"
                        >
                          <span className="material-symbols-outlined text-[16px]">add_circle</span>
                          <span>Start New Safety Check</span>
                        </motion.button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedChecks.map((check) => {
                    const hasContra = check.alerts.some(a => a.severity === 'contraindicated');
                    const hasMajor = check.alerts.some(a => a.severity === 'major');

                    return (
                      <tr key={check.id} className="hover:bg-surface-container-low/60 transition-colors duration-150">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                            <span>{check.checkNumber}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(check.checkNumber)}
                              className="text-outline hover:text-primary transition-colors duration-150 cursor-pointer"
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
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => navigate(`/report?id=${check.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-secondary bg-surface-container hover:bg-surface-container-high transition-colors duration-150 text-xs font-bold border border-surface-container-high shadow-2xs cursor-pointer"
                              title="Open Clinical Decision Report"
                            >
                              <span className="material-symbols-outlined text-[15px] text-primary">description</span>
                              <span>Report</span>
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleInspect(check)}
                              className="px-3 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors duration-150 text-xs font-bold cursor-pointer"
                            >
                              Inspect
                            </motion.button>
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
            <span className="text-xs text-on-surface-variant font-medium">
              Showing <strong className="text-on-surface font-semibold">{filteredChecks.length === 0 ? 0 : (checksPage - 1) * checksPageSize + 1}</strong>–<strong className="text-on-surface font-semibold">{Math.min(checksPage * checksPageSize, filteredChecks.length)}</strong> of <strong className="text-on-surface font-semibold">{filteredChecks.length}</strong> screening checks
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={checksPage <= 1}
                onClick={() => setChecksPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                <span>Previous</span>
              </button>

              <span className="text-xs font-bold text-outline px-1">
                {checksPage} / {totalChecksPages}
              </span>

              <button
                type="button"
                disabled={checksPage >= totalChecksPages}
                onClick={() => setChecksPage((p) => Math.min(totalChecksPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>

              <div className="h-4 w-px bg-surface-container-high mx-1" />

              <button
                type="button"
                onClick={() => navigate('/audit-log')}
                className="text-xs text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer transition-colors duration-150 ml-1"
              >
                <span>View Full Audit Registry</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Action CTA & Critical Review Queue */}
        <div className="lg:col-span-4 flex flex-col gap-5 min-w-0 max-w-full">
          {/* CTAs Card */}
          <div className="flex flex-col gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/check')}
              className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary py-3 px-4 rounded-xl shadow-sm hover:bg-primary transition-colors duration-150 group text-sm font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                add_circle
              </span>
              <span>Start New Safety Check</span>
            </motion.button>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={handleBatchSync}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container shadow-xs text-xs font-semibold border border-surface-container-high transition-colors duration-150 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                <span>Batch EHR Sync</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/check')}
                className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container shadow-xs text-xs font-semibold border border-surface-container-high transition-colors duration-150 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                <span>Scan Rx Barcode</span>
              </motion.button>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/report')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-container-low text-secondary hover:bg-surface-container shadow-xs text-xs font-bold border border-surface-container-high transition-colors duration-150 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">description</span>
              <span>Open Printable CDS Verification Report</span>
            </motion.button>
          </div>

          {/* High Priority Queue Card */}
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
                  className="bg-surface-container-low rounded-xl p-3 flex flex-col gap-1 hover:bg-surface-container border border-surface-container-high/40 transition-colors duration-150"
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
          VirtualDb.overrideAlert(activeDrawerCheckId || checks[0]?.id, alertId, reason, getActiveClinicianName());
          setChecks([...VirtualDb.getChecks()]);
          setIsDrawerOpen(false);
          setToastMessage('Clinical decision signed & recorded into HIPAA audit trail');
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* Floating Signed Protocol Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
