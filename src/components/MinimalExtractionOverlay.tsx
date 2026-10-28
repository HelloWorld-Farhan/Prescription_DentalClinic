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
            // Smoothly tick through 90s all the way to 99% without stalling
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-2xl pointer-events-none select-none overflow-hidden ${className}`}
      >
        {/* Soft Ambient Floating Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-36 h-36 rounded-full bg-teal-500/10 blur-2xl"
            animate={{
              x: ['-20%', '25%', '-15%'],
              y: ['-10%', '20%', '-15%'],
              scale: [1, 1.25, 0.95],
            }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
            style={{ top: '20%', left: '25%' }}
          />
          <motion.div
            className="absolute w-28 h-28 rounded-full bg-slate-900/8 blur-xl"
            animate={{
              x: ['20%', '-25%', '15%'],
              y: ['15%', '-15%', '10%'],
              scale: [1.1, 0.9, 1.15],
            }}
            transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
            style={{ bottom: '25%', right: '25%' }}
          />
        </div>

        {/* Central Glassmorphic Card Container */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 8 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          className="relative z-10 flex flex-col items-center justify-center p-6 sm:p-7 rounded-3xl bg-white/85 shadow-2xl border border-white/80 backdrop-blur-xl max-w-xs w-full mx-4"
        >
          {/* Circular SVG Ring & Central Percentage Display */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 136 136">
              <defs>
                <linearGradient id="tealPercentageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
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
                stroke="url(#tealPercentageGrad)"
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
          <div className="mt-4 flex flex-col items-center gap-1">
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
      </motion.div>
    </AnimatePresence>
  );
}
