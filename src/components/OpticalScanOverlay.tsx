import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OpticalScanOverlayProps {
  imageUrl?: string | null;
  fileName?: string;
  fileType?: string;
  isScanning: boolean;
  title?: string;
  className?: string;
}

const SCAN_STAGES = [
  { label: 'Ingesting to Secure Cloud Vault...', icon: 'lock' },
  { label: 'PropNexAI Model 3 Optical Layout Scan...', icon: 'document_scanner' },
  { label: 'Deciphering Doctor Handwriting & Dosage...', icon: 'neurology' },
  { label: 'Cross-Referencing RxNorm & Clinical Safety Rules...', icon: 'verified_user' },
  { label: 'Extraction Verified & Ready for Review', icon: 'check_circle' },
];

export default function OpticalScanOverlay({
  imageUrl,
  fileName,
  fileType,
  isScanning,
  title = 'PropNexAI Agent Model 3 · Clinical Extraction',
  className = '',
}: OpticalScanOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  // Smooth real-time progress counter from 0% to 95% while scanning
  useEffect(() => {
    if (!isScanning) {
      if (progress > 0) {
        setProgress(100);
        setStageIndex(SCAN_STAGES.length - 1);
        const t = setTimeout(() => {
          setProgress(0);
          setStageIndex(0);
        }, 800);
        return () => clearTimeout(t);
      }
      return;
    }

    setProgress(4);
    setStageIndex(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return 94; // Hold gracefully near complete until backend returns
        const increment = Math.max(0.6, (94 - prev) * 0.06);
        const nextVal = Math.min(94, prev + increment);

        // Update stage label based on percentage
        if (nextVal < 25) setStageIndex(0);
        else if (nextVal < 50) setStageIndex(1);
        else if (nextVal < 75) setStageIndex(2);
        else setStageIndex(3);

        return nextVal;
      });
    }, 110);

    return () => clearInterval(interval);
  }, [isScanning]);

  const isPdf = fileType?.toLowerCase().includes('pdf') || fileName?.toLowerCase().endsWith('.pdf');
  const isWord = fileType?.toLowerCase().includes('word') || fileName?.toLowerCase().endsWith('.docx') || fileName?.toLowerCase().endsWith('.doc');
  const isCsv = fileType?.toLowerCase().includes('csv') || fileName?.toLowerCase().endsWith('.csv');

  const currentStage = SCAN_STAGES[stageIndex] || SCAN_STAGES[0];
  const roundedPercent = Math.round(progress);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-white border border-surface-container-high shadow-lg flex flex-col items-center justify-between select-none ${className}`}
    >
      {/* Top Clinical Header Bar */}
      <div className="w-full px-4 py-2.5 bg-surface-container-lowest border-b border-surface-container-high/80 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs" />
          <span className="text-xs font-bold text-on-surface tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
            Live Analysis
          </span>
          <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-[11px] font-mono font-bold">
            {roundedPercent}%
          </span>
        </div>
      </div>

      {/* Main Preview Canvas (White / Light Clean Clinical Backdrop) */}
      <div className="relative w-full flex-1 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-white via-surface-container-lowest to-white overflow-hidden min-h-[190px]">
        {/* Soft Background Grid Matrix */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle, #0d9488 0.75px, transparent 0.75px), linear-gradient(to right, rgba(13, 148, 136, 0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px, 48px 48px',
          }}
        />

        {/* High-tech Viewfinder Corner Brackets */}
        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-primary/40 pointer-events-none rounded-tl-sm" />
        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-primary/40 pointer-events-none rounded-tr-sm" />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-primary/40 pointer-events-none rounded-bl-sm" />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-primary/40 pointer-events-none rounded-br-sm" />

        {/* Content Body: Image or Document Card */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Prescription Scan"
            className="w-full h-auto max-h-[220px] sm:max-h-[270px] object-contain rounded-xl shadow-xs border border-surface-container-high transition-all"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-2.5 z-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shadow-xs">
              <span className="material-symbols-outlined text-[32px]">
                {isPdf ? 'picture_as_pdf' : isWord ? 'description' : isCsv ? 'table_chart' : 'article'}
              </span>
            </div>
            <div className="space-y-0.5 max-w-sm px-2">
              <div className="text-xs sm:text-sm font-bold text-on-surface truncate">
                {fileName || 'Prescription Document'}
              </div>
              <div className="text-[11px] font-medium text-outline">
                {isPdf
                  ? 'Portable Document Format (PDF)'
                  : isWord
                  ? 'Microsoft Word Document (.docx)'
                  : isCsv
                  ? 'CSV Tabular Clinical Record'
                  : 'Clinical Prescription Document'}
              </div>
            </div>
          </div>
        )}

        {/* Animated Clinical Scanning Beam (Soft Teal / Primary Flare) */}
        <AnimatePresence>
          {isScanning && (
            <>
              <motion.div
                initial={{ top: '6%' }}
                animate={{ top: ['6%', '92%', '6%'] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent pointer-events-none z-20 shadow-[0_0_12px_rgba(13,148,136,0.7)]"
              >
                <div className="mx-auto w-24 h-0.5 bg-white shadow-[0_0_8px_#ffffff]" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0.08 }}
                animate={{ opacity: [0.08, 0.22, 0.08] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="absolute inset-0 bg-gradient-to-b from-primary/5 via-teal-500/10 to-transparent pointer-events-none z-10"
              />
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Progress Bar & Real-Time Telemetry Bar */}
      <div className="w-full bg-surface-container-lowest border-t border-surface-container-high/80 p-3 sm:p-3.5 flex flex-col gap-2 z-20">
        {/* Dynamic Percentage Progress Track */}
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-500 via-primary to-emerald-500 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.15 }}
          />
        </div>

        {/* Stage Status & Percentage Text */}
        <div className="flex items-center justify-between text-xs font-medium text-on-surface gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isScanning ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                className="material-symbols-outlined text-primary text-[16px] shrink-0"
              >
                progress_activity
              </motion.span>
            ) : (
              <span className="material-symbols-outlined text-emerald-600 text-[16px] shrink-0">
                check_circle
              </span>
            )}
            <span className="font-semibold truncate text-[11px] sm:text-xs text-on-surface">
              {currentStage.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-mono font-bold text-primary">
              {roundedPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
