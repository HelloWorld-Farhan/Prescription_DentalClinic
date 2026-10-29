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
    title: 'SmileGuard Multimodal Vision AI',
    subtitle: 'Multimodal vision agent scanning handwritten script & layout...',
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
    subtitle: 'Cross-referencing drug monograph & screening interaction rules...',
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

    setProgress(6);
    setActiveStageIndex(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return 98; // Hold gracefully near complete until backend returns
        const increment = Math.max(0.65, (98 - prev) * 0.055);
        const nextVal = Math.min(98, prev + increment);

        // Update active stage based on percentage (1 -> 2 -> 3 -> 4)
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
  const isCsv =
    fileType?.toLowerCase().includes('csv') ||
    fileType?.toLowerCase().includes('sheet') ||
    fileName?.toLowerCase().endsWith('.csv') ||
    fileName?.toLowerCase().endsWith('.xlsx');

  const currentStage = AGENT_STAGES[activeStageIndex] || AGENT_STAGES[0];
  const roundedPercent = Math.round(progress);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden backdrop-blur-md bg-white/90 border border-primary/25 shadow-sm flex flex-col justify-between select-none cursor-default ${className}`}
    >
      {/* 1. TOP MINIMALIST HEADER BAR */}
      <div className="w-full px-5 py-3 border-b border-surface-container-high/60 flex items-center justify-between z-20 shrink-0 bg-white/60 backdrop-blur-xs">
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
            <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
            <span>Live Analysis</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-surface-container text-primary font-mono text-xs sm:text-sm font-extrabold border border-primary/20">
            {roundedPercent}%
          </span>
        </div>
      </div>

      {/* 2. CENTER PREVIEW & SUBTLE SCANNING LASER (Frosted Glass Canvas) */}
      <div className="relative w-full flex-1 flex flex-col items-center justify-center p-6 overflow-hidden min-h-[170px]">
        {/* Soft Ambient Radial Glow */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(13,148,136,0.06)_0%,transparent_70%)]" />

        {/* Content Body: Image or Document Card */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Prescription Scan"
            className="w-full h-auto max-h-[180px] sm:max-h-[210px] object-contain rounded-xl shadow-xs border border-surface-container-high transition-all z-10"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center gap-2.5 z-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
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

        {/* Subtle Sweeping Laser Beam */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ top: '10%' }}
              animate={{ top: ['10%', '90%', '10%'] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent pointer-events-none z-20 shadow-[0_0_10px_rgba(13,148,136,0.7)]"
            >
              <div className="mx-auto w-20 h-0.5 bg-white shadow-[0_0_6px_#ffffff]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. BOTTOM TELEMETRY: SMOOTH BOTTOM-TO-TOP STAGE TRANSITION */}
      <div className="w-full bg-white/70 backdrop-blur-xs border-t border-surface-container-high/60 p-4 flex flex-col gap-3 z-20 shrink-0">
        {/* Sleek Gradient Progress Bar */}
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-500 via-primary to-emerald-500 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.15 }}
          />
        </div>

        {/* Vertical Bottom-to-Top Sliding Stage Ticker */}
        <div className="relative h-6 overflow-hidden flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStageIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex items-center justify-between text-xs text-on-surface gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isScanning ? (
                  <span className="material-symbols-outlined text-primary text-[17px] shrink-0 animate-spin">
                    sync
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-emerald-600 text-[17px] shrink-0">
                    task_alt
                  </span>
                )}
                <span className="font-semibold text-on-surface text-xs truncate">
                  {currentStage.subtitle}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-outline font-medium hidden sm:inline">
                  Step {currentStage.step} of 4
                </span>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-mono font-bold">
                  {roundedPercent}%
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
