import { useState } from 'react';
import { motion } from 'framer-motion';
import { PrescriptionStorage as VirtualDb } from '../services/prescriptionService';
import { SafetyCheckRecord } from '../types';
import PrintableReportModal from '../components/PrintableReportModal';
import ExportAuditModal from '../components/ExportAuditModal';

export default function AuditLog() {
  const [filterAction, setFilterAction] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReportCheck, setActiveReportCheck] = useState<SafetyCheckRecord | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const logs = VirtualDb.getAuditLogs();
  const checks = VirtualDb.getChecks();

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'All' || log.action.includes(filterAction);
    const matchesSearch =
      log.clinicianName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.patientMrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesAction && matchesSearch;
  });

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
            Immutable legal logs of all drug screening queries, clinician overrides, and safety alerts.
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
          {[
            { label: 'All', count: logs.length },
            { label: 'Safety Screen', count: logs.filter(l => l.action.includes('Safety Screen')).length },
            { label: 'Alert Overridden', count: logs.filter(l => l.action.includes('Alert Overridden')).length },
            { label: 'Report Printed', count: logs.filter(l => l.action.includes('Report Printed')).length },
            { label: 'Rule Updated', count: logs.filter(l => l.action.includes('Rule Updated')).length },
          ].map((item) => {
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
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
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
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Clinician</th>
                <th className="py-3 px-4">Action Notarized</th>
                <th className="py-3 px-4">Patient MRN</th>
                <th className="py-3 px-4">Event Details</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
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
                filteredLogs.map((log) => {
                const isContra = log.severity === 'contraindicated';
                const isMajor = log.severity === 'major';
                const isSafe = log.severity === 'safe';

                return (
                  <tr key={log.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-outline whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-on-surface whitespace-nowrap">
                      {log.clinicianName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-on-surface font-semibold text-[11px] whitespace-nowrap">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-primary whitespace-nowrap">
                      {log.patientMrn}
                    </td>
                    <td className="py-3.5 px-4 max-w-md text-on-surface-variant leading-relaxed">
                      {log.details}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isContra
                          ? 'bg-rose-100 text-rose-800'
                          : isMajor
                          ? 'bg-orange-100 text-orange-800'
                          : isSafe
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          const targetCheck = checks.find(c => c.mrn === log.patientMrn || c.patientKey === log.patientMrn) || checks[0];
                          if (targetCheck) setActiveReportCheck(targetCheck);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-secondary bg-surface-container hover:bg-surface-container-high transition-colors text-xs font-bold border border-surface-container-high shadow-2xs cursor-pointer"
                        title="View Associated Clinical Decision Report"
                      >
                        <span className="material-symbols-outlined text-primary text-[15px]">description</span>
                        <span>Report</span>
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Printable Clinical Report Modal */}
      <PrintableReportModal
        check={activeReportCheck}
        isOpen={!!activeReportCheck}
        onClose={() => setActiveReportCheck(null)}
      />

      {/* Animated HIPAA Export Modal */}
      <ExportAuditModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        logs={filteredLogs}
        activeActionFilter={filterAction}
      />
    </div>
  );
}
