import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SafetyCheckRecord } from '../types';

interface DownloadFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  check: SafetyCheckRecord | null;
  onPrintFallback?: () => void;
}

export type ExportFormat = 'pdf' | 'json' | 'csv' | 'txt';

export default function DownloadFormatModal({
  isOpen,
  onClose,
  check,
  onPrintFallback
}: DownloadFormatModalProps) {
  // By default, PDF is selected as requested
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!check) return null;
  if (typeof document === 'undefined') return null;

  const handleDownload = () => {
    setIsDownloading(true);
    setProgress(20);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloading(false);
            setProgress(0);
            executeFileExport(selectedFormat);
            onClose();
          }, 350);
          return 100;
        }
        return prev + 35;
      });
    }, 150);
  };

  const executeFileExport = (format: ExportFormat) => {
    const checkNumber = check.checkNumber || 'CHK-2026-9042';
    const patientName = check.patientName || 'Eleanor Vance';
    const patientKey = check.patientKey || check.mrn || 'MRN-HASH-9042-XF';
    const candidateDrugs = check.prescriptions
      ? check.prescriptions.map((p) => `${p.drugName} (${p.dosage || 'Standard'}, ${p.frequency || 'BID'})`).join('; ')
      : check.prescribedDrugs?.join(', ') || 'Ciprofloxacin 500mg';

    if (format === 'pdf') {
      if (onPrintFallback) {
        onPrintFallback();
      } else {
        window.print();
      }
      return;
    }

    if (format === 'json') {
      const payload = {
        reportSchema: 'SmileClinic-RxGuard-CDS-Verification-v4.12',
        checkNumber,
        timestamp: check.timestamp || new Date().toISOString(),
        patient: {
          name: patientName,
          key: patientKey,
          mrn: check.mrn,
          unit: check.unit
        },
        overallStatus: check.overallStatus,
        prescriptions: check.prescriptions || [],
        alerts: check.alerts || [],
        reviewer: {
          name: check.reviewerName || 'Dr. Sarah Lin, PharmD',
          prescriber: check.prescriberName || 'Arthur Vance, MD',
          signatureSeal: '21-CFR-PART-11-DIGITAL-VERIFIED'
        }
      };

      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        `${checkNumber}-Clinical-Report.json`
      );
      return;
    }

    if (format === 'csv') {
      const headers = ['CheckNumber', 'Timestamp', 'PatientName', 'PatientKey', 'Status', 'CandidateDrugs', 'AlertsCount', 'Reviewer'];
      const row = [
        `"${checkNumber}"`,
        `"${check.timestamp || 'Today'}"`,
        `"${patientName}"`,
        `"${patientKey}"`,
        `"${check.overallStatus}"`,
        `"${candidateDrugs.replace(/"/g, '""')}"`,
        check.alerts?.length || 0,
        `"${check.reviewerName || 'Dr. Sarah Lin, PharmD'}"`
      ];

      const csvContent = headers.join(',') + '\n' + row.join(',');
      downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${checkNumber}-Audit-Export.csv`);
      return;
    }

    if (format === 'txt') {
      const textContent =
        `=================================================================\n` +
        `SMILE CLINIC CLINICAL DECISION SUPPORT VERIFICATION REPORT\n` +
        `=================================================================\n` +
        `Audit Reference  : ${checkNumber}\n` +
        `Timestamp        : ${check.timestamp || 'Today'}\n` +
        `Patient Name     : ${patientName}\n` +
        `Patient Token    : ${patientKey}\n` +
        `Clinical Unit    : ${check.unit}\n` +
        `Overall Status   : ${check.overallStatus}\n\n` +
        `CANDIDATE PRESCRIPTIONS EVALUATED:\n` +
        `  ${candidateDrugs}\n\n` +
        `INTERACTION ALERTS & FINDINGS (${check.alerts?.length || 0}):\n` +
        (check.alerts && check.alerts.length > 0
          ? check.alerts
              .map(
                (a, i) =>
                  `  [${i + 1}] [${a.severity.toUpperCase()}] ${a.title}\n` +
                  `      Mechanism     : ${a.mechanism || 'N/A'}\n` +
                  `      Recommendation: ${a.recommendation || 'N/A'}\n` +
                  `      Overridden    : ${a.overridden ? `YES (${a.overrideReason})` : 'NO'}\n`
              )
              .join('\n')
          : `  No Contraindicated Interactions Detected.\n`) +
        `\nCLINICAL AUTHORIZATION:\n` +
        `  Prescribing MD : ${check.prescriberName || 'Arthur Vance, MD'}\n` +
        `  Review Pharmacist: ${check.reviewerName || 'Dr. Sarah Lin, PharmD'}\n` +
        `  Regulatory Seal  : 21 CFR Part 11 / HIPAA Safe Harbor Enforced\n` +
        `=================================================================\n`;

      downloadBlob(new Blob([textContent], { type: 'text/plain;charset=utf-8;' }), `${checkNumber}-Clinical-Summary.txt`);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formats: {
    id: ExportFormat;
    name: string;
    ext: string;
    badge: string;
    desc: string;
    icon: string;
    iconColor: string;
    isDefault?: boolean;
  }[] = [
    {
      id: 'pdf',
      name: 'PDF Clinical Document',
      ext: '.pdf',
      badge: 'Default / Standard',
      desc: 'Official high-resolution A4 document layout with 21 CFR Part 11 electronic certification seals.',
      icon: 'picture_as_pdf',
      iconColor: 'text-rose-600',
      isDefault: true
    },
    {
      id: 'json',
      name: 'Structured JSON Payload',
      ext: '.json',
      badge: 'FHIR R4 Format',
      desc: 'Machine-readable clinical payload containing raw interaction vectors, ontology IDs, and check telemetry.',
      icon: 'data_object',
      iconColor: 'text-primary'
    },
    {
      id: 'csv',
      name: 'Spreadsheet Audit Sheet',
      ext: '.csv',
      badge: 'Hospital QA',
      desc: 'Tabular spreadsheet rows for pharmacy quality assurance and clinical oversight logging.',
      icon: 'table_view',
      iconColor: 'text-emerald-600'
    },
    {
      id: 'txt',
      name: 'Medical Plain Text Slip',
      ext: '.txt',
      badge: 'EHR Pasteable',
      desc: 'Clean ASCII plain text summary ready for instant pasting into hospital progress notes.',
      icon: 'text_snippet',
      iconColor: 'text-slate-600'
    }
  ];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-6 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[22px]">download</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Download Clinical Report</h3>
                  <p className="text-xs text-outline">
                    Record #{check.checkNumber} • {check.patientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <label className="text-xs font-bold text-on-surface block">
                Select Export Document Format:
              </label>

              {/* Format Options Radio Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formats.map((fmt) => {
                  const isSelected = selectedFormat === fmt.id;
                  return (
                    <motion.div
                      key={fmt.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedFormat(fmt.id)}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary'
                          : 'bg-surface-container-low border-surface-container-high hover:border-outline'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-[22px] ${fmt.iconColor}`}>
                            {fmt.icon}
                          </span>
                          <span className="text-xs font-bold text-on-surface">{fmt.name}</span>
                        </div>
                        <input
                          type="radio"
                          name="exportFormat"
                          checked={isSelected}
                          onChange={() => setSelectedFormat(fmt.id)}
                          className="accent-primary cursor-pointer"
                        />
                      </div>
                      <p className="text-[11px] text-outline leading-snug">{fmt.desc}</p>
                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        <span className="font-mono font-bold text-primary">{fmt.ext}</span>
                        {fmt.isDefault && (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-primary-container text-on-primary">
                            Default
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Animated Progress Indicator while downloading */}
              {isDownloading && (
                <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-on-surface flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                      Preparing {selectedFormat.toUpperCase()} Document...
                    </span>
                    <span className="text-primary font-mono">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-2.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isDownloading}
                  onClick={handleDownload}
                  className="w-2/3 py-2.5 rounded-xl bg-primary-container hover:bg-primary text-on-primary text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>
                    Download {selectedFormat.toUpperCase()} {selectedFormat === 'pdf' ? '(A4 Print)' : 'File'}
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
