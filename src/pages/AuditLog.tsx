import { useState } from 'react';
import { VirtualDb } from '../data/virtualDb';
import { SafetyCheckRecord } from '../types';
import PrintableReportModal from '../components/PrintableReportModal';

export default function AuditLog() {
  const [filterAction, setFilterAction] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReportCheck, setActiveReportCheck] = useState<SafetyCheckRecord | null>(null);

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

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Clinician', 'Action', 'MRN', 'Severity', 'Details'];
    const rows = filteredLogs.map(l => [
      l.timestamp,
      `"${l.clinicianName}"`,
      `"${l.action}"`,
      l.patientMrn,
      l.severity,
      `"${l.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RxGuard_AuditLog_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            Immutable legal logs of all drug screening queries, clinician overrides, and safety alerts.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:bg-surface-container text-on-surface font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Audit Log (CSV)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
          {['All', 'Safety Screen', 'Alert Overridden', 'Report Printed', 'Rule Updated'].map((action) => (
            <button
              key={action}
              onClick={() => setFilterAction(action)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterAction === action
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {action}
            </button>
          ))}
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
              {filteredLogs.map((log) => {
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
              })}
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
    </div>
  );
}
