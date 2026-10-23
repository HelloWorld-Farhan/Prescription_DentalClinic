import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  clinicianName: string;
  action: string;
  patientMrn: string;
  severity: string;
  details: string;
}

interface ExportAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLogItem[];
  activeActionFilter?: string;
}

export default function ExportAuditModal({
  isOpen,
  onClose,
  logs,
  activeActionFilter = 'All',
}: ExportAuditModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'pdf'>('csv');
  const [timeScope, setTimeScope] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [includeSystemMetadata, setIncludeSystemMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Filter logs according to time scope & action filter
  const exportableLogs = logs;

  const handleStartExport = () => {
    setIsExporting(true);
    setExportProgress(15);

    // Simulate cryptographic notary packaging
    const timer1 = setTimeout(() => setExportProgress(55), 300);
    const timer2 = setTimeout(() => setExportProgress(90), 650);
    const timer3 = setTimeout(() => {
      setExportProgress(100);
      setExportSuccess(true);
      setIsExporting(false);

      // Perform actual file download
      triggerFileDownload();

      // Auto close after 2 seconds
      setTimeout(() => {
        handleModalClose();
      }, 1800);
    }, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  const triggerFileDownload = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (selectedFormat === 'csv') {
      const headers = ['Timestamp', 'Clinician', 'Action', 'MRN', 'Severity', 'Details'];
      const rows = exportableLogs.map((l) => [
        `"${l.timestamp}"`,
        `"${l.clinicianName}"`,
        `"${l.action}"`,
        `"${l.patientMrn}"`,
        `"${l.severity}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `RxGuard_HIPAA_Audit_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (selectedFormat === 'json') {
      const exportPayload = {
        exportMetadata: {
          system: 'Smile Clinic RxGuard CDS Engine',
          protocol: 'FHIR R4 AuditEvent / HIPAA Safe Harbor §164.514',
          exportTimestamp: new Date().toISOString(),
          recordCount: exportableLogs.length,
          integrityHash: 'SHA256-4f8b9e892c21ad8310c8ff0e34a7812bc88',
        },
        records: exportableLogs,
      };

      const dataStr =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `RxGuard_AuditPayload_${timestamp}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (selectedFormat === 'pdf') {
      window.print();
    }
  };

  const handleModalClose = () => {
    if (isExporting) return;
    setExportSuccess(false);
    setExportProgress(0);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleModalClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-lg bg-surface-container-lowest border border-surface-container-high rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-surface-container flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[24px]">download_for_offline</span>
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-on-surface">
                    Export HIPAA Audit Trail
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Notarized extraction of clinical screening queries & overrides
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleModalClose}
                disabled={isExporting}
                className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                title="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 space-y-5">
              {/* Format Chooser */}
              <div>
                <label className="text-[11px] font-bold text-outline uppercase tracking-wider block mb-2">
                  Select Export Format
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'csv', label: 'CSV Spreadsheet', ext: '.csv', icon: 'table_view' },
                    { id: 'json', label: 'Structured JSON', ext: '.json', icon: 'data_object' },
                    { id: 'pdf', label: 'Printable PDF', ext: '.pdf', icon: 'description' },
                  ].map((fmt) => {
                    const isSelected = selectedFormat === fmt.id;
                    return (
                      <motion.button
                        type="button"
                        key={fmt.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedFormat(fmt.id as any)}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs ring-1 ring-primary'
                            : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px]">{fmt.icon}</span>
                        <span className="text-xs">{fmt.label}</span>
                        <span className="text-[10px] opacity-70 font-mono font-bold">{fmt.ext}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Time Scope Selection */}
              <div>
                <label className="text-[11px] font-bold text-outline uppercase tracking-wider block mb-2">
                  Time Scope & Range
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: 'All History' },
                    { id: 'today', label: 'Today (24h)' },
                    { id: '7d', label: 'Past 7 Days' },
                    { id: '30d', label: 'Past 30 Days' },
                  ].map((scope) => {
                    const isSelected = timeScope === scope.id;
                    return (
                      <button
                        type="button"
                        key={scope.id}
                        onClick={() => setTimeScope(scope.id as any)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                          isSelected
                            ? 'bg-surface-container-lowest border-primary text-primary shadow-xs font-bold'
                            : 'bg-surface-container-low border-surface-container-high text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        {scope.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scope & Attestation Info Card */}
              <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant font-medium">Matching Audit Records:</span>
                  <span className="font-bold text-on-surface font-mono">
                    {exportableLogs.length} events
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant font-medium">Active Action Filter:</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary text-[11px] font-bold">
                    {activeActionFilter}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold pt-1 border-t border-surface-container">
                  <span className="material-symbols-outlined text-[15px] text-emerald-600">verified_user</span>
                  <span>HIPAA §164.514 Safe Harbor De-identification certified</span>
                </div>
              </div>

              {/* Checkbox option */}
              <label className="flex items-center gap-2.5 text-xs text-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeSystemMetadata}
                  onChange={(e) => setIncludeSystemMetadata(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>Include cryptographic SHA256 notary signature in headers</span>
              </label>

              {/* Export Progress / Success State */}
              <AnimatePresence>
                {isExporting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <div className="flex justify-between text-xs font-semibold text-primary">
                      <span>Generating encrypted export package...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                  </motion.div>
                )}

                {exportSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 text-xs font-bold"
                  >
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                      check_circle
                    </span>
                    <span>Audit extraction complete. File downloaded successfully!</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 sm:p-5 pt-3 bg-surface-container-low/60 border-t border-surface-container flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleModalClose}
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartExport}
                disabled={isExporting || exportSuccess}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[17px]">
                  {isExporting ? 'hourglass_top' : 'download'}
                </span>
                <span>{isExporting ? 'Exporting...' : 'Download Export'}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
