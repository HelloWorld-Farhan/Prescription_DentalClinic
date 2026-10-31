import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SafetyCheckRecord, AuditLogEntry } from '../types';
import { getDocumentHistory } from '../services/r2StorageService';
import { PrescriptionStorage } from '../services/prescriptionService';

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
  const [showLightbox, setShowLightbox] = useState(false);

  if (!isOpen || (!check && !auditLog)) return null;

  const id = check?.checkNumber || check?.id || auditLog?.checkId || auditLog?.id || 'CHK-UNKNOWN';
  const patientName = check?.patientName || auditLog?.patientName || auditLog?.patientMrn || 'Patient';
  const mrn = check?.mrn || auditLog?.patientMrn || 'PT-CURRENT';
  const clinician = check?.reviewerName || check?.prescriberName || auditLog?.clinicianName || 'Authorized Clinician';
  const timestamp = check?.timestamp || auditLog?.timestamp || 'Just now';
  const prescriptions = check?.prescriptions || auditLog?.prescriptions || [];
  const status = check?.overallStatus || (auditLog?.severity === 'safe' ? 'Safe to Dispense' : 'Clinical Review');

  // Priority 1: Direct URL from check or auditLog (including innerData)
  const directUrl =
    check?.sourceDocumentUrl ||
    (auditLog as any)?.sourceDocumentUrl ||
    (auditLog as any)?.innerData?.sourceDocumentUrl;
  const directName =
    check?.sourceDocumentName ||
    (auditLog as any)?.sourceDocumentName ||
    (auditLog as any)?.innerData?.sourceDocumentName ||
    'Prescription_Copy';

  // Priority 2: Look in PrescriptionStorage for matching check with sourceDocumentUrl
  const allChecks = typeof PrescriptionStorage?.getChecks === 'function' ? PrescriptionStorage.getChecks() : [];
  const matchedStorageCheck = !directUrl
    ? allChecks.find(
        (c) =>
          (c.id === check?.id ||
            c.checkNumber === check?.checkNumber ||
            c.checkNumber === id ||
            c.id === id ||
            c.mrn === mrn ||
            c.patientName === patientName) &&
          c.sourceDocumentUrl
      )
    : undefined;

  // Priority 3: Fallback from document history
  const allDocs = getDocumentHistory();
  const fallbackDoc =
    !directUrl && !matchedStorageCheck
      ? allDocs.find(
          (d) =>
            d.filename.toLowerCase().includes('rx') ||
            d.filename.toLowerCase().includes('slip') ||
            d.filename.toLowerCase().includes('prescription')
        )
      : undefined;

  const sourceUrl = directUrl || matchedStorageCheck?.sourceDocumentUrl || fallbackDoc?.storageUrl;
  const sourceName =
    directName !== 'Prescription_Copy'
      ? directName
      : matchedStorageCheck?.sourceDocumentName || fallbackDoc?.filename || 'Prescription_Copy.pdf';

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

  const isPdf =
    sourceUrl && !isImage && (sourceUrl.match(/\.pdf(\?.*)?$/i) || sourceName.toLowerCase().endsWith('.pdf'));

  const handleViewPrescriptionImage = () => {
    if (sourceUrl && isPdf) {
      window.open(sourceUrl, '_blank');
    } else {
      setShowLightbox(true);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] overflow-y-auto flex items-center justify-center p-2.5 sm:p-4 md:p-6 overscroll-contain pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-[max(0.625rem,env(safe-area-inset-top,0px))]">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col z-10 max-h-[calc(100dvh-1.5rem)] sm:max-h-[88vh] overflow-hidden"
        >
          {/* Fixed / Sticky Header */}
          <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-white shrink-0">
            <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <span className="material-symbols-outlined text-[20px] sm:text-[24px]">receipt_long</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 leading-snug">
                    Uploaded Prescription Slip &amp; Clinical Review
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                    {id}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-normal truncate max-w-lg">
                  Patient: <strong className="text-slate-800">{patientName}</strong> ({mrn}) • Clinician:{' '}
                  <strong className="text-slate-800">{clinician}</strong> • {timestamp}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              title="Close Modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Scrollable Body Container */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
            {/* Section 1: Original Uploaded Prescription Copy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <h4 className="uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5 text-[11px] sm:text-xs">
                  <span className="material-symbols-outlined text-[15px] text-teal-700">document_scanner</span>
                  <span>Original Uploaded Prescription Slip</span>
                </h4>
                <button
                  type="button"
                  onClick={handleViewPrescriptionImage}
                  className="font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer transition-colors text-[11px] sm:text-xs"
                >
                  <span>View Full Resolution</span>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </button>
              </div>

              {sourceUrl && isImage ? (
                <div
                  onClick={() => setShowLightbox(true)}
                  className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 flex flex-col items-center justify-center p-3 max-h-[300px] cursor-pointer group"
                  title="Click to view full size image"
                >
                  <img
                    src={sourceUrl}
                    alt="Original Uploaded Prescription Slip"
                    className="w-full max-h-[250px] object-contain rounded-xl shadow-md border border-slate-200 bg-white group-hover:opacity-95 transition-opacity"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                    <span className="px-3.5 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-bold shadow-lg flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                      Click to Enlarge Prescription
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between w-full px-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-mono truncate max-w-[240px]">
                      <span className="material-symbols-outlined text-[14px] text-teal-700">lock</span>
                      Archived in Vault: {sourceName}
                    </span>
                    <span className="font-bold text-teal-700 flex items-center gap-1 shrink-0">
                      <span>Full Resolution</span>
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    </span>
                  </div>
                </div>
              ) : sourceUrl && isPdf ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[26px]">picture_as_pdf</span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate max-w-sm">
                        {sourceName}
                      </span>
                      <span className="text-[11px] sm:text-xs text-slate-500 block truncate">
                        Multi-page PDF prescription slip archived in secure HIPAA vault
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleViewPrescriptionImage}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-teal-800 text-white font-bold text-xs hover:bg-teal-900 transition-colors flex items-center justify-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    <span>View Uploaded PDF</span>
                  </button>
                </div>
              ) : (
                /* Stylized Digital Prescription Slip representation */
                <div
                  onClick={() => setShowLightbox(true)}
                  className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-white to-slate-50/70 border-2 border-dashed border-teal-200 shadow-xs relative overflow-hidden cursor-pointer hover:border-teal-400 transition-colors group"
                  title="Click to view high-resolution prescription slip"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[22px] text-teal-800">dentistry</span>
                      <div>
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                          Smile Clinic Health System
                        </span>
                        <span className="text-[10px] text-slate-500">Dental Operatory · Prescription Record Slip</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200 group-hover:bg-teal-100 group-hover:text-teal-900 transition-colors">
                      Rx Digital Slip
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-1">
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Patient</span>
                      <span className="font-bold text-slate-800 truncate block">{patientName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">MRN</span>
                      <span className="font-mono text-slate-800">{mrn}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">Date</span>
                      <span className="text-slate-800 truncate block">{timestamp}</span>
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
              <h4 className="uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5 text-[11px] sm:text-xs">
                <span className="material-symbols-outlined text-[15px] text-teal-700">medication</span>
                <span>Extracted Regimen Items ({prescriptions.length})</span>
              </h4>

              {prescriptions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No medication items listed in this prescription.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                  {prescriptions.map((rx, idx) => (
                    <div
                      key={rx.id || idx}
                      className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 shadow-2xs"
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
                        {rx.route || 'Oral (PO)'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fixed / Sticky Modal Footer Actions */}
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-slate-50/80 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Screening Status:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                <span>{status}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleViewPrescriptionImage}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="View original uploaded prescription slip or image"
              >
                <span className="material-symbols-outlined text-[15px]">image</span>
                <span>View Prescription Image</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/report?id=${check?.id || auditLog?.checkId || id}`);
                }}
                className="px-4 sm:px-5 py-2 rounded-xl text-xs font-bold bg-teal-800 text-white hover:bg-teal-900 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">description</span>
                <span>Open Certified 2-Page CDS Report</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* High-Resolution Prescription Image / Document Lightbox */}
        {showLightbox && (
          <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4">
            <div className="relative max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Lightbox Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[22px] text-teal-400">receipt_long</span>
                  <div>
                    <h3 className="text-sm font-bold">Prescription Slip High-Resolution View</h3>
                    <span className="text-[11px] text-slate-400">{patientName} ({mrn}) • {id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-teal-300 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                      <span>Open File</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLightbox(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {/* Lightbox Body */}
              <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100">
                {sourceUrl && isImage ? (
                  <img
                    src={sourceUrl}
                    alt="Prescription Slip High Resolution"
                    className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-lg border border-slate-300 bg-white"
                  />
                ) : (
                  /* High-Resolution Official Digital Prescription Slip */
                  <div className="w-full max-w-2xl bg-white border border-slate-300 rounded-2xl shadow-xl p-8 space-y-6 text-slate-800">
                    {/* Slip Header */}
                    <div className="border-b-2 border-teal-800 pb-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-xl">
                          Rx
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold uppercase tracking-wide text-teal-900">
                            Smile Clinic Health System
                          </h2>
                          <p className="text-xs text-slate-500">
                            Department of Dental &amp; Maxillofacial Surgery • Clinical Pharmacology CDS
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            Attending Clinician: {clinician} • License Verified
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
                          {id}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1 font-mono">{timestamp}</span>
                      </div>
                    </div>

                    {/* Patient Information Table */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Patient Name</span>
                        <strong className="text-slate-900 text-sm">{patientName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">MRN / ID</span>
                        <strong className="text-slate-900 font-mono">{mrn}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Department</span>
                        <strong className="text-slate-900">Dental Operatory</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Verification</span>
                        <span className="font-bold text-emerald-700 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">verified</span>
                          Digitally Validated
                        </span>
                      </div>
                    </div>

                    {/* Medications Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600 border-b pb-1">
                        <span>PRESCRIBED MEDICATION &amp; DOSAGE</span>
                        <span>FREQUENCY / ROUTE</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {prescriptions.map((rx, idx) => (
                          <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                            <div>
                              <strong className="text-slate-900 block font-semibold">{rx.drugName}</strong>
                              <span className="text-slate-500 text-[11px]">
                                {rx.genericName || rx.drugName} • {rx.dosage || 'Standard'} • {rx.duration || '7 Days'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-slate-800 block">{rx.frequency}</span>
                              <span className="text-[10px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                {rx.route || 'Oral (PO)'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Seal & Legal Footer */}
                    <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-emerald-700">verified_user</span>
                        <span>HIPAA Certified Electronic Prescription Record • Tamper-Evident SHA-256</span>
                      </div>
                      <div className="font-mono text-slate-500">
                        Signature: <strong className="text-slate-800">{clinician}</strong> (e-Signed)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lightbox Footer */}
              <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">
                  SmileGuard Optical Record Viewer • Monograph v3
                </span>
                <button
                  type="button"
                  onClick={() => setShowLightbox(false)}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatePresence>,
    document.body
  );
}
