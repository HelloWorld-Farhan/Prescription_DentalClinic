import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';

import { useNavigate } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';

import { PrescriptionStorage as VirtualDb, getActiveClinicianName, isTodayIST, formatISTTime } from '../services/prescriptionService';
import { pullFromCloud } from '../services/cloudSyncService';

import { SafetyCheckRecord, DrugInteractionAlert, InteractionRule, AuditLogEntry } from '../types';

import AlertDetailDrawer from '../components/AlertDetailDrawer';
import PrescriptionCopyModal from '../components/PrescriptionCopyModal';

import CustomDropdown from '../components/CustomDropdown';

import AnimatedCounter from '../components/AnimatedCounter';

import { showConfirmation } from '../services/confirmation';



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
  const [reviewCopyModal, setReviewCopyModal] = useState<SafetyCheckRecord | null>(null);
  const [isCheckDropdownOpen, setIsCheckDropdownOpen] = useState(false);



  const [checks, setChecks] = useState<SafetyCheckRecord[]>(() => VirtualDb.getChecks());

  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(() => {

    const init = VirtualDb.getChecks();

    return init[0]?.id || null;

  });



  const selectedCheck = useMemo(() => {

    if (!checks || checks.length === 0) return null;

    return checks.find(c => c.id === selectedCheckId) || checks[0];

  }, [checks, selectedCheckId]);

  const selectedCheckIsOverridden = useMemo(() => {
    if (!selectedCheck) return false;
    const active = (selectedCheck.alerts || []).filter((a: any) => !a.overridden);
    return (
      selectedCheck.overallStatus === 'Doctor Notified' ||
      selectedCheck.overallStatus === 'Overridden' ||
      selectedCheck.status === 'overridden' ||
      ((selectedCheck.alerts || []).length > 0 && active.length === 0)
    );
  }, [selectedCheck]);

  const selectedCheckDoc = useMemo(() => {
    if (!selectedCheck) return null;
    if ((selectedCheck as any).doctorName) {
      let name = ((selectedCheck as any).doctorName || '').trim().replace(/^(?:dr|doctor)\.?\s+/i, '').trim();
      return { name, email: (selectedCheck as any).doctorEmail || '' };
    }
    const withDoc = (selectedCheck.alerts || []).find((a: any) => (a as any).doctorName || a.overrideReason);
    if (withDoc) {
      if ((withDoc as any).doctorName) {
        let name = ((withDoc as any).doctorName || '').trim().replace(/^(?:dr|doctor)\.?\s+/i, '').trim();
        return { name, email: (withDoc as any).doctorEmail || '' };
      }
      const m = (withDoc.overrideReason || '').match(/Dr\.?\s*([^(\],]+)(?:\s*\(([^)]+)\))?/i);
      if (m && m[1]) {
        let name = m[1].trim().replace(/^(?:dr|doctor)\.?\s+/i, '').trim();
        return { name, email: m[2] ? m[2].trim() : '' };
      }
    }
    return null;
  }, [selectedCheck]);

  const selectedCheckNotifiedDoctors = useMemo(() => {
    if (!selectedCheck || !selectedCheck.alerts) return [];
    const map = new Map<string, { name: string; email: string }>();
    (selectedCheck.alerts || []).forEach((a: any) => {
      if (a.overridden || a.overrideReason) {
        let name = a.doctorName || '';
        let email = a.doctorEmail || '';
        if ((!name || !email) && a.overrideReason) {
          const m = a.overrideReason.match(/Dr\.?\s*([^(\],]+)(?:\s*\(([^)]+)\))?/i);
          if (m && m[1]) {
            if (!name) name = m[1].trim();
            if (!email && m[2]) email = m[2].trim();
          }
          const m2 = a.overrideReason.match(/\[Prescriber:\s*([^(\],]+)(?:\s*\(([^)]+)\))?\]/i);
          if (m2 && m2[1]) {
            if (!name) name = m2[1].trim();
            if (!email && m2[2]) email = m2[2].trim();
          }
        }
        if (name || email) {
          name = name.replace(/^(?:dr|doctor)\.?\s+/i, '').trim();
          const key = (email || name).toLowerCase();
          if (!map.has(key)) {
            map.set(key, { name: name || email, email });
          }
        }
      }
    });
    if (map.size === 0 && selectedCheckDoc) {
      map.set((selectedCheckDoc.email || selectedCheckDoc.name).toLowerCase(), selectedCheckDoc);
    }
    return Array.from(map.values());
  }, [selectedCheck, selectedCheckDoc]);



  // Live ticking Indian Standard Time (IST) clock

  const [currentTimeIST, setCurrentTimeIST] = useState(() => formatISTTime(Date.now()));

  useEffect(() => {

    const timer = setInterval(() => {

      setCurrentTimeIST(formatISTTime(Date.now()));

    }, 15000);

    return () => clearInterval(timer);

  }, []);



  // State for interactive 6-day check activity bar hover
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // 1. Checks performed TODAY in Indian Standard Time (IST, UTC+5:30)
  // Automatically resets to 0 every day at 12:00 AM IST (midnight)
  const todayChecks = useMemo(() => {
    return checks.filter(c => isTodayIST(c.timestampMs || c.createdAt || c.id || c.timestamp));
  }, [checks]);

  // Rolling 6-Day Clinical Safety Activity Summaries (IST, UTC+5:30)
  // [Day -5, Day -4, Day -3, Day -2, Yesterday, Today]
  // Automatically drops off the oldest day at 12:00 AM IST midnight
  const sixDayCheckSummaries = useMemo(() => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const now = Date.now();

    // Group user checks by IST date key YYYY-MM-DD
    const checksByDateKey = new Map<string, SafetyCheckRecord[]>();
    for (const c of checks) {
      let ms = 0;
      if (typeof c.timestampMs === 'number' && c.timestampMs > 0) {
        ms = c.timestampMs;
      } else if (c.createdAt) {
        const parsed = new Date(c.createdAt).getTime();
        if (!isNaN(parsed)) ms = parsed;
      } else if (typeof c.timestamp === 'number' && c.timestamp > 0) {
        ms = c.timestamp;
      } else if (typeof c.id === 'string' && (c.id.startsWith('chk-') || c.id.startsWith('aud-'))) {
        const num = parseInt(c.id.split('-')[1], 10);
        if (!isNaN(num) && num > 1000000000000) ms = num;
      }

      if (ms > 0) {
        const dIST = new Date(ms + IST_OFFSET_MS);
        const key = `${dIST.getUTCFullYear()}-${String(dIST.getUTCMonth() + 1).padStart(2, '0')}-${String(dIST.getUTCDate()).padStart(2, '0')}`;
        const list = checksByDateKey.get(key) || [];
        list.push(c);
        checksByDateKey.set(key, list);
      }
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysOffsets = [5, 4, 3, 2, 1, 0];
    const summaries = [];

    for (const offset of daysOffsets) {
      const targetIST = new Date(now + IST_OFFSET_MS - offset * 86400000);
      const y = targetIST.getUTCFullYear();
      const m = targetIST.getUTCMonth();
      const d = targetIST.getUTCDate();
      const dateKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const monthStr = monthNames[m];
      const fullDateLabel = `${d} ${monthStr} ${y}`;

      let dayLabel = `${d} ${monthStr}`;
      if (offset === 0) dayLabel = 'Today';
      else if (offset === 1) dayLabel = 'Yesterday';

      const dayChecks = checksByDateKey.get(dateKey) || [];
      const patientSet = new Set<string>();
      let totalAlerts = 0;
      let worstSev = 'clear';

      for (const ch of dayChecks) {
        if (ch.patientName) patientSet.add(ch.patientName);
        if (Array.isArray(ch.alerts)) {
          totalAlerts += ch.alerts.length;
          for (const al of ch.alerts) {
            if (al.severity === 'contraindicated') worstSev = 'contraindicated';
            else if (al.severity === 'major' && worstSev !== 'contraindicated') worstSev = 'major';
            else if (al.severity === 'moderate' && worstSev === 'clear') worstSev = 'moderate';
          }
        }
      }

      summaries.push({
        dayOffset: offset,
        dateKey,
        dayLabel,
        fullDateLabel,
        count: dayChecks.length,
        checks: dayChecks,
        patientNames: Array.from(patientSet),
        alertsCount: totalAlerts,
        highestSeverity: worstSev,
        isToday: offset === 0,
        heightPercent: 15,
      });
    }

    const maxCount = Math.max(...summaries.map(s => s.count), 0);
    return summaries.map(s => {
      let pct = 15;
      if (maxCount > 0 && s.count > 0) {
        pct = Math.max(25, Math.round((s.count / maxCount) * 100));
      }
      return { ...s, heightPercent: pct };
    });
  }, [checks]);

  // Delta comparison between Today and Yesterday
  const deltaComparison = useMemo(() => {
    const todaySummary = sixDayCheckSummaries.find(s => s.dayOffset === 0);
    const yesterdaySummary = sixDayCheckSummaries.find(s => s.dayOffset === 1);
    const todayCount = todaySummary?.count || 0;
    const yesterdayCount = yesterdaySummary?.count || 0;

    if (yesterdayCount === 0) {
      if (todayCount === 0) {
        return {
          label: 'Resets 12 AM',
          icon: 'schedule',
          colorClass: 'text-primary font-bold',
        };
      }
      return {
        label: `+${todayCount * 100}% vs yesterday`,
        icon: 'trending_up',
        colorClass: 'text-primary font-bold',
      };
    }

    const diff = todayCount - yesterdayCount;
    const pct = Math.round((diff / yesterdayCount) * 100);

    if (pct > 0) {
      return {
        label: `+${pct}% vs yesterday`,
        icon: 'trending_up',
        colorClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
      };
    } else if (pct < 0) {
      return {
        label: `${pct}% vs yesterday`,
        icon: 'trending_down',
        colorClass: 'text-amber-600 dark:text-amber-400 font-bold',
      };
    } else {
      return {
        label: '0% vs yesterday',
        icon: 'trending_flat',
        colorClass: 'text-primary font-bold',
      };
    }
  }, [sixDayCheckSummaries]);



  // Latest check time today in Indian Standard Time

  const latestTodayCheckTime = useMemo(() => {

    if (todayChecks.length === 0) return null;

    const first = todayChecks[0];

    return formatISTTime(first.timestampMs || first.createdAt || first.id || first.timestamp);

  }, [todayChecks]);



  // 2. All active (unresolved / un-overridden) alerts in queue

  const activeAlerts = useMemo(() => {

    return checks.flatMap(c => (c.alerts || []).filter(a => !a.overridden));

  }, [checks]);

  const inQueueCount = activeAlerts.length;



  // 3. All active contraindicated (critical hazard) alerts

  const criticalAlerts = useMemo(() => {

    return checks.flatMap(c => (c.alerts || []).filter(a => a.severity === 'contraindicated' && !a.overridden));

  }, [checks]);

  const highSeverityCount = criticalAlerts.length;



  // 4. Active clinical rules with real-time update sync

  const [rules, setRules] = useState<InteractionRule[]>(() => VirtualDb.getRules());

  useEffect(() => {
    let isMounted = true;
    pullFromCloud().then(() => {
      if (!isMounted) return;
      setChecks(VirtualDb.getChecks());
      setRules(VirtualDb.getRules());
      setAuditLogs(VirtualDb.getAuditLogs());
    }).catch(() => {});

    const handleRulesSync = () => {
      setRules(VirtualDb.getRules());
    };

    const handleChecksSync = () => {
      const updated = VirtualDb.getChecks();
      setChecks(updated);
      setSelectedCheckId(prev => prev || updated[0]?.id || null);
    };

    const handleAuditSync = () => {
      setAuditLogs(VirtualDb.getAuditLogs());
    };

    const handleKnowledgeSync = () => {
      try {
        const raw = localStorage.getItem('smileclinic_synced_knowledge_selection');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setSyncedKnowledgeCount(parsed.length);
            return;
          }
        }
      } catch {}
      setSyncedKnowledgeCount(0);
    };

    window.addEventListener('smileclinic_rules_updated', handleRulesSync);
    window.addEventListener('smileclinic_checks_updated', handleChecksSync);
    window.addEventListener('smileclinic_documents_updated', handleChecksSync);
    window.addEventListener('smileclinic_audit_updated', handleAuditSync);
    window.addEventListener('smileclinic_knowledge_synced', handleKnowledgeSync);
    window.addEventListener('storage', handleRulesSync);
    window.addEventListener('storage', handleChecksSync);

    return () => {
      isMounted = false;
      window.removeEventListener('smileclinic_rules_updated', handleRulesSync);
      window.removeEventListener('smileclinic_checks_updated', handleChecksSync);
      window.removeEventListener('smileclinic_documents_updated', handleChecksSync);
      window.removeEventListener('smileclinic_audit_updated', handleAuditSync);
      window.removeEventListener('smileclinic_knowledge_synced', handleKnowledgeSync);
      window.removeEventListener('storage', handleRulesSync);
      window.removeEventListener('storage', handleChecksSync);
    };
  }, []);


  // Formatted Current Date in Indian Standard Time (IST)
  const currentDateIST = useMemo(() => {
    return new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, []);

  // Real-time Audit Log Entries for Metric Card
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => VirtualDb.getAuditLogs());
  const rulesCount = useMemo(() => rules.filter(r => r.active).length || rules.length, [rules]);
  const [syncedKnowledgeCount, setSyncedKnowledgeCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('smileclinic_synced_knowledge_selection');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {}
    return 0;
  });



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



  // Stable sync handler: refresh live cloud state from PostgreSQL and update memory stores
  const handleAutoSync = useCallback(async () => {
    await pullFromCloud().catch(() => {});
    const fresh = VirtualDb.getChecks();
    setChecks(fresh);
    setRules(VirtualDb.getRules());
    setAuditLogs(VirtualDb.getAuditLogs());
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



  const handleBatchSync = useCallback(async () => {
    if (isBatchSyncing) return;
    setIsBatchSyncing(true);
    showConfirmation('Connecting to EHR Gateway & reconciling FHIR v4 patient records...', 'info', 1500);
    try {
      await pullFromCloud();
      setChecks(VirtualDb.getChecks());
      setRules(VirtualDb.getRules());
      setAuditLogs(VirtualDb.getAuditLogs());
      showConfirmation('Batch EHR synchronization complete: all clinical records verified.', 'success');
    } catch {
      showConfirmation('Batch EHR sync encountered an issue; cached records active.', 'warning');
    } finally {
      setIsBatchSyncing(false);
    }
  }, [isBatchSyncing]);



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

          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}

          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-primary/50 cursor-pointer transition-colors duration-200 transform-gpu will-change-transform"

          onClick={() => navigate('/check')}

        >

          <div className="flex items-start justify-between">

            <div>

              <div className="flex items-center justify-between">

                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Checks Today</span>

                <span className="text-[10px] font-mono text-primary font-bold px-1.5 py-0.5 rounded-md bg-primary/10">

                  {currentDateIST}

                </span>

              </div>

              <div className="flex items-baseline gap-2 mt-1">

                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">

                  <AnimatedCounter value={todayChecks.length} />

                </span>

                <span className={`inline-flex items-center text-xs ${deltaComparison.colorClass}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {deltaComparison.icon}
                  </span>
                  {deltaComparison.label}
                </span>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors duration-200 shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">fact_check</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-container">
            {/* Dynamic 6-Day Rolling Clinical Safety Check Activity Bar Chart */}
            <div
              className="relative flex items-end gap-1.5 h-6 mb-2 pt-1"
              onMouseLeave={() => setHoveredBarIndex(null)}
            >
              {sixDayCheckSummaries.map((day, idx) => {
                const isHovered = hoveredBarIndex === idx;
                return (
                  <div
                    key={day.dateKey}
                    className="relative flex-1 h-full flex items-end cursor-pointer group/bar"
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setHoveredBarIndex(hoveredBarIndex === idx ? null : idx);
                    }}
                  >
                    {/* Floating Tooltip above Bar */}
                    {isHovered && (
                      <div
                        className="absolute bottom-full mb-1.5 z-30 pointer-events-none bg-surface-container-highest/95 backdrop-blur-md text-on-surface px-2.5 py-1.5 rounded-lg shadow-lg border border-surface-container-high text-[11px] whitespace-nowrap min-w-[135px] max-w-[200px]"
                        style={{
                          left: idx === 0 ? '0%' : idx === 5 ? '100%' : '50%',
                          transform: idx === 0 ? 'translateX(0%)' : idx === 5 ? 'translateX(-100%)' : 'translateX(-50%)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-surface-container-high/60 pb-1 mb-1 font-bold">
                          <span className={day.isToday ? 'text-primary font-extrabold' : 'text-on-surface'}>
                            {day.dayLabel}
                          </span>
                          <span className="text-[10px] text-outline font-mono">{day.fullDateLabel}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface">
                          <span className={`w-1.5 h-1.5 rounded-full ${day.count > 0 ? (day.highestSeverity === 'contraindicated' ? 'bg-error' : day.highestSeverity === 'major' ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-outline/40'}`}></span>
                          {day.count === 0 ? '0 Checks' : `${day.count} Safety Check${day.count > 1 ? 's' : ''}`}
                        </div>
                        {day.count > 0 ? (
                          <div className="text-[10px] text-on-surface-variant truncate mt-0.5">
                            {day.patientNames.length > 0 ? `Patient: ${day.patientNames.join(', ')}` : 'Screened prescription slip'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-outline/80 mt-0.5">
                            {day.isToday ? 'Awaiting checks today' : 'No checks on this day'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bar Element */}
                    <div
                      className={`w-full rounded-t transition-all duration-200 ${
                        day.isToday
                          ? day.count > 0
                            ? 'bg-primary group-hover/bar:bg-primary/90 shadow-2xs'
                            : 'bg-primary/25 border-t border-x border-primary/40'
                          : day.count > 0
                            ? 'bg-primary-fixed-dim group-hover/bar:bg-primary/70'
                            : 'bg-surface-container-high/70 group-hover/bar:bg-surface-container-highest'
                      } ${isHovered ? 'scale-y-110 opacity-100 ring-1 ring-primary/40' : 'opacity-85'}`}
                      style={{
                        height: `${day.heightPercent}%`,
                        minHeight: '4px',
                      }}
                      title={`${day.dayLabel} (${day.fullDateLabel}): ${day.count} checks`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] text-on-surface-variant truncate">
                {hoveredBarIndex !== null && sixDayCheckSummaries[hoveredBarIndex] ? (
                  <span>
                    <strong className="text-on-surface">{sixDayCheckSummaries[hoveredBarIndex].dayLabel}:</strong> {sixDayCheckSummaries[hoveredBarIndex].count} check{sixDayCheckSummaries[hoveredBarIndex].count !== 1 ? 's' : ''} ({sixDayCheckSummaries[hoveredBarIndex].fullDateLabel})
                  </span>
                ) : latestTodayCheckTime ? (
                  `Latest: ${latestTodayCheckTime} (${currentDateIST})`
                ) : (
                  `Today: ${currentDateIST} · Resets 12:00 AM IST`
                )}
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

          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}

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

              {inQueueCount > 0 ? `${inQueueCount} alerts awaiting review` : 'Zero backlog'}

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



        {/* Card 3: Audit Log (Updated per user request) */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between relative overflow-hidden cursor-pointer transition-colors duration-200 transform-gpu will-change-transform hover:border-primary/50"
          onClick={() => navigate('/audit-log')}
          title="HIPAA & Clinical Audit Trail: Immutable legal ledger and cryptographic verification"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Audit Log</span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-on-surface">
                  <AnimatedCounter value={auditLogs.length} />
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-[#005c65] border border-teal-200">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  HIPAA Notarized
                </span>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 shadow-2xs bg-teal-50 text-[#007782] border border-teal-200/60 group-hover:bg-[#007782] group-hover:text-white">
              <span className="material-symbols-outlined text-[22px]">policy</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-1 z-10">
            <p className="text-[11px] text-on-surface-variant truncate">
              {auditLogs.length} verified immutable records
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/audit-log');
              }}
              className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary hover:text-white transition-colors duration-150 text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
              title="Open HIPAA & Clinical Audit Log"
            >
              <span>View Audit Log</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </motion.div>



        {/* Card 4: Rules & Clinical Data */}

        <motion.div

          variants={cardVariants}

          whileHover={{ y: -4, scale: 1.01 }}

          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}

          className="group bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between hover:border-[#553C9A]/50 cursor-pointer transition-colors duration-200 transform-gpu will-change-transform"

          onClick={() => navigate('/rules')}

        >

          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Clinical Knowledge Base</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">
                  <AnimatedCounter value={syncedKnowledgeCount} />
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FAF5FF] text-[#553C9A] font-bold">
                  <span className="material-symbols-outlined text-[13px]">account_tree</span>
                  <span>Active in AI</span>
                </span>
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-[#FAF5FF] flex items-center justify-center text-[#553C9A] group-hover:bg-[#553C9A] group-hover:text-white transition-colors duration-200 shadow-2xs">
              <span className="material-symbols-outlined text-[22px]">account_tree</span>
            </div>
          </div>

          {/* All 3 Data Items Breakdown */}
          <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-surface-container text-center">
            <div className="bg-[#FAF5FF] rounded-lg py-1 px-1.5 flex flex-col items-center">
              <span className="text-xs font-extrabold text-[#553C9A] leading-tight">{syncedKnowledgeCount}</span>
              <span className="text-[10px] text-outline font-medium">Knowledge</span>
            </div>
            <div className="bg-teal-50 rounded-lg py-1 px-1.5 flex flex-col items-center">
              <span className="text-xs font-extrabold text-teal-800 leading-tight">{checks.length}</span>
              <span className="text-[10px] text-outline font-medium">Prescriptions</span>
            </div>
            <div className="bg-emerald-50 rounded-lg py-1 px-1.5 flex flex-col items-center">
              <span className="text-xs font-extrabold text-emerald-800 leading-tight">{rulesCount}</span>
              <span className="text-[10px] text-outline font-medium">History Rules</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-surface-container flex items-center justify-between gap-1">
            <p className="text-[11px] text-on-surface-variant truncate">
              Active CDS rules &amp; knowledge sources
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/rules');
              }}
              className="group/btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#553C9A] bg-[#FAF5FF] hover:bg-[#553C9A] hover:text-white transition-colors duration-150 text-[11px] font-bold shadow-2xs cursor-pointer shrink-0"
              title="Manage Clinical Knowledge Base & History"
            >
              <span>Knowledge Base</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>

          </div>

        </motion.div>

      </motion.section>



      {/* 3. 2-COLUMN MAIN CONTENT (8 cols Left / 4 cols Right) */}

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch min-w-0 max-w-full">

        {/* LEFT COLUMN: Recent Checks Table */}

        <div className="lg:col-span-8 flex flex-col justify-between bg-surface-container-lowest rounded-2xl p-4 sm:p-6 shadow-xs border border-surface-container-high/60 min-w-0 max-w-full h-full">

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



          {/* Table Wrapper (Minimal Clean Screening Feed) */}

          <div className="overflow-x-auto w-full max-w-full flex-1">

            <table className="w-full text-left border-collapse min-w-[600px]">

              <thead>

                <tr className="text-outline text-xs uppercase tracking-wider border-b border-surface-container font-semibold">

                  <th className="py-2.5 px-3 w-[140px] whitespace-nowrap">Check ID</th>

                  <th className="py-2.5 px-3 w-[130px] whitespace-nowrap">Patient</th>

                  <th className="py-2.5 px-3 min-w-[170px]">Regimen</th>

                  <th className="py-2.5 px-3 w-[120px] whitespace-nowrap">Safety</th>

                  <th className="py-2.5 px-3 w-[120px] text-right whitespace-nowrap">Action</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-surface-container text-xs text-on-surface">

                {filteredChecks.length === 0 ? (

                  <tr>

                    <td colSpan={5} className="py-14 text-center">

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

                    const activeAlerts = (check.alerts || []).filter(a => !a.overridden);

                    const isOverridden = check.overallStatus === 'Doctor Notified' || check.overallStatus === 'Overridden' || check.status === 'overridden' || ((check.alerts || []).length > 0 && activeAlerts.length === 0);

                    const hasContra = !isOverridden && activeAlerts.some(a => a.severity === 'contraindicated');

                    const hasMajor = !isOverridden && activeAlerts.some(a => a.severity === 'major');

                    const isSelected = selectedCheck?.id === check.id;

                    const rxCount = check.prescriptions?.length || check.prescribedDrugs?.length || 1;

                    const primaryDrug = check.prescriptions?.[0]?.drugName || check.prescribedDrugs?.[0] || 'Prescription Regimen';



                    return (

                      <tr

                        key={check.id}

                        onClick={() => setSelectedCheckId(check.id)}

                        className={`cursor-pointer transition-colors duration-150 border-l-[3px] ${

                          isSelected

                            ? 'bg-teal-50/80 dark:bg-teal-950/40 border-l-primary shadow-2xs'

                            : 'hover:bg-surface-container-low/60 border-l-transparent'

                        }`}

                      >

                        <td className="py-2.5 px-3 whitespace-nowrap">

                          <div className="flex items-center gap-1.5 font-mono font-bold text-xs text-primary">

                            <span>{check.checkNumber}</span>

                            <button

                              type="button"

                              onClick={(e) => {

                                e.stopPropagation();

                                navigator.clipboard.writeText(check.checkNumber);

                                showConfirmation(`Copied ${check.checkNumber}`, 'info', 1000);

                              }}

                              className="text-outline hover:text-primary transition-colors duration-150 cursor-pointer p-0.5 rounded hover:bg-primary/10"

                              title="Copy Check Number"

                            >

                              <span className="material-symbols-outlined text-[12px]">content_copy</span>

                            </button>

                            {isSelected && (

                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Currently Selected" />

                            )}

                          </div>

                          <span className="text-[10px] text-outline block">{check.timestamp}</span>

                        </td>



                        <td className="py-2.5 px-3 whitespace-nowrap">

                          <div className="font-bold text-xs text-on-surface">{check.patientKey || check.mrn}</div>

                          <span className="text-[10px] text-outline block">{check.unit}</span>

                        </td>



                        <td className="py-2.5 px-3">

                          <div className="flex items-center gap-1.5 text-xs">

                            <span className="font-semibold text-on-surface truncate max-w-[140px]" title={primaryDrug}>

                              {primaryDrug}

                            </span>

                            {rxCount > 1 && (

                              <span className="px-1.5 py-0.2 rounded-md bg-surface-container-high text-on-surface-variant text-[10px] font-bold shrink-0">

                                +{rxCount - 1} more

                              </span>

                            )}

                          </div>

                        </td>



                        <td className="py-2.5 px-3 whitespace-nowrap">

                          {isOverridden ? (

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold shadow-2xs whitespace-nowrap" title="Prescribing doctor notified">

                              <span className="material-symbols-outlined text-[12px]">send</span>

                              Doctor Notified

                            </span>

                          ) : hasContra ? (

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[#FFDAD6] text-[#BA1A1A] font-bold shadow-2xs whitespace-nowrap">

                              <span className="material-symbols-outlined text-[12px]">error</span>

                              Contraindicated

                            </span>

                          ) : hasMajor ? (

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[#FEF3C7] text-[#975A16] font-bold shadow-2xs whitespace-nowrap">

                              <span className="material-symbols-outlined text-[12px]">warning</span>

                              Major

                            </span>

                          ) : (

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold shadow-2xs whitespace-nowrap">

                              <span className="material-symbols-outlined text-[12px]">check_circle</span>

                              Safe

                            </span>

                          )}

                        </td>



                        <td className="py-2.5 px-3 text-right whitespace-nowrap">

                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>

                            <motion.button

                              type="button"

                              whileTap={{ scale: 0.98 }}

                              onClick={() => navigate(`/report?id=${check.id}`)}

                              className="px-2 py-1 rounded-lg text-secondary bg-surface-container hover:bg-surface-container-high transition-colors duration-150 text-xs font-bold border border-surface-container-high shadow-2xs cursor-pointer"

                              title="Open Clinical Decision Report PDF"

                            >

                              PDF

                            </motion.button>

                            <motion.button

                              type="button"

                              whileTap={{ scale: 0.98 }}

                              onClick={() => {
                                setSelectedCheckId(check.id);
                                setReviewCopyModal(check);
                              }}

                              className="px-2.5 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors duration-150 text-xs font-bold cursor-pointer"

                            >

                              Review

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

          <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-surface-container gap-2.5 w-full mt-auto">

            <span className="text-xs text-on-surface-variant font-medium text-center sm:text-left">

              Showing <strong className="text-on-surface font-semibold">{filteredChecks.length === 0 ? 0 : (checksPage - 1) * checksPageSize + 1}</strong>–<strong className="text-on-surface font-semibold">{Math.min(checksPage * checksPageSize, filteredChecks.length)}</strong> of <strong className="text-on-surface font-semibold">{filteredChecks.length}</strong> screening checks

            </span>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">

              <div className="flex items-center gap-1.5 shrink-0">

                <button

                  type="button"

                  disabled={checksPage <= 1}

                  onClick={() => setChecksPage((p) => Math.max(1, p - 1))}

                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"

                >

                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>

                  <span>Previous</span>

                </button>



                <span className="text-xs font-bold text-outline px-1.5 whitespace-nowrap font-mono">

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

              </div>



              <div className="hidden sm:block h-4 w-px bg-surface-container-high mx-1" />



              <button

                type="button"

                onClick={() => navigate('/audit-log')}

                className="text-xs text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer transition-colors duration-150 whitespace-nowrap"

              >

                <span>View Full Audit Registry</span>

                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>

              </button>

            </div>

          </div>

        </div>



        {/* RIGHT COLUMN: Action CTA & Critical Review Queue */}

        <div className="lg:col-span-4 flex flex-col gap-4 min-w-0 max-w-full h-full">

          {/* Quick CTAs */}

          <div className="flex flex-col gap-2">

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

                disabled={isBatchSyncing}

                onClick={handleBatchSync}

                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container shadow-xs text-xs font-semibold border border-surface-container-high transition-colors duration-150 cursor-pointer ${

                  isBatchSyncing ? 'opacity-75 cursor-wait' : ''

                }`}

              >

                <span className={`material-symbols-outlined text-[16px] ${isBatchSyncing ? 'animate-spin text-primary' : ''}`}>

                  {isBatchSyncing ? 'sync' : 'cloud_download'}

                </span>

                <span>{isBatchSyncing ? 'Syncing EHR...' : 'Batch EHR Sync'}</span>

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

          </div>



          {/* Unified Needs Review & Clinical Decision Support Section */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-xs border border-surface-container-high/60 flex flex-col justify-between gap-3.5 flex-1 max-h-[620px] overflow-hidden">
            {/* Header with Title and Current Status */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-container shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  selectedCheckIsOverridden
                    ? 'bg-emerald-100 text-emerald-800'
                    : selectedCheck?.overallStatus === 'Contraindicated'
                    ? 'bg-[#FFDAD6] text-[#BA1A1A]'
                    : selectedCheck?.overallStatus === 'Requires Review'
                    ? 'bg-[#FEF3C7] text-[#975A16]'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {selectedCheckIsOverridden
                      ? 'mark_email_read'
                      : selectedCheck?.overallStatus === 'Contraindicated'
                      ? 'warning'
                      : selectedCheck?.overallStatus === 'Requires Review'
                      ? 'rate_review'
                      : 'verified_user'}
                  </span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-on-surface">Screening Review</h2>
                  <p className="text-[11px] text-on-surface-variant">CDS Decision &amp; Regimen Details</p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  selectedCheckIsOverridden
                    ? 'bg-emerald-100 text-emerald-800 flex items-center gap-1'
                    : selectedCheck?.overallStatus === 'Contraindicated'
                    ? 'bg-[#FFDAD6] text-[#BA1A1A]'
                    : selectedCheck?.overallStatus === 'Requires Review'
                    ? 'bg-[#FEF3C7] text-[#975A16]'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedCheckIsOverridden && <span className="material-symbols-outlined text-[12px]">send</span>}
                  {selectedCheckIsOverridden
                    ? 'Doctor Notified'
                    : selectedCheck
                    ? (selectedCheck.overallStatus || 'Safe to Dispense')
                    : 'All Clear'}
                </span>
                {selectedCheckIsOverridden && selectedCheckNotifiedDoctors.length > 0 && (
                  <span
                    className="text-[10px] text-emerald-700 font-semibold truncate max-w-[200px]"
                    title={selectedCheckNotifiedDoctors.map(d => `Dr. ${d.name} (${d.email})`).join('; ')}
                  >
                    Dr. {selectedCheckNotifiedDoctors[0].name}
                    {selectedCheckNotifiedDoctors.length > 1 && ` +${selectedCheckNotifiedDoctors.length - 1} more`}
                  </span>
                )}
              </div>
            </div>

            {/* Check Selector Dropdown (Clean, compact picker allowing instant switching) */}
            {checks.length > 0 && selectedCheck && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCheckDropdownOpen(!isCheckDropdownOpen)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high hover:border-primary/40 text-xs font-semibold text-on-surface transition-colors cursor-pointer shadow-2xs"
                  title="Switch screening check"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[17px] text-primary shrink-0">fact_check</span>
                    <span className="font-mono font-bold text-primary">{selectedCheck.checkNumber || selectedCheck.id}</span>
                    <span className="text-outline truncate">· {selectedCheck.patientName || selectedCheck.patientKey || selectedCheck.mrn}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    <span className="text-[10px] text-outline font-mono hidden sm:inline">{selectedCheck.timestamp}</span>
                    <span className={`material-symbols-outlined text-[18px] text-outline transition-transform duration-150 ${isCheckDropdownOpen ? 'rotate-180 text-primary' : ''}`}>
                      expand_more
                    </span>
                  </div>
                </button>

                {isCheckDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsCheckDropdownOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface-container-lowest border border-surface-container-high rounded-xl shadow-xl p-1.5 max-h-56 overflow-y-auto no-scrollbar">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-outline border-b border-surface-container mb-1">
                        Select Screening Check ({checks.length})
                      </div>
                      {checks.map((chk) => {
                        const isChkSelected = chk.id === selectedCheck.id;
                        const chkActive = (chk.alerts || []).filter(a => !a.overridden);
                        const chkOverridden = chk.overallStatus === 'Doctor Notified' || chk.overallStatus === 'Overridden' || chk.status === 'overridden' || ((chk.alerts || []).length > 0 && chkActive.length === 0);
                        const isContra = !chkOverridden && chkActive.some(a => a.severity === 'contraindicated');
                        const isReview = !chkOverridden && (chk.overallStatus === 'Requires Review' || chkActive.length > 0);
                        return (
                          <button
                            key={chk.id}
                            type="button"
                            onClick={() => {
                              setSelectedCheckId(chk.id);
                              setIsCheckDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer ${
                              isChkSelected
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'hover:bg-surface-container-low text-on-surface'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono font-bold">{chk.checkNumber || chk.id}</span>
                              <span className="text-outline truncate">· {chk.patientName || chk.patientKey || chk.mrn}</span>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ml-1 shrink-0 ${
                              chkOverridden
                                ? 'bg-emerald-100 text-emerald-800'
                                : isContra
                                ? 'bg-[#FFDAD6] text-[#BA1A1A]'
                                : isReview
                                ? 'bg-[#FEF3C7] text-[#975A16]'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {chkOverridden ? 'Doctor Notified' : (chk.overallStatus || 'Safe')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Scrollable Per-Check Details Area (Strictly Bounded to Prevent Page Stretching) */}
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-0.5">
              {selectedCheck ? (
                <>
                  {/* Per-Check Alerts Section */}
                  {selectedCheck.alerts && selectedCheck.alerts.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 ${
                          selectedCheckIsOverridden ? 'text-emerald-700' : 'text-rose-600'
                        }`}>
                          <span className="material-symbols-outlined text-[14px]">
                            {selectedCheckIsOverridden ? 'task_alt' : 'warning'}
                          </span>
                          Clinical CDS Flags ({selectedCheck.alerts.length})
                          {selectedCheckIsOverridden && (
                            <span className="text-[10px] font-normal text-emerald-600 lowercase">(notified)</span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-outline">
                          {selectedCheck.unit || 'Dental Operatory'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {selectedCheck.alerts.map((alert: any, aIdx: number) => {
                          const isAlertOverridden = Boolean(alert.overridden || selectedCheckIsOverridden);
                          
                          let alertDocName = alert.doctorName || '';
                          let alertDocEmail = alert.doctorEmail || '';

                          if ((!alertDocName || !alertDocEmail) && alert.overrideReason) {
                            const m = alert.overrideReason.match(/Dr\.?\s*([^(\],]+)(?:\s*\(([^)]+)\))?/i);
                            if (m && m[1]) {
                              if (!alertDocName) alertDocName = m[1].trim();
                              if (!alertDocEmail && m[2]) alertDocEmail = m[2].trim();
                            }
                            const m2 = alert.overrideReason.match(/\[Prescriber:\s*([^(\],]+)(?:\s*\(([^)]+)\))?\]/i);
                            if (m2 && m2[1]) {
                              if (!alertDocName) alertDocName = m2[1].trim();
                              if (!alertDocEmail && m2[2]) alertDocEmail = m2[2].trim();
                            }
                          }

                          if (!alertDocName && selectedCheckDoc?.name) alertDocName = selectedCheckDoc.name;
                          if (!alertDocEmail && selectedCheckDoc?.email) alertDocEmail = selectedCheckDoc.email;

                          alertDocName = alertDocName.replace(/^(?:dr|doctor)\.?\s+/i, '').trim();
                          const alertSeverity = ((alert.severity || 'major') as string).toLowerCase();
                          const isContra = alertSeverity === 'contraindicated' || alertSeverity === 'critical';
                          const isMaj = alertSeverity === 'major' || alertSeverity === 'high';
                          const alertTitle =
                            alert.title ||
                            (alert.drugA && alert.drugB
                              ? `${alert.drugA} ↔ ${alert.drugB} Hazard`
                              : alert.name || (alert.category ? `${alert.category} Warning` : 'Clinical Interaction Hazard'));
                          const alertDesc =
                            alert.description ||
                            alert.mechanism ||
                            alert.clinicalImpact ||
                            alert.finding ||
                            'Clinical safety warning flagged during automated cross-check.';

                          if (isAlertOverridden) {
                            return (
                              <div
                                key={alert.id || `alt-${aIdx}`}
                                className="rounded-xl p-3 flex flex-col gap-2 border bg-emerald-50/70 border-emerald-200 text-emerald-950 shadow-2xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="material-symbols-outlined text-[16px] text-emerald-700 shrink-0">check_circle</span>
                                    <span className="font-bold text-xs leading-snug">{alertTitle}</span>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 bg-emerald-700 text-white flex items-center gap-0.5">
                                    <span className="material-symbols-outlined text-[10px]">send</span>
                                    Notified
                                  </span>
                                </div>

                                <div className="p-2 rounded-lg bg-emerald-100/70 border border-emerald-200/80 text-[11px] text-emerald-900 flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1 font-semibold">
                                    <span className="material-symbols-outlined text-[13px] text-emerald-800">stethoscope</span>
                                    <span>Prescribing Doctor Notified:</span>
                                    <span className="font-bold text-emerald-950">
                                      {alertDocName ? `Dr. ${alertDocName}` : 'Attending Prescriber'}
                                    </span>
                                  </div>
                                  {alertDocEmail && (
                                    <div className="flex items-center gap-1 text-[10px] text-emerald-800 font-mono pl-4">
                                      <span className="material-symbols-outlined text-[11px]">mail</span>
                                      <span>{alertDocEmail}</span>
                                    </div>
                                  )}
                                  {alert.overrideReason && (
                                    <div className="text-[10px] text-emerald-800 mt-1 pl-4 italic line-clamp-2">
                                      "{alert.overrideReason}"
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60 mt-0.5">
                                  <span className="text-[10px] text-emerald-700 font-semibold">
                                    {alert.category || 'Drug-Drug'} · Resolution Dispatched
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/report?id=${selectedCheck.id}`)}
                                    className="text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer flex items-center gap-0.5"
                                  >
                                    <span>View Directive PDF</span>
                                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={alert.id || `alt-${aIdx}`}
                              className={`rounded-xl p-3 flex flex-col gap-1.5 border transition-colors shadow-2xs ${
                                isContra
                                  ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                                  : isMaj
                                  ? 'bg-orange-50/80 border-orange-200 text-orange-950'
                                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-xs leading-snug">{alertTitle}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${
                                    isContra ? 'bg-rose-600 text-white' : 'bg-orange-600 text-white'
                                  }`}
                                >
                                  {alertSeverity}
                                </span>
                              </div>
                              <p className="text-[11px] leading-relaxed opacity-95 line-clamp-2">
                                {alertDesc}
                              </p>
                              <div className="flex items-center justify-between pt-1.5 border-t border-black/5 mt-0.5">
                                <span className="text-[10px] text-outline font-semibold">
                                  {alert.category || 'Drug-Drug'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(
                                      `/alerts?checkId=${encodeURIComponent(selectedCheck.id || selectedCheck.checkNumber)}&alertId=${encodeURIComponent(alert.id || alert.title || '')}`
                                    );
                                  }}
                                  className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-0.5"
                                >
                                  <span>Review &amp; Override</span>
                                  <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800 shadow-2xs">
                      <span className="material-symbols-outlined text-[22px] text-emerald-600 shrink-0">verified</span>
                      <div>
                        <span className="text-xs font-bold block">Safe to Dispense — All Clear</span>
                        <span className="text-[11px] text-emerald-700">
                          Zero contraindicated drug interactions or organ clearance warnings flagged.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Active Patient Regimen Summary */}
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-outline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] text-primary">medication</span>
                        Prescribed Regimen ({selectedCheck.prescriptions?.length || selectedCheck.prescribedDrugs?.length || 0})
                      </span>
                      <span className="font-mono text-[10px] text-outline">{selectedCheck.timestamp}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar">
                      {selectedCheck.prescriptions && selectedCheck.prescriptions.length > 0 ? (
                        selectedCheck.prescriptions.map((rx, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface text-[11px] font-semibold border border-surface-container-high/60 shadow-2xs"
                          >
                            <span>{rx.drugName}</span>
                            {rx.dosage && <span className="text-[10px] text-outline font-normal">({rx.dosage})</span>}
                          </span>
                        ))
                      ) : (
                        (selectedCheck.prescribedDrugs || ['Unspecified']).map((drug, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface text-[11px] font-semibold border border-surface-container-high/60 shadow-2xs"
                          >
                            <span>{drug}</span>
                          </span>
                        ))
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1.5 border-t border-surface-container">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-secondary">person_check</span>
                        <span>{selectedCheck.reviewerName || selectedCheck.prescriberName || 'Active Clinician'}</span>
                      </span>
                      <span className={`font-semibold ${selectedCheckIsOverridden ? 'text-emerald-800' : 'text-slate-700'}`}>
                        {selectedCheckIsOverridden ? 'Doctor Notified' : (selectedCheck.overallStatus || 'Attested')}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-5 text-center text-xs text-on-surface-variant">
                  No screening checks available.
                </div>
              )}
            </div>

            {/* Bottom Actions Bar (Firmly Anchored at Bottom) */}
            {selectedCheck && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-surface-container shrink-0">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/report?id=${selectedCheck.id}`)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-primary text-white hover:bg-primary-hover shadow-xs text-xs font-bold transition-colors cursor-pointer"
                  title={`Open Printable PDF Report for ${selectedCheck.checkNumber}`}
                >
                  <span className="material-symbols-outlined text-[16px]">description</span>
                  <span>Open PDF Report</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setReviewCopyModal(selectedCheck)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-surface-container-low text-primary hover:bg-surface-container shadow-xs text-xs font-bold border border-surface-container-high transition-colors cursor-pointer"
                  title="Review CDS decision, warnings, and attestation"
                >
                  <span className="material-symbols-outlined text-[16px]">rate_review</span>
                  <span>Review Check</span>
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Modals & Drawers */}

      <AlertDetailDrawer

        alert={activeDrawerAlert}

        isOpen={isDrawerOpen}

        onClose={() => setIsDrawerOpen(false)}
        checkId={activeDrawerCheckId || checks[0]?.id}

        onOverride={(alertId, reason) => {

          VirtualDb.overrideAlert(activeDrawerCheckId || checks[0]?.id, alertId, reason, getActiveClinicianName());

          setChecks([...VirtualDb.getChecks()]);

          setIsDrawerOpen(false);

          showConfirmation('Clinical decision signed & recorded into HIPAA audit trail', 'success');

        }}

      />

      {/* Prescription Copy & Clinical Review Modal */}
      <PrescriptionCopyModal
        isOpen={!!reviewCopyModal}
        onClose={() => setReviewCopyModal(null)}
        check={reviewCopyModal}
      />

    </div>

  );

}

