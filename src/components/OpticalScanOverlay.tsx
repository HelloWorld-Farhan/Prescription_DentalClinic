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

interface AgentStage {
  step: number;
  title: string;
  subtitle: string;
  icon: string;
  minPercent: number;
  maxPercent: number;
}

const AGENT_STAGES: AgentStage[] = [
  {
    step: 1,
    title: 'Cloud Vault Ingest',
    subtitle: 'Encrypting & syncing document to secure HIPAA vault...',
    icon: 'cloud_upload',
    minPercent: 0,
    maxPercent: 24,
  },
  {
    step: 2,
    title: 'PropNexAI Vision Agent',
    subtitle: 'Multimodal clinical vision agent scanning handwriting & layout...',
    icon: 'neurology',
    minPercent: 25,
    maxPercent: 49,
  },
  {
    step: 3,
    title: 'Entity & Dosage Extraction',
    subtitle: 'Extracting medications, strengths, frequencies & regimens...',
    icon: 'prescriptions',
    minPercent: 50,
    maxPercent: 74,
  },
  {
    step: 4,
    title: 'RxNorm & Rules Verification',
    subtitle: 'Cross-referencing drug database & screening interaction rules...',
    icon: 'verified_user',
    minPercent: 75,
    maxPercent: 100,
  },
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
  const [activeStageIndex, setActiveStageIndex] = useState(0);

  // Smooth real-time progress counter from 0% to 94% while scanning
  useEffect(() => {
    if (!isScanning) {
      if (progress > 0) {
        setProgress(100);
        setActiveStageIndex(AGENT_STAGES.length - 1);
        const t = setTimeout(() => {
          setProgress(0);
          setActiveStageIndex(0);
        }, 800);
        return () => clearTimeout(t);
      }
      return;
    }

    setProgress(5);
    setActiveStageIndex(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 94) return 94; // Hold gracefully near complete until backend returns
        const increment = Math.max(0.6, (94 - prev) * 0.055);
        const nextVal = Math.min(94, prev + increment);

        // Update active stage based on percentage (left to right)
        if (nextVal < 25) setActiveStageIndex(0);
        else if (nextVal < 50) setActiveStageIndex(1);
        else if (nextVal < 75) setActiveStageIndex(2);
        else setActiveStageIndex(3);

        return nextVal;
      });
    }, 110);

    return () => clearInterval(interval);
  }, [isScanning]);

  const isPdf = fileType?.toLowerCase().includes('pdf') || fileName?.toLowerCase().endsWith('.pdf');
  const isWord =
    fileType?.toLowerCase().includes('word') ||
    fileName?.toLowerCase().endsWith('.docx') ||
    fileName?.toLowerCase().endsWith('.doc');
  const isCsv = fileType?.toLowerCase().includes('csv') || fileName?.toLowerCase().endsWith('.csv');

  const currentStage = AGENT_STAGES[activeStageIndex] || AGENT_STAGES[0];
  const roundedPercent = Math.round(progress);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden bg-white border border-primary/25 shadow-sm flex flex-col justify-between select-none cursor-default ${className}`}
    >
      {/* 1. TOP CLINICAL HEADER BAR */}
      <div className="w-full px-4 sm:px-6 py-3 bg-surface-container-lowest/90 border-b border-surface-container-high/80 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs sm:text-sm font-bold text-on-surface tracking-tight truncate">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
            <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
            <span>Automated Agent Pipeline</span>
          </span>
          <span className="px-3 py-1 rounded-lg bg-surface-container text-primary font-mono text-xs sm:text-sm font-extrabold border border-primary/20 shadow-2xs">
            {roundedPercent}%
          </span>
        </div>
      </div>

      {/* 2. HORIZONTAL LEFT-TO-RIGHT AGENT STEPPER PIPELINE */}
      <div className="w-full px-4 sm:px-6 py-2.5 bg-gradient-to-r from-surface-container-lowest via-white to-surface-container-lowest border-b border-surface-container-high/60 z-20 shrink-0">
        <div className="relative flex items-center justify-between max-w-2xl mx-auto">
          {/* Connecting Track Line behind steps */}
          <div className="absolute left-6 right-6 top-4 h-0.5 bg-surface-container -z-0">
            <motion.div
              className="h-full bg-gradient-to-r from-teal-500 via-primary to-emerald-500"
              style={{ width: `${Math.min(100, (progress / 94) * 100)}%` }}
              transition={{ ease: 'easeOut', duration: 0.15 }}
            />
          </div>

          {/* Stepper Nodes (1 -> 2 -> 3 -> 4) */}
          {AGENT_STAGES.map((stg, idx) => {
            const isCompleted = activeStageIndex > idx || (!isScanning && progress === 100);
            const isActive = activeStageIndex === idx && isScanning;

            return (
              <div key={stg.step} className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all duration-300 shadow-xs ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                      : isActive
                      ? 'bg-primary text-white ring-4 ring-primary/20 scale-105 shadow-primary/30'
                      : 'bg-white text-outline border border-surface-container-high'
                  }`}
                >
                  {isCompleted ? (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  ) : isActive ? (
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                      className="material-symbols-outlined text-[18px]"
                    >
                      {stg.icon}
                    </motion.span>
                  ) : (
                    <span className="material-symbols-outlined text-[17px] opacity-70">
                      {stg.icon}
                    </span>
                  )}
                </div>

                <div className="mt-1.5 text-center">
                  <span
                    className={`block text-[10px] sm:text-[11px] font-bold tracking-tight whitespace-nowrap ${
                      isActive
                        ? 'text-primary'
                        : isCompleted
                        ? 'text-emerald-700'
                        : 'text-outline/70'
                    }`}
                  >
                    {stg.title}
                  </span>
                  <span className="hidden sm:block text-[9px] text-outline font-medium">
                    Step {stg.step} of 4
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. CENTER PREVIEW & OPTICAL LASER HUD (White Clinical Backdrop) */}
      <div className="relative w-full flex-1 flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-white via-surface-container-lowest to-white overflow-hidden min-h-[160px]">
        {/* Soft Background Grid Matrix */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle, #0d9488 0.75px, transparent 0.75px), linear-gradient(to right, rgba(13, 148, 136, 0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px, 48px 48px',
          }}
        />

        {/* Viewfinder Corner Brackets */}
        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-primary/40 pointer-events-none rounded-tl-sm" />
        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-primary/40 pointer-events-none rounded-tr-sm" />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-primary/40 pointer-events-none rounded-bl-sm" />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-primary/40 pointer-events-none rounded-br-sm" />

        {/* Content Body: Image or Document Card */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Prescription Scan"
            className="w-full h-auto max-h-[180px] sm:max-h-[220px] object-contain rounded-xl shadow-xs border border-surface-container-high transition-all"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-2 z-10">
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
                className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent pointer-events-none z-20 shadow-[0_0_12px_rgba(13,148,136,0.7)]"
              >
                <div className="mx-auto w-24 h-0.5 bg-white shadow-[0_0_8px_#ffffff]" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0.06 }}
                animate={{ opacity: [0.06, 0.18, 0.06] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                className="absolute inset-0 bg-gradient-to-b from-primary/5 via-teal-500/10 to-transparent pointer-events-none z-10"
              />
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 4. BOTTOM TELEMETRY STATUS & PROGRESS BAR */}
      <div className="w-full bg-surface-container-lowest border-t border-surface-container-high/80 p-3 sm:p-4 flex flex-col gap-2.5 z-20 shrink-0">
        {/* Dynamic Percentage Progress Track */}
        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-500 via-primary to-emerald-500 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.15 }}
          />
        </div>

        {/* Stage Status & Telemetry Description */}
        <div className="flex items-center justify-between text-xs font-medium text-on-surface gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isScanning ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                className="material-symbols-outlined text-primary text-[17px] shrink-0"
              >
                sync
              </motion.span>
            ) : (
              <span className="material-symbols-outlined text-emerald-600 text-[17px] shrink-0">
                task_alt
              </span>
            )}
            <div className="min-w-0">
              <span className="font-bold text-on-surface text-xs block truncate">
                {currentStage.subtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-mono font-bold">
              {roundedPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
