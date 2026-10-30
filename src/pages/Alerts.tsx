import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PrescriptionStorage as VirtualDb, getActiveClinicianName } from '../services/prescriptionService';
import { pullFromCloud } from '../services/cloudSyncService';
import { DrugInteractionAlert, SafetyCheckRecord } from '../types';
import AlertDetailDrawer from '../components/AlertDetailDrawer';
import EmailScheduleAlertModal from '../components/EmailScheduleAlertModal';
import { showConfirmation } from '../services/confirmation';
import {
  buildUnifiedAlertQueue,
  UnifiedQueueItem,
  MedicationScheduleItem,
} from '../services/medicationScheduleService';

export default function Alerts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState<'all' | 'entire' | 'safety' | 'intake' | 'expiry' | 'overridden'>('all');
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [activeDrawerAlert, setActiveDrawerAlert] = useState<DrugInteractionAlert | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const [checks, setChecks] = useState<SafetyCheckRecord[]>(() => {
    const raw = VirtualDb.getChecks();
    return raw && raw.length > 0 ? raw : [];
  });

  useEffect(() => {
    // Proactively pull latest checks & alerts from cloud database on view mount
    pullFromCloud().catch(() => {});

    const handleChecksSync = () => {
      setChecks(VirtualDb.getChecks());
    };
    window.addEventListener('smileclinic_checks_updated', handleChecksSync);
    window.addEventListener('storage', handleChecksSync);
    return () => {
      window.removeEventListener('smileclinic_checks_updated', handleChecksSync);
      window.removeEventListener('storage', handleChecksSync);
    };
  }, []);

  // Build unified alert queue including safety hazards, intake schedules, and course expirations
  const unifiedQueue = useMemo(() => buildUnifiedAlertQueue(checks), [checks]);

  // Extract all scheduled medications and safety alerts for email dispatch
  const allMedications: MedicationScheduleItem[] = useMemo(() => {
    const meds: MedicationScheduleItem[] = [];
    unifiedQueue.forEach((item) => {
      if (item.medication && !meds.some((m) => m.id === item.medication?.id)) {
        meds.push(item.medication);
      }
    });
    return meds;
  }, [unifiedQueue]);

  const allSafetyAlerts: DrugInteractionAlert[] = useMemo(() => {
    const alerts: DrugInteractionAlert[] = [];
    unifiedQueue.forEach((item) => {
      if (item.alert && !alerts.some((a) => a.id === item.alert?.id)) {
        alerts.push(item.alert);
      }
    });
    return alerts;
  }, [unifiedQueue]);

  const latestCheck = checks[0];

  // Exact counts strictly partitioned between active queue and overridden history
  const activeSafetyHazards = useMemo(
    () => unifiedQueue.filter((a) => a.type === 'safety_hazard' && !a.alert?.overridden),
    [unifiedQueue]
  );
  const intakeSchedules = useMemo(
    () => unifiedQueue.filter((a) => a.type === 'intake_schedule'),
    [unifiedQueue]
  );
  const courseExpiries = useMemo(
    () => unifiedQueue.filter((a) => a.type === 'course_expiry'),
    [unifiedQueue]
  );
  const overriddenAlerts = useMemo(
    () => unifiedQueue.filter((a) => !!a.alert?.overridden),
    [unifiedQueue]
  );

  const activeQueueCount = activeSafetyHazards.length + intakeSchedules.length + courseExpiries.length;

  // Dynamic Tabs with exact counts matching Dashboard metrics 1:1
  const availableTabs = [
    { key: 'all' as const, label: 'Active Alerts', count: activeQueueCount },
    { key: 'entire' as const, label: 'All Alerts & History', count: unifiedQueue.length },
    {
      key: 'safety' as const,
      label: 'Safety Hazards',
      count: activeSafetyHazards.length,
    },
    {
      key: 'intake' as const,
      label: 'Medication Intake (Timing)',
      count: intakeSchedules.length,
    },
    {
      key: 'expiry' as const,
      label: 'Course Expiration',
      count: courseExpiries.length,
    },
    {
      key: 'overridden' as const,
      label: 'Overridden / Documented',
      count: overriddenAlerts.length,
    },
  ].filter((tab) => tab.key === 'all' || tab.key === 'entire' || tab.key === 'overridden' || tab.count > 0);

  useEffect(() => {
    if (activeTab !== 'all' && !availableTabs.some((t) => t.key === activeTab)) {
      setActiveTab('all');
    }
  }, [availableTabs, activeTab]);

  // Filter items based on activeTab and searchTerm
  const filtered = useMemo(() => {
    return unifiedQueue.filter((item) => {
      let matchesTab = true;
      if (activeTab === 'all') matchesTab = !item.alert?.overridden;
      else if (activeTab === 'entire') matchesTab = true;
      else if (activeTab === 'safety') matchesTab = item.type === 'safety_hazard' && !item.alert?.overridden;
      else if (activeTab === 'intake') matchesTab = item.type === 'intake_schedule';
      else if (activeTab === 'expiry') matchesTab = item.type === 'course_expiry';
      else if (activeTab === 'overridden') matchesTab = !!item.alert?.overridden;

      const query = searchTerm.toLowerCase();
      const drugs = Array.isArray(item.interactingDrugs) ? item.interactingDrugs : [];
      const matchesSearch =
        !query ||
        (item.patientName || '').toLowerCase().includes(query) ||
        (item.mrn || '').toLowerCase().includes(query) ||
        (item.title || '').toLowerCase().includes(query) ||
        (item.subtitle || '').toLowerCase().includes(query) ||
        (item.scheduledTime || '').toLowerCase().includes(query) ||
        (item.foodInstruction || '').toLowerCase().includes(query) ||
        (item.drugName || '').toLowerCase().includes(query) ||
        drugs.some((d) => (d || '').toLowerCase().includes(query));

      return matchesTab && matchesSearch;
    });
  }, [unifiedQueue, activeTab, searchTerm]);

  // Pagination (10 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOverride = (alertId: string, reason: string) => {
    const target = unifiedQueue.find((a) => a.alert?.id === alertId);
    if (target) {
      VirtualDb.overrideAlert(target.checkId, alertId, reason, getActiveClinicianName());
      setChecks([...VirtualDb.getChecks()]);
      setActiveDrawerAlert(null);
      showConfirmation('Clinical decision signed & recorded into HIPAA audit trail', 'success');
    }
  };

  const handleSmsNotice = () => {
    showConfirmation('SMS Alert Service: Coming Soon (DLT Telecom Carrier registration in review)', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[26px]">alarm_on</span>
            <h1 className="text-2xl font-black text-on-surface">Medication Regimen & Safety Alert Queue</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time schedule of medication intake timing, course expiration alerts, and contraindicated drug hazards.
          </p>
        </div>

        {/* Action Buttons: Email and SMS */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleSmsNotice}
            className="px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-outline hover:text-on-surface text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="SMS Alerts"
          >
            <span className="material-symbols-outlined text-[16px]">sms</span>
            <span>SMS Alert</span>
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded text-[9px] font-extrabold uppercase">
              Coming Soon
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsEmailModalOpen(true)}
            disabled={allMedications.length === 0}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          >
            <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
            <span>Send Alert Email</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-md w-full">
        <div className="relative flex items-center bg-surface-container-lowest rounded-xl px-3 py-2 border border-surface-container-high shadow-xs focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <span className="material-symbols-outlined text-outline text-[18px] mr-2">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medication, intake time, patient, MRN..."
            className="w-full text-xs text-on-surface bg-transparent outline-none placeholder:text-outline font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-outline hover:text-on-surface cursor-pointer p-0.5 ml-1"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-surface-container-high pb-3 overflow-x-auto no-scrollbar">
        {availableTabs.map((tab) => (
          <motion.button
            type="button"
            key={tab.key}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === tab.key
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-surface-container-high'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface'
              }`}
            >
              {tab.count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Unified Queue Cards */}
      <div className="space-y-3.5">
        {paginatedItems.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-3xl border border-surface-container-high shadow-xs flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-on-surface">No alerts or schedules match this filter</h4>
              <p className="text-xs text-on-surface-variant max-w-sm mt-1">
                All medications are scheduled cleanly or all safety hazards have been documented and overridden.
              </p>
            </div>
            {overriddenAlerts.length > 0 && activeTab !== 'overridden' && (
              <button
                type="button"
                onClick={() => setActiveTab('overridden')}
                className="mt-1 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-800 border border-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                View Documented & Overridden Decisions ({overriddenAlerts.length}) →
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/check')}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Start New Prescription Check
            </button>
          </div>
        ) : (
          paginatedItems.map((item) => {
            const isHazard = item.type === 'safety_hazard';
            const isIntake = item.type === 'intake_schedule';
            const isExpiry = item.type === 'course_expiry';

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border shadow-xs transition-all space-y-3 ${
                  isHazard
                    ? item.severity === 'contraindicated'
                      ? 'border-rose-300/80 bg-rose-50/10'
                      : 'border-amber-300/80 bg-amber-50/10'
                    : isIntake
                    ? 'border-primary/30 hover:border-primary/60'
                    : item.isExpired
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-amber-400/60 bg-amber-50/10'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Pill */}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        isHazard
                          ? item.severity === 'contraindicated'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-900'
                          : isIntake
                          ? 'bg-primary/10 text-primary'
                          : item.isExpired
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {isHazard ? 'warning' : isIntake ? 'alarm' : 'event_busy'}
                      </span>
                      {isHazard
                        ? item.severity === 'contraindicated'
                          ? 'Contraindication Hazard'
                          : 'Major Interaction'
                        : isIntake
                        ? 'Scheduled Intake'
                        : item.isExpired
                        ? 'Course Ended (Stop Consumption)'
                        : 'Regimen Duration Notice'}
                    </span>

                    {/* Scheduled Time Pill for Intake */}
                    {isIntake && item.scheduledTime && (
                      <span className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 text-xs font-bold font-mono flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {item.scheduledTime}
                      </span>
                    )}

                    {/* Expiry Pill */}
                    {isExpiry && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono flex items-center gap-1 ${
                          item.isExpired ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">hourglass_bottom</span>
                        {item.isExpired ? 'EXPIRED — Stop Medicine' : `${item.daysRemaining} Days Left`}
                      </span>
                    )}

                    {/* Patient Identification */}
                    <span className="text-xs text-on-surface font-semibold">
                      {item.patientName} <span className="text-outline font-normal">({item.mrn})</span>
                    </span>

                    <span className="text-[11px] text-outline font-mono">• #{item.checkId}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => navigate(`/report?id=${item.checkId}`)}
                      className="px-3 py-1.5 rounded-xl bg-surface-container text-secondary font-bold text-xs hover:bg-surface-container-high transition-all flex items-center gap-1 border border-surface-container-high shadow-2xs cursor-pointer"
                      title="View Report"
                    >
                      <span className="material-symbols-outlined text-primary text-[15px]">description</span>
                      <span>Report</span>
                    </button>

                    {item.alert && (
                      <button
                        type="button"
                        onClick={() => setActiveDrawerAlert(item.alert!)}
                        className="px-3.5 py-1.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">menu_book</span>
                        <span>Monograph & Override</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Content Row */}
                <div>
                  <h3 className="text-sm font-black text-on-surface flex items-center gap-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{item.subtitle}</p>
                </div>

                {/* Detailed Medication Pill Bar */}
                {isIntake && item.medication && (
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2 text-on-surface">
                      <span className="material-symbols-outlined text-primary text-[18px]">restaurant</span>
                      <span>
                        Meal Timing: <strong>{item.medication.foodInstruction}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-outline text-[11px]">
                      <span>
                        Route: <strong>{item.medication.route}</strong>
                      </span>
                      <span>
                        Duration: <strong>{item.medication.duration}</strong>
                      </span>
                      <span>
                        Ends On: <strong>{item.medication.endDate}</strong>
                      </span>
                    </div>
                  </div>
                )}

                {/* Expiry Stop Consumption Warning */}
                {isExpiry && (
                  <div
                    className={`p-3 rounded-xl border text-xs leading-relaxed font-medium ${
                      item.isExpired
                        ? 'bg-rose-100/60 border-rose-200 text-rose-950'
                        : 'bg-amber-100/60 border-amber-200 text-amber-950'
                    }`}
                  >
                    {item.isExpired ? (
                      <>
                        🛑 <strong>Medical Protocol:</strong> The prescribed {item.medication?.duration || 'course'}{' '}
                        has elapsed. The patient must discontinue taking <strong>{item.drugName}</strong> unless
                        explicitly examined and re-authorized by the clinician.
                      </>
                    ) : (
                      <>
                        ⏳ <strong>Scheduled Stop Date: {item.medication?.endDate}</strong> ({item.daysRemaining} days
                        remaining). Advise patient to complete the exact course duration and not consume leftover
                        tablets afterwards.
                      </>
                    )}
                  </div>
                )}

                {/* Safety Hazard Details */}
                {isHazard && item.interactingDrugs && item.interactingDrugs.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-container-low text-xs">
                    <div className="flex items-center gap-2 text-on-surface-variant font-medium">
                      <span className="material-symbols-outlined text-primary text-[16px]">medication</span>
                      <span>
                        Interacting Agents:{' '}
                        <strong>
                          {Array.isArray(item.interactingDrugs)
                            ? item.interactingDrugs.join(' ↔ ')
                            : String(item.interactingDrugs)}
                        </strong>
                      </span>
                    </div>

                    <span className="text-[11px] text-outline font-medium">
                      Evidence Grade: <strong>{item.alert?.evidenceGrade || 'Level A (Direct CDS)'}</strong>
                    </span>
                  </div>
                )}

                {/* Overridden Justification Badge */}
                {item.alert?.overridden && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    <strong>Documented Justification:</strong> {item.alert.overrideReason} (Signed by{' '}
                    {item.alert.overrideAuthor})
                  </div>
                )}

                {/* Timestamp Footer */}
                <div className="text-[10px] text-outline pt-1 flex items-center justify-between">
                  <span>Mark of Date & Time: {item.timestamp}</span>
                  <span>SmileGuard Clinical CDS Engine</span>
                </div>
              </motion.div>
            );
          })
        )}

        {/* Pagination Bar */}
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs gap-3">
            <span className="text-xs text-on-surface-variant font-medium">
              Showing <strong className="text-on-surface font-semibold">{(currentPage - 1) * pageSize + 1}</strong>–
              <strong className="text-on-surface font-semibold">
                {Math.min(currentPage * pageSize, filtered.length)}
              </strong>{' '}
              of <strong className="text-on-surface font-semibold">{filtered.length}</strong> items in queue
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Previous</span>
              </button>

              <span className="text-xs font-bold text-outline px-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Monograph & Override Drawer */}
      <AlertDetailDrawer
        alert={activeDrawerAlert}
        isOpen={!!activeDrawerAlert}
        onClose={() => setActiveDrawerAlert(null)}
        onOverride={handleOverride}
      />

      {/* Email Schedule Alert Modal */}
      {latestCheck && (
        <EmailScheduleAlertModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          patientName={latestCheck.patientName || 'Karuna Chouhan'}
          patientMrn={latestCheck.mrn || 'PT-1102'}
          checkNumber={latestCheck.checkNumber || latestCheck.id || 'CHK-CURRENT'}
          medications={allMedications}
          safetyAlerts={allSafetyAlerts}
          courseEndDate={allMedications[0]?.endDate || 'In 30 Days'}
          regimenDuration={allMedications[0]?.duration || '1 Month'}
        />
      )}
    </div>
  );
}
