import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MinimalExtractionOverlayProps {
  isExtracting: boolean;
  onComplete?: () => void;
  className?: string;
  label?: string;
}

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

      // Smooth continuous real-time ticking from 1% to 99% without ever freezing
      interval = setInterval(() => {
        if (isExtractingRef.current) {
          if (progressRef.current < 85) {
            const step = Math.max(0.65, (85 - progressRef.current) * 0.04);
            progressRef.current = Math.min(85, progressRef.current + step);
          } else if (progressRef.current < 99) {
            progressRef.current = Math.min(99, progressRef.current + 0.25);
          }
          setProgress(Math.round(progressRef.current));
        } else {
          // Accelerated sweep to 100% when backend work finishes
          if (progressRef.current < 100) {
            progressRef.current = Math.min(100, progressRef.current + 5.5);
            setProgress(Math.round(progressRef.current));
          } else {
            clearInterval(interval);
            setTimeout(() => {
              setShow(false);
              setProgress(1);
              progressRef.current = 1;
              if (onComplete) onComplete();
            }, 350);
          }
        }
      }, 25);
    } else if (show) {
      // Backend resolved; accelerate swiftly to 100%
      interval = setInterval(() => {
        if (progressRef.current < 100) {
          progressRef.current = Math.min(100, progressRef.current + 6.5);
          setProgress(Math.round(progressRef.current));
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setShow(false);
            setProgress(1);
            progressRef.current = 1;
            if (onComplete) onComplete();
          }, 350);
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

  // SVG circular geometry
  const radius = 56;
  const circumference = 2 * Math.PI * radius; // ~351.86
  const strokeDashoffset = circumference - (circumference * Math.min(progress, 100)) / 100;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Dark blurred clinical backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Central Glassmorphic Modal Popup Card */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 14 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 flex flex-col items-center justify-center p-7 sm:p-8 rounded-3xl bg-white shadow-2xl border border-slate-100 max-w-xs w-full mx-auto select-none ${className}`}
        >
          {/* Circular SVG Ring & Central Percentage Display */}
          <div className="relative w-36 h-36 flex items-center justify-center">
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
              <motion.circle
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
                }}
                transition={{ ease: 'linear', duration: 0.05 }}
              />
            </svg>

            {/* In-Ring Digital Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {!isFinished ? (
                <div className="flex items-baseline justify-center">
                  <motion.span
                    key="percentage-number"
                    className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-slate-900 tabular-nums leading-none select-none"
                  >
                    {progress}
                  </motion.span>
                  <span className="text-xl sm:text-2xl font-black text-[#007782] ml-0.5 select-none leading-none">
                    %
                  </span>
                </div>
              ) : (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 350 }}
                  className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30"
                >
                  <span className="material-symbols-outlined text-[28px] font-bold">check</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Elegant Status Pill Underneath */}
          <div className="mt-4 flex flex-col items-center gap-1 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-[#005c65] border border-teal-200/80 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007782]"></span>
              </span>
              <span>{!isFinished ? label : 'Extraction Complete'}</span>
            </div>

            <span className="text-[11px] font-medium text-slate-500 tracking-tight">
              {!isFinished ? 'Parsing clinical monographs & normalization' : 'Verified by SmileGuard AI'}
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
