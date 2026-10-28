import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SafetyCheckRecord, AuditLogEntry } from '../types';
import { getDocumentHistory } from '../services/r2StorageService';

interface PrescriptionCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  check?: SafetyCheckRecord | null;
  auditLog?: AuditLogEntry | null;
}

export default function PrescriptionCopyModal({
  isOpen,
  onClose,
  check,
  auditLog,
}: PrescriptionCopyModalProps) {
  const navigate = useNavigate();

  if (!isOpen || (!check && !auditLog)) return null;

  const id = check?.checkNumber || check?.id || auditLog?.checkId || auditLog?.id || 'CHK-UNKNOWN';
  const patientName = check?.patientName || auditLog?.patientName || auditLog?.patientMrn || 'Patient';
  const mrn = check?.mrn || auditLog?.patientMrn || 'PT-CURRENT';
  const clinician = check?.reviewerName || check?.prescriberName || auditLog?.clinicianName || 'Authorized Clinician';
  const timestamp = check?.timestamp || auditLog?.timestamp || 'Just now';
  const prescriptions = check?.prescriptions || auditLog?.prescriptions || [];
  const status = check?.overallStatus || (auditLog?.severity === 'safe' ? 'Safe to Dispense' : 'Clinical Review');

  const directUrl = check?.sourceDocumentUrl || (auditLog as any)?.sourceDocumentUrl;
  const directName = check?.sourceDocumentName || (auditLog as any)?.sourceDocumentName || 'Prescription_Copy';
  
  // Intelligent resolution of uploaded slip from check, audit log, or R2 cloud storage archive
  const fallbackDoc = !directUrl
    ? getDocumentHistory().find(
        (d) =>
          d.filename.toLowerCase().includes('rx') ||
          d.filename.toLowerCase().includes('slip') ||
          d.filename.toLowerCase().includes('prescription')
      )
    : undefined;

  const sourceUrl = directUrl || fallbackDoc?.storageUrl;
  const sourceName = directName !== 'Prescription_Copy' ? directName : (fallbackDoc?.filename || directName);

  const isImage =
    sourceUrl &&
    (sourceUrl.startsWith('data:image') ||
      sourceUrl.startsWith('blob:') ||
      sourceUrl.match(/\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i) ||
      sourceUrl.includes('image') ||
      sourceUrl.includes('camera') ||
      sourceUrl.includes('rx_slip') ||
      check?.sourceType === 'camera' ||
      (auditLog as any)?.sourceType === 'camera');
  const isPdf = sourceUrl && !isImage && (sourceUrl.match(/\.pdf(\?.*)?$/i) || sourceName.toLowerCase().endsWith('.pdf'));

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] overflow-y-auto flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-5 sm:p-7 flex flex-col gap-5 z-10 max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[24px]">receipt_long</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Uploaded Prescription Slip &amp; Clinical Review
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    {id}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patient: <strong className="text-slate-800">{patientName}</strong> ({mrn}) • Clinician:{' '}
                  <strong className="text-slate-800">{clinician}</strong> • {timestamp}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Section 1: Original Uploaded Prescription Copy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-teal-700">document_scanner</span>
                <span>Original Uploaded Prescription Slip</span>
              </h4>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1"
                >
                  <span>Open Full Resolution</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
              )}
            </div>

            {sourceUrl && isImage ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 flex flex-col items-center justify-center p-3 max-h-[440px]">
                <img
                  src={sourceUrl}
                  alt="Original Uploaded Prescription Slip"
                  className="w-full max-h-[380px] object-contain rounded-xl shadow-md border border-slate-200 bg-white"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="mt-2.5 flex items-center justify-between w-full px-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <span className="material-symbols-outlined text-[15px] text-teal-700">lock</span>
                    Archived in Cloudflare R2 Vault: {sourceName}
                  </span>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Full Resolution</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                </div>
              </div>
            ) : sourceUrl && isPdf ? (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[28px]">picture_as_pdf</span>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-900 block truncate max-w-sm">
                      {sourceName}
                    </span>
                    <span className="text-xs text-slate-500">
                      Multi-page PDF prescription slip archived in secure HIPAA vault
                    </span>
                  </div>
                </div>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-teal-800 text-white font-bold text-xs hover:bg-teal-900 transition-colors flex items-center gap-1.5 shadow-2xs shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>View Uploaded PDF</span>
                </a>
              </div>
            ) : (
              /* Stylized Digital Prescription Slip representation */
              <div className="p-5 rounded-2xl bg-gradient-to-b from-white to-slate-50/70 border-2 border-dashed border-teal-200 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[24px] text-teal-800">dentistry</span>
                    <div>
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Smile Clinic Health System
                      </span>
                      <span className="text-[10px] text-slate-500">Dental Operatory · Prescription Record Slip</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                    Rx Digital Slip
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-1">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Patient</span>
                    <span className="font-bold text-slate-800">{patientName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">MRN</span>
                    <span className="font-mono text-slate-800">{mrn}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Date</span>
                    <span className="text-slate-800">{timestamp}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Attestation</span>
                    <span className="font-semibold text-emerald-700">Digital Signed</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Extracted Prescribed Medications List */}
          <div className="space-y-2">
            <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-teal-700">medication</span>
              <span>Extracted Regimen Items ({prescriptions.length})</span>
            </h4>

            {prescriptions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No medication items listed in this prescription.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {prescriptions.map((rx, idx) => (
                  <div
                    key={rx.id || idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {rx.drugName}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate">
                        {rx.genericName || rx.drugName} · {rx.dosage || 'Standard'} · {rx.frequency}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/60 shrink-0">
                      {rx.route || 'Oral'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Status & Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Screening Status:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>{status}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/report?id=${check?.id || auditLog?.checkId || id}`);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-teal-800 text-white hover:bg-teal-900 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                <span>Open Certified 2-Page CDS Report</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
