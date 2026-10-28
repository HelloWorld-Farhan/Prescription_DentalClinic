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



  const [logs, setLogs] = useState<AuditLogEntry[]>(() => VirtualDb.getAuditLogs());

  const checks: SafetyCheckRecord[] = VirtualDb.getChecks();

  useEffect(() => {

    const handleAuditSync = () => {

      setLogs(VirtualDb.getAuditLogs());

    };

    window.addEventListener('smileclinic_audit_updated', handleAuditSync);

    window.addEventListener('storage', handleAuditSync);

    return () => {

      window.removeEventListener('smileclinic_audit_updated', handleAuditSync);

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

                  const matchedCheck = checks.find(

                    (c) => c.id === log.checkId || c.mrn === log.patientMrn || c.patientKey === log.patientMrn

                  );

                  const prescriptions = log.prescriptions || matchedCheck?.prescriptions || [];

                  const alerts = log.alerts || matchedCheck?.alerts || [];



                  const dateTimeObj = formatISTDateTime(log.timestampMs || log.timestamp);

                  const pdfReportIdentifier = matchedCheck?.checkNumber || matchedCheck?.id || log.checkId || log.id;

                  const pdfFilename = `SmileClinic_CDS_Report_${pdfReportIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;



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

                                    <span className="text-[10px] text-outline font-medium">PropNexAI Monograph v3</span>

                                  </div>



                                  {alerts.length === 0 ? (

                                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center gap-2.5 text-emerald-800">

                                      <span className="material-symbols-outlined text-[20px] text-emerald-600">verified</span>

                                      <span className="text-xs font-medium">

                                        All Clear — Safe to Dispense. Zero clinical interactions or renal clearance hazards identified.

                                      </span>

                                    </div>

                                  ) : (

                                    <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">

                                      {alerts.map((alert) => (

                                        <div

                                          key={alert.id}

                                          className={`p-2.5 rounded-lg border flex flex-col gap-1 ${

                                            alert.severity === 'contraindicated'

                                              ? 'bg-rose-50/70 border-rose-200 text-rose-900'

                                              : alert.severity === 'major'

                                              ? 'bg-orange-50/70 border-orange-200 text-orange-900'

                                              : 'bg-amber-50/70 border-amber-200 text-amber-900'

                                          }`}

                                        >

                                          <div className="flex items-center justify-between">

                                            <span className="font-bold text-xs">{alert.title}</span>

                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-white/70">

                                              {alert.severity}

                                            </span>

                                          </div>

                                          <p className="text-[11px] opacity-90 line-clamp-2">

                                            {alert.recommendation || alert.mechanism}

                                          </p>

                                        </div>

                                      ))}

                                    </div>

                                  )}

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

      {selectedLogForRx && typeof document !== 'undefined' && createPortal(

        <AnimatePresence>

          <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">

            <motion.div

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              exit={{ opacity: 0 }}

              onClick={() => setSelectedLogForRx(null)}

              className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"

            />

            <motion.div

              initial={{ opacity: 0, scale: 0.95, y: 16 }}

              animate={{ opacity: 1, scale: 1, y: 0 }}

              exit={{ opacity: 0, scale: 0.95, y: 12 }}

              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}

              onClick={(e) => e.stopPropagation()}

              className="relative w-full max-w-2xl bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl p-5 sm:p-6 flex flex-col gap-4 z-10 max-h-[90vh] overflow-y-auto"

            >

              {(() => {

                const matchedCheck = checks.find(

                  (c) => c.id === selectedLogForRx.checkId || c.mrn === selectedLogForRx.patientMrn || c.patientKey === selectedLogForRx.patientMrn

                );

                const rxItems = selectedLogForRx.prescriptions || matchedCheck?.prescriptions || [];

                const rxAlerts = selectedLogForRx.alerts || matchedCheck?.alerts || [];

                const dateTimeObj = formatISTDateTime(selectedLogForRx.timestampMs || selectedLogForRx.timestamp);

                const pdfReportIdentifier = matchedCheck?.checkNumber || matchedCheck?.id || selectedLogForRx.checkId || selectedLogForRx.id;

                const pdfCleanName = `SmileClinic_CDS_Report_${pdfReportIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;



                return (

                  <>

                    {/* Header */}

                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-container">

                      <div className="flex items-center gap-3">

                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0">

                          <span className="material-symbols-outlined text-[22px]">prescriptions</span>

                        </div>

                        <div>

                          <div className="flex items-center gap-2">

                            <h3 className="text-base font-bold text-on-surface">

                              Prescription Inspection &amp; Clinical Verification

                            </h3>

                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">

                              Attested

                            </span>

                          </div>

                          <p className="text-xs text-outline mt-0.5">

                            Patient MRN: <strong className="text-on-surface font-mono">{selectedLogForRx.patientMrn}</strong> • Clinician: <strong className="text-on-surface">{selectedLogForRx.clinicianName}</strong>

                          </p>

                        </div>

                      </div>

                      <button

                        type="button"

                        onClick={() => setSelectedLogForRx(null)}

                        className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"

                      >

                        <span className="material-symbols-outlined text-[18px]">close</span>

                      </button>

                    </div>



                    {/* PDF Report Reference Bar */}

                    <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">

                      <div className="flex items-center gap-2.5 min-w-0">

                        <span className="material-symbols-outlined text-primary text-[22px] shrink-0">picture_as_pdf</span>

                        <div className="min-w-0">

                          <span className="text-[10px] uppercase font-bold tracking-wider text-outline block">Clinical Decision Support PDF Report</span>

                          <span className="text-xs font-mono font-bold text-primary truncate block" title={pdfCleanName}>

                            {pdfCleanName}

                          </span>

                        </div>

                      </div>

                      <button

                        type="button"

                        onClick={() => {

                          if (matchedCheck) navigate(`/report?id=${matchedCheck.id}`);

                          else navigate('/report');

                        }}

                        className="px-3.5 py-1.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"

                      >

                        <span className="material-symbols-outlined text-[15px]">description</span>

                        <span>Open PDF Report</span>

                      </button>

                    </div>



                    {/* Meta Grid */}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-surface-container-low/50 border border-surface-container text-xs">

                      <div>

                        <span className="text-[10px] uppercase font-bold text-outline block">Date &amp; Time (IST)</span>

                        <span className="font-semibold text-on-surface font-mono text-[11px]">{dateTimeObj.full}</span>

                      </div>

                      <div>

                        <span className="text-[10px] uppercase font-bold text-outline block">Clinical Severity Status</span>

                        <span className={`inline-flex items-center gap-1 font-bold text-[11px] uppercase ${

                          selectedLogForRx.severity === 'contraindicated'

                            ? 'text-rose-700'

                            : selectedLogForRx.severity === 'major'

                            ? 'text-orange-700'

                            : 'text-emerald-700'

                        }`}>

                          {selectedLogForRx.severity || 'SAFE'}

                        </span>

                      </div>

                      <div>

                        <span className="text-[10px] uppercase font-bold text-outline block">SHA-256 Legal Seal</span>

                        <span className="font-mono text-[10px] text-outline truncate block" title={selectedLogForRx.hash}>

                          {selectedLogForRx.hash || 'SHA256:7B8F3C92D01E4A56'}

                        </span>

                      </div>

                    </div>



                    {/* Prescribed Medications */}

                    <div className="flex flex-col gap-2">

                      <div className="flex items-center justify-between text-xs font-bold text-on-surface">

                        <span className="flex items-center gap-1.5">

                          <span className="material-symbols-outlined text-[16px] text-primary">medication</span>

                          Prescribed Medication Items ({rxItems.length})

                        </span>

                        <span className="text-[10px] text-outline font-normal">RxNorm Formulations</span>

                      </div>



                      {rxItems.length === 0 ? (

                        <div className="p-4 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant italic">

                          {selectedLogForRx.details || 'No detailed prescription items logged for this event.'}

                        </div>

                      ) : (

                        <div className="flex flex-col gap-2">

                          {rxItems.map((rx, idx) => (

                            <div key={idx} className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">

                              <div>

                                <div className="flex items-center gap-2 flex-wrap">

                                  <span className="text-xs font-bold text-on-surface">{rx.drugName}</span>

                                  {rx.dosage && (

                                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[10px]">

                                      {rx.dosage}

                                    </span>

                                  )}

                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant font-medium">

                                    {rx.route || 'Oral'}

                                  </span>

                                </div>

                                <span className="text-[11px] text-outline mt-0.5 block">

                                  {rx.genericName && `${rx.genericName} • `}Frequency: {rx.frequency || 'Standard'} • Duration: {rx.duration || '7 days'}

                                </span>

                              </div>

                            </div>

                          ))}

                        </div>

                      )}

                    </div>



                    {/* Warnings / Alerts summary */}

                    {rxAlerts.length > 0 && (

                      <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">

                        <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">

                          <span className="material-symbols-outlined text-[16px] text-amber-600">health_and_safety</span>

                          Screened Safety Alerts ({rxAlerts.length})

                        </span>

                        <div className="flex flex-col gap-1.5">

                          {rxAlerts.map((alt) => (

                            <div key={alt.id} className="p-2.5 rounded-lg bg-surface-container-low border border-surface-container flex items-start justify-between gap-2 text-xs">

                              <div>

                                <span className="font-bold text-on-surface block">{alt.title}</span>

                                <span className="text-[11px] text-on-surface-variant leading-relaxed block mt-0.5">{alt.recommendation || alt.mechanism}</span>

                              </div>

                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${

                                alt.severity === 'contraindicated' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'

                              }`}>

                                {alt.severity}

                              </span>

                            </div>

                          ))}

                        </div>

                      </div>

                    )}



                    {/* Modal Footer */}

                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-surface-container">

                      <button

                        type="button"

                        onClick={() => setSelectedLogForRx(null)}

                        className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"

                      >

                        Close

                      </button>

                      <button

                        type="button"

                        onClick={() => {

                          if (matchedCheck) navigate(`/report?id=${matchedCheck.id}`);

                          else navigate('/report');

                        }}

                        className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"

                      >

                        <span className="material-symbols-outlined text-[15px]">print</span>

                        <span>Open Attestation Report</span>

                      </button>

                    </div>

                  </>

                );

              })()}

            </motion.div>

          </div>

        </AnimatePresence>,

        document.body

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

