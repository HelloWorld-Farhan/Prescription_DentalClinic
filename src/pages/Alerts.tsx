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
  parseMedicationTiming,
  computeCourseDates,
  MedicationScheduleItem,
} from '../services/medicationScheduleService';

export default function Alerts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<'all' | 'safety' | 'cleared' | 'overridden'>('all');
  const [activeDrawerAlert, setActiveDrawerAlert] = useState<DrugInteractionAlert | null>(null);
  const [activeDrawerCheckId, setActiveDrawerCheckId] = useState<string>('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalCheck, setEmailModalCheck] = useState<SafetyCheckRecord | null>(null);

  // Master Email Alerts Toggle state (persisted)
  const [masterEmailAlertsEnabled, setMasterEmailAlertsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smileclinic_master_email_alerts_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Disabled Medication IDs for email alerts (per-medicine toggle)
  const [disabledMedAlertIds, setDisabledMedAlertIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('smileclinic_disabled_med_alert_ids');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [checks, setChecks] = useState<SafetyCheckRecord[]>(() => {
    const raw = VirtualDb.getChecks();
    return raw && raw.length > 0 ? raw : [];
  });

  // Expandable Accordion per check — default CLOSED (collapsed) so user opens on demand
  const [expandedCheckIds, setExpandedCheckIds] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    let isMounted = true;
    pullFromCloud().then(() => {
      if (!isMounted) return;
      const updated = VirtualDb.getChecks();
      setChecks(updated);
    }).catch(() => {});

    const handleChecksSync = () => {
      const updated = VirtualDb.getChecks();
      setChecks(updated);
      setExpandedCheckIds((prev) => {
        // preserve only checks already opened by the user
        const next = new Set<string>();
        prev.forEach((id) => {
          if (updated.some((c) => c.id === id)) next.add(id);
        });
        return next;
      });
    };
    window.addEventListener('smileclinic_checks_updated', handleChecksSync);
    window.addEventListener('storage', handleChecksSync);
    return () => {
      isMounted = false;
      window.removeEventListener('smileclinic_checks_updated', handleChecksSync);
      window.removeEventListener('storage', handleChecksSync);
    };
  }, []);

  const toggleCheckExpanded = (checkId: string) => {
    setExpandedCheckIds((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) {
        next.delete(checkId);
      } else {
        next.add(checkId);
      }
      return next;
    });
  };

  const toggleMasterEmail = () => {
    const next = !masterEmailAlertsEnabled;
    setMasterEmailAlertsEnabled(next);
    try {
      localStorage.setItem('smileclinic_master_email_alerts_enabled', String(next));
    } catch {}
    showConfirmation(
      next
        ? 'Automated Email Alerts are now ACTIVE for all scheduled prescriptions.'
        : 'Automated Email Alerts PAUSED. No alert emails will be dispatched.',
      next ? 'success' : 'info'
    );
  };

  const toggleMedEmailAlert = (medUniqueKey: string, drugName: string) => {
    setDisabledMedAlertIds((prev) => {
      const next = new Set(prev);
      const isCurrentlyDisabled = next.has(medUniqueKey);
      if (isCurrentlyDisabled) {
        next.delete(medUniqueKey);
        showConfirmation(`Email alerts for ${drugName} turned ON`, 'success');
      } else {
        next.add(medUniqueKey);
        showConfirmation(`Email alerts for ${drugName} turned OFF`, 'info');
      }
      try {
        localStorage.setItem('smileclinic_disabled_med_alert_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleSmsNotice = () => {
    showConfirmation('SMS Alert Service: Coming Soon (DLT Telecom Carrier gateway verification in progress)', 'info');
  };

  const handleOverride = (alertId: string, reason: string) => {
    if (activeDrawerCheckId) {
      VirtualDb.overrideAlert(activeDrawerCheckId, alertId, reason, getActiveClinicianName());
      setChecks([...VirtualDb.getChecks()]);
      setActiveDrawerAlert(null);
      showConfirmation('Clinical decision signed & recorded into HIPAA audit trail', 'success');
    }
  };

  // Grouped analysis: Enrich each check with parsed medications
  const enrichedChecks = useMemo(() => {
    return checks.map((c) => {
      const prescriptions = Array.isArray(c.prescriptions) ? c.prescriptions : [];
      const alerts = Array.isArray(c.alerts) ? c.alerts : [];

      const activeAlerts = alerts.filter((a) => !a.overridden);
      const overriddenAlerts = alerts.filter((a) => !!a.overridden);

      const parsedMeds = prescriptions.map((rx, idx) => {
        const drugName = rx.drugName || (rx as any).name || 'Medication';
        const dosage = rx.dosage || '';
        const freq = rx.frequency || 'OD';
        const duration = rx.duration || '1 Month';
        const timingInfo = parseMedicationTiming(freq, drugName);
        const course = computeCourseDates(duration, c.createdAt);
        const uniqueKey = `med-${c.id}-${drugName}-${idx}`;
        const isEmailEnabled = masterEmailAlertsEnabled && !disabledMedAlertIds.has(uniqueKey);

        const scheduleItem: MedicationScheduleItem = {
          id: uniqueKey,
          checkId: c.id,
          patientName: c.patientName,
          patientMrn: c.mrn,
          drugName,
          dosage,
          frequency: freq,
          route: rx.route || 'Oral (PO)',
          duration,
          scheduledTime: timingInfo.scheduledTime,
          foodInstruction: timingInfo.foodInstruction,
          timeSlot: timingInfo.timeSlot,
          startDate: course.startDate,
          endDate: course.endDate,
          daysRemaining: course.daysRemaining,
          isExpired: course.isExpired,
          timestamp: c.timestamp,
        };

        return {
          uniqueKey,
          drugName,
          dosage,
          frequency: freq,
          route: rx.route || 'Oral (PO)',
          duration,
          timingInfo,
          course,
          isEmailEnabled,
          scheduleItem,
        };
      });

      return {
        check: c,
        prescriptions,
        alerts,
        activeAlerts,
        overriddenAlerts,
        parsedMeds,
        hasHazards: activeAlerts.length > 0,
      };
    });
  }, [checks, masterEmailAlertsEnabled, disabledMedAlertIds]);

  // Tab filtering
  const filteredChecks = useMemo(() => {
    return enrichedChecks.filter((item) => {
      let matchesTab = true;
      if (activeTab === 'safety') matchesTab = item.hasHazards;
      else if (activeTab === 'cleared') matchesTab = !item.hasHazards;
      else if (activeTab === 'overridden') matchesTab = item.overriddenAlerts.length > 0;

      const q = searchTerm.trim().toLowerCase();
      if (!q) return matchesTab;

      const c = item.check;
      const matchesSearch =
        (c.patientName || '').toLowerCase().includes(q) ||
        (c.mrn || '').toLowerCase().includes(q) ||
        (c.id || '').toLowerCase().includes(q) ||
        item.parsedMeds.some((m) => m.drugName.toLowerCase().includes(q)) ||
        item.alerts.some((a) => (a.title || '').toLowerCase().includes(q));

      return matchesTab && matchesSearch;
    });
  }, [enrichedChecks, activeTab, searchTerm]);

  // Tab Counts
  const hazardCount = enrichedChecks.filter((i) => i.hasHazards).length;
  const clearedCount = enrichedChecks.filter((i) => !i.hasHazards).length;
  const overriddenCount = enrichedChecks.filter((i) => i.overriddenAlerts.length > 0).length;

  const tabs = [
    { key: 'all' as const, label: 'All Prescriptions (PDFs)', count: enrichedChecks.length },
    { key: 'safety' as const, label: 'Safety Hazards', count: hazardCount },
    { key: 'cleared' as const, label: 'Safe & Cleared', count: clearedCount },
    { key: 'overridden' as const, label: 'Documented / Overrides', count: overriddenCount },
  ];

  // All active medications across enabled items for global email modal
  const allActiveMedications = useMemo(() => {
    const list: MedicationScheduleItem[] = [];
    enrichedChecks.forEach((ec) => {
      ec.parsedMeds.forEach((m) => {
        if (m.isEmailEnabled) {
          list.push(m.scheduleItem);
        }
      });
    });
    return list;
  }, [enrichedChecks]);

  const allActiveAlerts = useMemo(() => {
    const list: DrugInteractionAlert[] = [];
    enrichedChecks.forEach((ec) => {
      ec.activeAlerts.forEach((a) => list.push(a));
    });
    return list;
  }, [enrichedChecks]);

  const targetModalCheck = emailModalCheck || checks[0];

  return (
    <div className="space-y-6">
      {/* Page Header with Action Bar & Master Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[26px]">alarm_on</span>
            <h1 className="text-2xl font-black text-on-surface">Medication Regimen & Safety Alert Queue</h1>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Prescription regimens, scheduled intake timing, course durations, and clinical contraindications.
          </p>
        </div>

        {/* Action Controls: Merged Send/Toggle Alert Email & SMS Alert */}
        <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
          {/* SMS Alert (Blocked for Now) */}
          <button
            type="button"
            onClick={handleSmsNotice}
            className="px-3 py-2 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-outline hover:text-on-surface text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer opacity-85"
            title="SMS Alerts: Blocked for now (Carrier DLT Registration in Progress)"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-600">block</span>
            <span>SMS Alert</span>
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300/70 rounded text-[9px] font-extrabold uppercase tracking-wide">
              Blocked for now
            </span>
          </button>

          {/* Merged Unified Email Alert Control (Action Button + ON/OFF Master Toggle in One) */}
          <div className="inline-flex items-center rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-xs overflow-hidden">
            {/* Click to send/preview alert email */}
            <button
              type="button"
              onClick={() => {
                if (!masterEmailAlertsEnabled) {
                  showConfirmation(
                    'Email alerts are currently turned OFF. Turn the toggle ON to dispatch emails.',
                    'warning'
                  );
                  return;
                }
                setEmailModalCheck(null);
                setIsEmailModalOpen(true);
              }}
              disabled={allActiveMedications.length === 0}
              className={`px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                masterEmailAlertsEnabled
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'bg-surface-container text-outline hover:text-on-surface'
              }`}
              title={
                masterEmailAlertsEnabled
                  ? 'Dispatch unified medication alert email for all active prescriptions'
                  : 'Email alerts are paused. Toggle switch to turn ON.'
              }
            >
              <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
              <span>{masterEmailAlertsEnabled ? 'Send Alert Email' : 'Email Alerts: OFF'}</span>
            </button>

            {/* Integrated Master ON/OFF Switch */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container-low border-l border-surface-container-high">
              <span
                className={`w-2 h-2 rounded-full ${
                  masterEmailAlertsEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
                title={masterEmailAlertsEnabled ? 'Email sending active' : 'Email sending paused'}
              />
              <button
                type="button"
                onClick={toggleMasterEmail}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  masterEmailAlertsEnabled ? 'bg-primary' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={masterEmailAlertsEnabled}
                title={`Click to turn email alerts ${masterEmailAlertsEnabled ? 'OFF' : 'ON'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    masterEmailAlertsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <motion.button
              type="button"
              key={tab.key}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface border border-surface-container-high'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface'
                }`}
              >
                {tab.count}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Prescription-Centric Queue Cards (Showing the 2 Prescription PDFs) */}
      <div className="space-y-4">
        {filteredChecks.length === 0 ? (
          <div className="p-12 text-center bg-surface-container-lowest rounded-3xl border border-surface-container-high shadow-xs flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-on-surface">No prescription dossiers match this filter</h4>
              <p className="text-xs text-on-surface-variant max-w-sm mt-1">
                All medications are scheduled cleanly or all safety hazards have been reviewed and documented.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/check')}
              className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Start New Prescription Check
            </button>
          </div>
        ) : (
          filteredChecks.map((group) => {
            const { check: c, parsedMeds, activeAlerts, hasHazards } = group;
            const isExpanded = expandedCheckIds.has(c.id);

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl bg-surface-container-lowest border shadow-xs overflow-hidden transition-all ${
                  hasHazards ? 'border-rose-300/80' : 'border-surface-container-high hover:border-primary/40'
                }`}
              >
                {/* Prescription Card Header Bar */}
                <div
                  onClick={() => toggleCheckExpanded(c.id)}
                  className="p-4 sm:p-5 bg-surface-container-lowest hover:bg-surface-container-low/50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-low"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        hasHazards ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        {hasHazards ? 'warning' : 'description'}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-on-surface">
                          Prescription #{c.checkNumber || c.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            hasHazards ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c.overallStatus || (hasHazards ? 'Requires Review' : 'Safe to Dispense')}
                        </span>
                        <span className="text-[11px] text-outline">• {c.timestamp || 'Recently'}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-on-surface-variant flex-wrap">
                        <span className="font-semibold text-on-surface">
                          {c.patientName} <strong className="text-outline font-normal">({c.mrn})</strong>
                        </span>
                        <span className="text-outline">•</span>
                        <span>{parsedMeds.length} Prescribed Medications</span>
                        {activeAlerts.length > 0 && (
                          <>
                            <span className="text-outline">•</span>
                            <span className="text-rose-600 font-bold">
                              {activeAlerts.length} Clinical Safety Hazard{activeAlerts.length === 1 ? '' : 's'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    {/* View Respective PDF / Report */}
                    <button
                      type="button"
                      onClick={() => navigate(`/report?id=${c.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-surface-container text-secondary font-bold text-xs hover:bg-surface-container-high transition-all flex items-center gap-1.5 border border-surface-container-high shadow-2xs cursor-pointer"
                      title="Open Respective 2-Page CDS Report & PDF"
                    >
                      <span className="material-symbols-outlined text-primary text-[16px]">picture_as_pdf</span>
                      <span>PDF Report</span>
                    </button>

                    {/* Send Alert Email for this Prescription */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!masterEmailAlertsEnabled) {
                          showConfirmation(
                            'Automated email alerts are currently turned OFF. Enable the top toggle first.',
                            'warning'
                          );
                          return;
                        }
                        setEmailModalCheck(c);
                        setIsEmailModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      title="Send Daily Medication Timetable Email"
                    >
                      <span className="material-symbols-outlined text-[15px]">send</span>
                      <span>Send Email</span>
                    </button>

                    {/* Expand/Collapse Caret */}
                    <button
                      type="button"
                      onClick={() => toggleCheckExpanded(c.id)}
                      className="p-1.5 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-colors cursor-pointer"
                      title={isExpanded ? 'Collapse Medication Schedule' : 'Expand Medication Schedule'}
                    >
                      <span className="material-symbols-outlined text-[20px] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        expand_more
                      </span>
                    </button>
                  </div>
                </div>

                {/* Dropdown Body: Medicines Timetable & Dates */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="p-4 sm:p-5 bg-surface-container-lowest space-y-4"
                    >
                      {/* Active Safety Hazards (if any) */}
                      {activeAlerts.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-rose-600">warning</span>
                            Prescription Safety & Interaction Hazards ({activeAlerts.length})
                          </h4>
                          <div className="grid grid-cols-1 gap-2.5">
                            {activeAlerts.map((al, alIdx) => (
                              <div
                                key={al.id || `al-${alIdx}`}
                                className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white">
                                      {al.severity || 'Contraindicated'}
                                    </span>
                                    <h5 className="text-xs font-bold text-rose-950 truncate">{al.title}</h5>
                                  </div>
                                  <p className="text-[11px] text-rose-900 leading-relaxed">
                                    {al.mechanism || al.description || 'Clinical hazard detected.'}
                                  </p>
                                  {al.recommendation && (
                                    <p className="text-[11px] text-rose-800 font-medium">
                                      Action: {al.recommendation}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDrawerCheckId(c.id);
                                    setActiveDrawerAlert(al);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shrink-0 shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[15px]">menu_book</span>
                                  <span>Monograph & Override</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Prescribed Medications Timetable & Regimen Duration */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[15px] text-primary">schedule</span>
                            Medication Schedule & Expiry Timetable ({parsedMeds.length} Items)
                          </h4>
                          <span className="text-[11px] text-outline font-medium">
                            Food & Timing Instructions for {c.patientName}
                          </span>
                        </div>

                        <div className="divide-y divide-surface-container-low border border-surface-container-high rounded-xl overflow-hidden bg-surface-container-lowest">
                          {parsedMeds.map((med) => {
                            const { uniqueKey, drugName, dosage, frequency, route, duration, timingInfo, course, isEmailEnabled } = med;

                            return (
                              <div
                                key={uniqueKey}
                                className="p-3.5 sm:p-4 hover:bg-surface-container-low/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                              >
                                {/* Left: Drug Name, Timing & Food Instruction */}
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-xs sm:text-sm text-on-surface">
                                      {drugName} {dosage}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-[10px] font-bold">
                                      {frequency}
                                    </span>
                                    <span className="text-[10px] text-outline font-medium">
                                      Route: {route}
                                    </span>
                                  </div>

                                  {/* Intake Timing & Meal Guidelines */}
                                  <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-900 font-bold font-mono text-[11px] flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[13px]">alarm</span>
                                      {timingInfo.scheduledTime}
                                    </span>
                                    <span className="text-outline font-medium">
                                      • {timingInfo.foodInstruction}
                                    </span>
                                  </div>

                                  {/* Regimen Duration & Date Till Consumption */}
                                  <div className="flex items-center gap-2 text-[11px] text-outline flex-wrap pt-0.5">
                                    <span className="flex items-center gap-1 text-secondary font-semibold">
                                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                      Prescribed: {duration}
                                    </span>
                                    <span>•</span>
                                    <span
                                      className={`font-semibold ${
                                        course.isExpired ? 'text-rose-600' : 'text-emerald-700'
                                      }`}
                                    >
                                      {course.isExpired
                                        ? 'Expired — Course Completed'
                                        : `Consume Until: ${course.endDate} (${course.daysRemaining} Days Left)`}
                                    </span>
                                  </div>
                                </div>

                                {/* Right: Per-Medicine Email Toggle & SMS Notice */}
                                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                                  {/* Individual Medicine Email Alert Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => toggleMedEmailAlert(uniqueKey, drugName)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                                      isEmailEnabled
                                        ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                                        : 'bg-surface-container-low border-surface-container-high text-outline hover:text-on-surface'
                                    }`}
                                    title={`Click to turn ${isEmailEnabled ? 'OFF' : 'ON'} email alerts for ${drugName}`}
                                  >
                                    <span className="material-symbols-outlined text-[15px]">
                                      {isEmailEnabled ? 'mail' : 'mail_off'}
                                    </span>
                                    <span>{isEmailEnabled ? 'Email: ON' : 'Email: OFF'}</span>
                                  </button>

                                  {/* Per-Medicine SMS Alert Indicator (Coming Soon) */}
                                  <button
                                    type="button"
                                    onClick={handleSmsNotice}
                                    className="px-2.5 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-outline hover:text-on-surface text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="SMS Alert Service (Coming Soon)"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">sms</span>
                                    <span className="px-1 py-0.2 bg-amber-100 text-amber-900 rounded text-[9px] font-extrabold uppercase">
                                      Soon
                                    </span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Slide-over Monograph & Override Drawer */}
      <AlertDetailDrawer
        alert={activeDrawerAlert}
        isOpen={!!activeDrawerAlert}
        onClose={() => setActiveDrawerAlert(null)}
        onOverride={handleOverride}
        checkId={activeDrawerCheckId || undefined}
        onSelectAlternative={(alt) => {
          showConfirmation('Prescribed alternative noted: ' + alt + '. You can review or edit in New Check.', 'info');
        }}
      />

      {/* Email Schedule Alert Modal - Mixes all active medications when triggered globally */}
      {isEmailModalOpen && (
        <EmailScheduleAlertModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setEmailModalCheck(null);
          }}
          patientName={emailModalCheck?.patientName || checks[0]?.patientName || 'Farhan khalid'}
          patientMrn={emailModalCheck?.mrn || (checks.length > 1 ? `${checks.length} Prescriptions Combined` : (checks[0]?.mrn || 'PT-NEW-001'))}
          checkNumber={emailModalCheck ? (emailModalCheck.checkNumber || emailModalCheck.id) : (checks.length > 1 ? `Combined (${checks.map(c => c.checkNumber || c.id).join(' + ')})` : (checks[0]?.checkNumber || checks[0]?.id || 'CHK-CURRENT'))}
          medications={emailModalCheck ? allActiveMedications.filter((m) => m.checkId === emailModalCheck.id) : allActiveMedications}
          safetyAlerts={emailModalCheck ? allActiveAlerts.filter((a) => (a as any).checkId === emailModalCheck.id) : allActiveAlerts}
          courseEndDate={allActiveMedications[0]?.endDate || 'In 30 Days'}
          regimenDuration={allActiveMedications[0]?.duration || '1 Month'}
        />
      )}
    </div>
  );
}
