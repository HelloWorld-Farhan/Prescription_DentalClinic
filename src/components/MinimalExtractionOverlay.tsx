import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MinimalExtractionOverlayProps {
  isExtracting: boolean;
  onComplete?: () => void;
  className?: string;
  label?: string;
}

const EXTRACTION_STAGES = [
  { min: 0, max: 25, title: 'Vault Ingest', detail: 'Encrypting & syncing slip to secure HIPAA cloud vault' },
  { min: 25, max: 55, title: 'Multimodal Vision AI', detail: 'Scanning handwritten medications, dosages & instructions' },
  { min: 55, max: 85, title: 'Monograph Normalization', detail: 'Standardizing clinical entities & active ingredients' },
  { min: 85, max: 100, title: 'Regimen Staging', detail: 'Cross-referencing contraindications & staging queue' },
];

export default function MinimalExtractionOverlay({
  isExtracting,
  onComplete,
  className = '',
  label = 'AI Multimodal Extraction Active',
}: MinimalExtractionOverlayProps) {
  const [progress, setProgress] = useState(1);
  const [show, setShow] = useState(false);
  const progressRef = useRef(1);
  const isExtractingRef = useRef(isExtracting);
  isExtractingRef.current = isExtracting;

  useEffect(() => {
    let interval: any = null;
    let failsafeTimeout: any = null;

    if (isExtracting) {
      setShow(true);
      setProgress(1);
      progressRef.current = 1;

      // Failsafe timeout to prevent any infinite stall
      failsafeTimeout = setTimeout(() => {
        isExtractingRef.current = false;
      }, 4500);

      // Smooth continuous real-time ticking from 1% to 99% without stalling
      interval = setInterval(() => {
        if (isExtractingRef.current) {
          if (progressRef.current < 85) {
            const step = Math.max(0.65, (85 - progressRef.current) * 0.045);
            progressRef.current = Math.min(85, progressRef.current + step);
          } else if (progressRef.current < 99) {
            progressRef.current = Math.min(99, progressRef.current + 0.35);
          }
          setProgress(Math.round(progressRef.current));
        } else {
          // Accelerated sweep to 100% when backend work finishes
          if (progressRef.current < 100) {
            progressRef.current = Math.min(100, progressRef.current + 6.0);
            setProgress(Math.round(progressRef.current));
          } else {
            clearInterval(interval);
            setTimeout(() => {
              setShow(false);
              setProgress(1);
              progressRef.current = 1;
              if (onComplete) onComplete();
            }, 400);
          }
        }
      }, 25);
    } else if (show) {
      // Backend resolved; accelerate swiftly to 100%
      interval = setInterval(() => {
        if (progressRef.current < 100) {
          progressRef.current = Math.min(100, progressRef.current + 7.0);
          setProgress(Math.round(progressRef.current));
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setShow(false);
            setProgress(1);
            progressRef.current = 1;
            if (onComplete) onComplete();
          }, 400);
        }
      }, 20);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (failsafeTimeout) clearTimeout(failsafeTimeout);
    };
  }, [isExtracting]);

  if (!show) return null;

  const isFinished = progress >= 100;

  // Accurate SVG circular geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.29
  const strokeDashoffset = circumference - (circumference * Math.min(progress, 100)) / 100;

  // Polar coordinates for traveling head dot on perimeter
  const angle = (Math.min(progress, 100) / 100) * 360 - 90;
  const headX = 68 + radius * Math.cos((angle * Math.PI) / 180);
  const headY = 68 + radius * Math.sin((angle * Math.PI) / 180);

  const currentStage =
    EXTRACTION_STAGES.find((s) => progress >= s.min && progress <= s.max) ||
    EXTRACTION_STAGES[EXTRACTION_STAGES.length - 1];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Dark blurred clinical backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Central Standard Modal Popup Card */}
        <motion.div
          initial={{ scale: 0.93, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.93, opacity: 0, y: 14 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 flex flex-col items-center bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 sm:p-7 max-w-sm w-full mx-auto select-none ${className}`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between w-full pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[20px]">document_scanner</span>
              </div>
              <div className="text-left">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                  Multimodal AI Extraction
                </h3>
                <span className="text-[10px] text-slate-500 font-medium">Gemini Vision Pipeline</span>
              </div>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Active
            </span>
          </div>

          {/* Circular SVG Ring & Central Percentage Display */}
          <div className="relative w-40 h-40 flex items-center justify-center my-1">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 136 136">
              <defs>
                <linearGradient id="tealPercentageGradModal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#005c65" />
                  <stop offset="50%" stopColor="#007782" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>

              {/* Background Track */}
              <circle
                cx="68"
                cy="68"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="7"
                fill="none"
              />

              {/* Dynamic Animated Foreground Stroke */}
              <circle
                cx="68"
                cy="68"
                r={radius}
                stroke="url(#tealPercentageGradModal)"
                strokeWidth="7"
                strokeLinecap="round"
                fill="none"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset,
                  transition: 'stroke-dashoffset 0.08s linear',
                }}
              />

              {/* Dynamic Traveling Head Dot on Circumference */}
              {!isFinished && progress > 2 && (
                <circle
                  cx={headX}
                  cy={headY}
                  r="5.5"
                  fill="#005c65"
                  className="filter drop-shadow-[0_0_4px_rgba(0,119,130,0.6)]"
                />
              )}
            </svg>

            {/* In-Ring Digital Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {!isFinished ? (
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 tabular-nums leading-none select-none">
                    {progress}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#007782] ml-0.5 select-none leading-none">
                    %
                  </span>
                </div>
              ) : (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 350 }}
                  className="w-13 h-13 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"
                >
                  <span className="material-symbols-outlined text-[30px] font-bold">check</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Real-Time Clinical Telemetry Underneath */}
          <div className="mt-4 flex flex-col items-center gap-1.5 text-center w-full">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-[#005c65] border border-teal-200/80 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007782]"></span>
              </span>
              <span>{!isFinished ? currentStage.title : 'Extraction Complete'}</span>
            </div>

            <p className="text-xs font-medium text-slate-600 leading-snug max-w-xs">
              {!isFinished ? currentStage.detail : 'Prescription medications extracted and ready for review'}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
