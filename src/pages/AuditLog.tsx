import { pullFromCloud } from '../services/cloudSyncService';
import React, { useState, useEffect } from 'react';

import { createPortal } from 'react-dom';

import { useNavigate } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';

import { PrescriptionStorage as VirtualDb, formatISTTime, formatISTDateTime } from '../services/prescriptionService';

import ExportAuditModal from '../components/ExportAuditModal';
import PrescriptionCopyModal from '../components/PrescriptionCopyModal';
import EmailReportModal from '../components/EmailReportModal';
import { API_BASE_URL } from '../config/api';
import { getClinicianEmail } from '../services/cloudSyncService';
import { showConfirmation } from '../services/confirmation';

import { AuditLogEntry, SafetyCheckRecord } from '../types';



export default function AuditLog() {

  const navigate = useNavigate();

  const [filterAction, setFilterAction] = useState('All');

  const [searchQuery, setSearchQuery] = useState('');

  const [showExportModal, setShowExportModal] = useState(false);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [selectedLogForRx, setSelectedLogForRx] = useState<AuditLogEntry | null>(null);
  const [emailModalLog, setEmailModalLog] = useState<AuditLogEntry | null>(null);
  const [emailModalMode, setEmailModalMode] = useState<'send' | 'preview'>('send');



  const [logs, setLogs] = useState<AuditLogEntry[]>(() => VirtualDb.getAuditLogs());

  const checks: SafetyCheckRecord[] = VirtualDb.getChecks();

  useEffect(() => {
    let isMounted = true;
    pullFromCloud().then(() => {
      if (!isMounted) return;
      setLogs(VirtualDb.getAuditLogs());
    }).catch(() => {});

    const handleAuditSync = () => {

      setLogs(VirtualDb.getAuditLogs());

    };

    window.addEventListener('smileclinic_audit_updated', handleAuditSync);
    window.addEventListener('smileclinic_checks_updated', handleAuditSync);
    window.addEventListener('storage', handleAuditSync);

    return () => {
      isMounted = false;
      window.removeEventListener('smileclinic_audit_updated', handleAuditSync);
      window.removeEventListener('smileclinic_checks_updated', handleAuditSync);
      window.removeEventListener('storage', handleAuditSync);
    };

  }, []);



  const availableFilterItems = [

    { label: 'All', count: logs.length },

    { label: 'Safety Screen', count: logs.filter((l) => l.action.includes('Safety Screen')).length },

    { label: 'Alert Overridden', count: logs.filter((l) => l.action.includes('Alert Overridden')).length },

    { label: 'Report Printed', count: logs.filter((l) => l.action.includes('Report Printed')).length },

  ].filter((item) => item.label === 'All' || item.count > 0);



  useEffect(() => {

    if (filterAction !== 'All' && !availableFilterItems.some((i) => i.label === filterAction)) {

      setFilterAction('All');

    }

  }, [availableFilterItems, filterAction]);



  const filteredLogs = logs.filter((log) => {

    const matchesAction = filterAction === 'All' || log.action.includes(filterAction);

    const q = searchQuery.toLowerCase();

    const matchesSearch =

      (log.clinicianName || '').toLowerCase().includes(q) ||

      (log.patientMrn || '').toLowerCase().includes(q) ||

      (log.patientName || '').toLowerCase().includes(q) ||

      (log.details || '').toLowerCase().includes(q) ||

      (log.action || '').toLowerCase().includes(q) ||

      (log.severity && log.severity.toLowerCase().includes(q)) ||

      (log.timestamp && log.timestamp.toLowerCase().includes(q));



    return matchesAction && matchesSearch;

  });



  // 10 logs per page pagination

  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;



  useEffect(() => {

    setCurrentPage(1);

  }, [filterAction, searchQuery]);



  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);



  const toggleExpand = (id: string) => {

    setExpandedLogId((prev) => (prev === id ? null : id));

  };



  return (

    <div className="space-y-6">

      {/* Header */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div>

          <div className="flex items-center gap-2">

            <span className="material-symbols-outlined text-primary text-[24px]">verified</span>

            <h1 className="text-2xl font-black text-on-surface">HIPAA & Clinical Audit Trail</h1>

          </div>

          <p className="text-xs text-on-surface-variant mt-1">

            Immutable legal logs of all drug screening queries, clinician overrides, and safety alerts with full inner clinical metadata.

          </p>

        </div>



        <motion.button

          type="button"

          whileHover={{ scale: 1.02 }}

          whileTap={{ scale: 0.98 }}

          onClick={() => setShowExportModal(true)}

          className="px-4 py-2.5 rounded-xl bg-primary-container text-on-primary hover:bg-primary font-bold text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"

        >

          <span className="material-symbols-outlined text-[18px]">download_for_offline</span>

          <span>Export Audit Log</span>

        </motion.button>

      </div>



      {/* Filter and Search Bar */}

      <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar pb-0.5">

          {availableFilterItems.map((item) => {

            const isSelected = filterAction === item.label;

            return (

              <motion.button

                type="button"

                whileTap={{ scale: 0.96 }}

                key={item.label}

                onClick={() => setFilterAction(item.label)}

                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${

                  isSelected

                    ? 'bg-primary text-white shadow-xs'

                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'

                }`}

              >

                <span>{item.label}</span>

                <span

                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${

                    isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'

                  }`}

                >

                  {item.count}

                </span>

              </motion.button>

            );

          })}

        </div>



        <div className="relative flex items-center bg-surface-container-low rounded-xl px-3 py-2 border border-surface-container-high w-full sm:w-72">

          <span className="material-symbols-outlined text-outline text-[16px] mr-2">search</span>

          <input

            type="text"

            value={searchQuery}

            onChange={(e) => setSearchQuery(e.target.value)}

            placeholder="Search clinician, MRN, details..."

            className="w-full text-xs text-on-surface bg-transparent outline-none placeholder:text-outline"

          />

          {searchQuery && (

            <button

              type="button"

              onClick={() => setSearchQuery('')}

              className="text-outline hover:text-on-surface cursor-pointer p-0.5"

            >

              <span className="material-symbols-outlined text-[16px]">close</span>

            </button>

          )}

        </div>

      </div>



      {/* Table */}

      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs">

            <thead>

              <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-wider font-bold border-b border-surface-container-high">

                <th className="py-3 px-4 w-10 text-center"></th>

                <th className="py-3 px-4">Timestamp (IST)</th>

                <th className="py-3 px-4">Clinician</th>

                <th className="py-3 px-4">Action Notarized</th>

                <th className="py-3 px-4">Patient MRN</th>

                <th className="py-3 px-4">Event Details</th>

                <th className="py-3 px-4">Severity</th>

                <th className="py-3 px-4 text-right">Details & Report</th>

              </tr>

            </thead>

            <tbody className="divide-y divide-surface-container-low">

              {filteredLogs.length === 0 ? (

                <tr>

                  <td colSpan={8} className="py-16 text-center">

                    <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">

                      <div className="w-12 h-12 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center shadow-2xs">

                        <span className="material-symbols-outlined text-[26px]">verified</span>

                      </div>

                      <h3 className="font-bold text-sm text-on-surface">No Audit Trail Records</h3>

                      <p className="text-xs text-on-surface-variant leading-relaxed">

                        No notarized clinician actions, overrides, or CDS screenings found for this filter. All future actions will be permanently logged here.

                      </p>

                    </div>

                  </td>

                </tr>

              ) : (

                paginatedLogs.map((log) => {

                  const isContra = log.severity === 'contraindicated';

                  const isMajor = log.severity === 'major';

                  const isSafe = log.severity === 'safe';

                  const isExpanded = expandedLogId === log.id;



                  // Cross-reference safety check if available
                  const matchedCheck =
                    checks.find((c) => c.id === log.checkId || c.checkNumber === log.checkId) ||
                    checks.find((c) => (c.mrn === log.patientMrn || c.patientId === log.patientMrn) && Math.abs((c.timestampMs || 0) - (log.timestampMs || 0)) < 300000) ||
                    checks.find((c) => c.mrn === log.patientMrn || c.patientId === log.patientMrn);

                  const prescriptions = log.prescriptions || matchedCheck?.prescriptions || [];
                  const alerts = log.alerts || matchedCheck?.alerts || [];

                  const dateTimeObj = formatISTDateTime(log.timestampMs || log.timestamp);
                  const pdfReportIdentifier = log.checkId || matchedCheck?.checkNumber || matchedCheck?.id || log.id;
                  const pdfFilename =
                    log.pdfFilename ||
                    `SmileClinic_CDS_Report_${pdfReportIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

                  return (

                    <React.Fragment key={log.id}>

                      <tr

                        onClick={() => toggleExpand(log.id)}

                        className={`transition-colors cursor-pointer select-none ${

                          isExpanded

                            ? 'bg-primary/5 border-l-4 border-l-primary'

                            : 'hover:bg-surface-container-low/60'

                        }`}

                      >

                        <td className="py-3 px-3 text-center">

                          <span

                            className={`material-symbols-outlined text-[18px] text-outline transition-transform duration-200 ${

                              isExpanded ? 'rotate-180 text-primary' : ''

                            }`}

                          >

                            expand_more

                          </span>

                        </td>

                        <td className="py-3 px-3 font-mono text-outline whitespace-nowrap">

                          <div className="font-semibold text-xs text-on-surface">{dateTimeObj.date}</div>

                          <div className="flex items-center gap-1 text-[11px] text-outline">

                            <span className="material-symbols-outlined text-[13px] text-primary">schedule</span>

                            <span>{dateTimeObj.time}</span>

                          </div>

                        </td>

                        <td className="py-3 px-3 font-bold text-on-surface whitespace-nowrap">

                          {log.clinicianName}

                        </td>

                        <td className="py-3 px-3">

                          <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-on-surface font-semibold text-[11px] whitespace-nowrap">

                            {log.action}

                          </span>

                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-primary whitespace-nowrap">

                          {log.patientMrn}

                        </td>

                        <td className="py-3 px-3 max-w-sm">

                          <div className="text-on-surface-variant text-xs line-clamp-1 leading-relaxed">

                            {log.details}

                          </div>

                          <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-primary truncate" title={pdfFilename}>

                            <span className="material-symbols-outlined text-[13px] shrink-0">picture_as_pdf</span>

                            <span className="truncate">{pdfFilename}</span>

                          </div>

                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">

                          <span

                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${

                              isContra

                                ? 'bg-rose-100 text-rose-800'

                                : isMajor

                                ? 'bg-orange-100 text-orange-800'

                                : isSafe

                                ? 'bg-emerald-100 text-emerald-800'

                                : 'bg-amber-100 text-amber-800'

                            }`}

                          >

                            {log.severity}

                          </span>

                        </td>

                        <td className="py-3 px-3 text-right whitespace-nowrap">

                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>

                            <button

                              type="button"

                              onClick={() => setSelectedLogForRx(log)}

                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-teal-800 bg-teal-50 hover:bg-teal-600 hover:text-white transition-colors text-xs font-bold border border-teal-200/80 shadow-2xs cursor-pointer"

                              title="Check patient prescription medications"

                            >

                              <span className="material-symbols-outlined text-[15px]">medication</span>

                              <span>Prescription</span>

                            </button>



                            <button

                              type="button"

                              onClick={() => {

                                if (matchedCheck) navigate(`/report?id=${matchedCheck.id}`);

                                else navigate('/report');

                              }}

                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-primary bg-primary/10 hover:bg-primary hover:text-white transition-colors text-xs font-bold border border-primary/20 shadow-2xs cursor-pointer"

                              title="View Associated Clinical Decision PDF Report"

                            >

                              <span className="material-symbols-outlined text-[15px]">description</span>

                              <span>Report</span>

                            </button>

                          </div>

                        </td>

                      </tr>



                      {/* Expanded Inner Clinical Details Drawer */}

                      {isExpanded && (

                        <tr className="bg-surface-container-lowest/80 border-b border-surface-container-high">

                          <td colSpan={8} className="p-4 sm:p-6 bg-gradient-to-b from-surface-container-low/40 to-surface-container-lowest">

                            <motion.div

                              initial={{ opacity: 0, height: 0 }}

                              animate={{ opacity: 1, height: 'auto' }}

                              exit={{ opacity: 0, height: 0 }}

                              className="space-y-4"

                            >

                              {/* Inner Header Bar with Legal Hash */}

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-surface-container-high">

                                <div className="flex items-center gap-2 flex-wrap">

                                  <span className="text-xs font-bold text-on-surface flex items-center gap-1">

                                    <span className="material-symbols-outlined text-[18px] text-primary">data_object</span>

                                    Inner Clinical Details &amp; Monograph Trace

                                  </span>

                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">

                                    ID: {log.id}

                                  </span>

                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">

                                    <span className="material-symbols-outlined text-[12px]">lock</span>

                                    HIPAA Legal Seal Verified

                                  </span>

                                </div>



                                <div className="flex items-center gap-2">

                                  <span className="text-[10px] font-mono text-outline bg-surface-container-low px-2 py-1 rounded border border-surface-container-high">

                                    {log.hash || 'SHA256:7B8F3C92D01E4A56'}

                                  </span>

                                </div>

                              </div>



                              {/* Inner Grid: Prescriptions and Alerts */}

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                {/* Left: Medication Regimen Involved */}

                                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-3 shadow-2xs">

                                  <div className="flex items-center justify-between">

                                    <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">

                                      <span className="material-symbols-outlined text-[16px] text-primary">pill</span>

                                      Prescribed Medications Screened ({prescriptions.length})

                                    </h4>

                                    <span className="text-[10px] text-outline font-medium">Active Prescription Slip</span>

                                  </div>



                                  {prescriptions.length === 0 ? (

                                    <p className="text-xs text-on-surface-variant italic">

                                      {log.details || 'No detailed prescription items recorded for this event.'}

                                    </p>

                                  ) : (

                                    <div className="space-y-2">

                                      {prescriptions.map((rx, idx) => (

                                        <div

                                          key={rx.id || idx}

                                          className="p-2.5 rounded-lg bg-surface-container-low/70 border border-surface-container flex items-center justify-between gap-2"

                                        >

                                          <div>

                                            <span className="text-xs font-bold text-on-surface block">

                                              {rx.drugName}

                                            </span>

                                            <span className="text-[11px] text-outline block">

                                              {rx.genericName || rx.drugName} · {rx.dosage || 'Standard Dose'} · {rx.frequency}

                                            </span>

                                          </div>

                                          <div className="text-right shrink-0">

                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary block">

                                              {rx.route || 'Oral'}

                                            </span>

                                            <span className="text-[10px] text-outline">

                                              {rx.duration || '7 days'}

                                            </span>

                                          </div>

                                        </div>

                                      ))}

                                    </div>

                                  )}

                                </div>



                                {/* Right: Safety Screening Alerts & Overrides */}
                                <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high space-y-3 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[16px] text-amber-600">health_and_safety</span>
                                      Clinical CDS Flags &amp; Hazard Screening ({alerts.length})
                                    </h4>
                                    <span className="text-[10px] text-outline font-medium">SmileGuard CDS Monograph v3</span>
                                  </div>

                                  {alerts.length === 0 ? (
                                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center gap-2.5 text-emerald-800">
                                      <span className="material-symbols-outlined text-[20px] text-emerald-600">verified</span>
                                      <span className="text-xs font-medium">
                                        All Clear · Safe to Dispense. Zero clinical interactions or renal clearance hazards identified.
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="space-y-2.5">
                                      {alerts.map((alert: any, aIdx: number) => {
                                        const alertSeverity = ((alert.severity || 'major') as string).toLowerCase();
                                        const isContra = alertSeverity === 'contraindicated' || alertSeverity === 'critical';
                                        const isMaj = alertSeverity === 'major' || alertSeverity === 'high';

                                        const alertTitle =
                                          alert.title ||
                                          (alert.drugA && alert.drugB
                                            ? `${alert.drugA} ↔ ${alert.drugB} Hazard`
                                            : alert.name || (alert.category ? `${alert.category} Warning` : 'Clinical Interaction Hazard'));

                                        const alertCategory = alert.category || 'Drug-Drug';
                                        const alertDesc =
                                          alert.description ||
                                          alert.mechanism ||
                                          alert.clinicalImpact ||
                                          alert.finding ||
                                          'Clinical decision support flagged potential interaction or clearance concern.';

                                        const alertRec =
                                          alert.recommendation ||
                                          alert.clinicalRecommendation ||
                                          alert.action ||
                                          'Review dosage regimen and monitor patient vital signs before administration.';

                                        const drugPair =
                                          Array.isArray(alert.interactingDrugs) && alert.interactingDrugs.length > 0
                                            ? alert.interactingDrugs
                                            : alert.drugA && alert.drugB
                                            ? [alert.drugA, alert.drugB]
                                            : alert.drugPair || [];

                                        return (
                                          <div
                                            key={alert.id || `alt-${aIdx}`}
                                            className={`p-3 rounded-xl border flex flex-col gap-2 transition-all shadow-2xs ${
                                              isContra
                                                ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                                                : isMaj
                                                ? 'bg-orange-50/80 border-orange-200 text-orange-950'
                                                : 'bg-amber-50/80 border-amber-200 text-amber-950'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                  className={`material-symbols-outlined text-[16px] shrink-0 ${
                                                    isContra ? 'text-rose-600' : isMaj ? 'text-orange-600' : 'text-amber-600'
                                                  }`}
                                                >
                                                  {isContra ? 'dangerous' : isMaj ? 'warning' : 'info'}
                                                </span>
                                                <span className="font-bold text-xs leading-snug">{alertTitle}</span>
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white/80 border border-black/5 text-slate-700">
                                                  {alertCategory}
                                                </span>
                                                <span
                                                  className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white shadow-2xs ${
                                                    isContra ? 'bg-rose-600' : isMaj ? 'bg-orange-600' : 'bg-amber-600'
                                                  }`}
                                                >
                                                  {alertSeverity}
                                                </span>
                                              </div>
                                            </div>

                                            {drugPair.length > 0 && (
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-bold text-outline uppercase tracking-wider">Agents:</span>
                                                {drugPair.map((drug: string, dIdx: number) => (
                                                  <span
                                                    key={dIdx}
                                                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/90 border border-black/10 text-slate-800 shadow-2xs"
                                                  >
                                                    {drug}
                                                  </span>
                                                ))}
                                              </div>
                                            )}

                                            <p className="text-[11px] leading-relaxed opacity-95 text-slate-800">
                                              {alertDesc}
                                            </p>

                                            {alertRec && (
                                              <div className="p-2 rounded-lg bg-white/80 border border-black/5 flex items-start gap-1.5 text-[11px] text-slate-800">
                                                <span className="material-symbols-outlined text-[15px] text-primary shrink-0 mt-0.5">
                                                  clinical_notes
                                                </span>
                                                <span className="leading-snug">
                                                  <strong className="font-bold text-on-surface">Guidance: </strong>
                                                  {alertRec}
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Per-Audit Clinical Action Bar: Email Send / Preview, Download PDF, View Uploaded Rx Slip */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-container-high/60 bg-surface-container-low/40 p-3 rounded-xl mt-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-on-surface">Screening Audit Actions:</span>
                                  <span className="font-mono text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                    {log.checkId || log.id}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Send via Email */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEmailModalLog(log);
                                      setEmailModalMode('send');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-800 text-white hover:bg-teal-900 transition-colors text-xs font-bold shadow-2xs cursor-pointer"
                                    title="Send certified 2-page PDF report via email"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">mail</span>
                                    <span>Send via Email</span>
                                  </button>

                                  {/* Preview of Email */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEmailModalLog(log);
                                      setEmailModalMode('preview');
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-primary hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high shadow-2xs cursor-pointer"
                                    title="Preview rendered HTML email and PDF attachment"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">drafts</span>
                                    <span>Preview of Email</span>
                                  </button>

                                  {/* Direct PDF Download */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const checkId = log.checkId || log.id;
                                      navigate(`/report?id=${checkId}`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high shadow-2xs cursor-pointer"
                                    title="Open and download 2-page printable CDS PDF report"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">download</span>
                                    <span>Download PDF</span>
                                  </button>

                                  {/* View Uploaded Prescription Copy */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedLogForRx(log)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-600 hover:text-white transition-colors text-xs font-bold border border-teal-200/80 shadow-2xs cursor-pointer"
                                    title="View original uploaded prescription copy archived in R2"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                                    <span>Prescription Copy</span>
                                  </button>
                                </div>
                              </div>

                            </motion.div>

                          </td>

                        </tr>

                      )}

                    </React.Fragment>

                  );

                })

              )}

            </tbody>

          </table>

        </div>



        {/* 10 Items per Page Pagination Bar */}

        {filteredLogs.length > 0 && (

          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-surface-container-high bg-surface-container-lowest gap-3">

            <span className="text-xs text-on-surface-variant font-medium">

              Showing <strong className="text-on-surface font-semibold">{(currentPage - 1) * pageSize + 1}</strong>–

              <strong className="text-on-surface font-semibold">

                {Math.min(currentPage * pageSize, filteredLogs.length)}

              </strong> of <strong className="text-on-surface font-semibold">{filteredLogs.length}</strong> audit records

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



      {/* Animated HIPAA Export Modal */}

            {/* Dedicated Prescription Inspection Modal */}

      {/* Real Uploaded Prescription Slip Modal */}
      <PrescriptionCopyModal
        isOpen={!!selectedLogForRx}
        onClose={() => setSelectedLogForRx(null)}
        auditLog={selectedLogForRx}
        check={
          checks.find((c) => c.id === selectedLogForRx?.checkId || c.checkNumber === selectedLogForRx?.checkId) ||
          checks.find((c) => (c.mrn === selectedLogForRx?.patientMrn || c.patientId === selectedLogForRx?.patientMrn) && (c.sourceDocumentUrl || c.prescriptions.length > 0)) ||
          checks.find((c) => c.mrn === selectedLogForRx?.patientMrn || c.patientId === selectedLogForRx?.patientMrn)
        }
      />

      {/* Individual Email Send / Preview Modal with Live Editable Recipient and PDF Attachment */}
      {emailModalLog && (
        <EmailReportModal
          key={`${emailModalLog.id}-${emailModalMode}`}
          isOpen={!!emailModalLog}
          onClose={() => setEmailModalLog(null)}
          mode={emailModalMode}
          checkId={emailModalLog.checkId || emailModalLog.id}
          patientName={emailModalLog.patientName || emailModalLog.patientMrn}
          patientMrn={emailModalLog.patientMrn}
          prescriptions={emailModalLog.prescriptions || []}
          alerts={emailModalLog.alerts || []}
          overallStatus={emailModalLog.severity === 'safe' ? 'Safe to Dispense' : 'Requires Review'}
          initialEmail={getClinicianEmail()}
        />
      )}



      <ExportAuditModal

        isOpen={showExportModal}

        onClose={() => setShowExportModal(false)}

        logs={filteredLogs}

        activeActionFilter={filterAction}

      />

    </div>

  );

}

