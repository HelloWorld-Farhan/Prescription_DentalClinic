import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MinimalExtractionOverlayProps {
  isExtracting: boolean;
  fileName?: string;
  onComplete?: () => void;
  title?: string;
  className?: string;
}

export default function MinimalExtractionOverlay({
  isExtracting,
  fileName,
  onComplete,
  className = '',
}: MinimalExtractionOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('Reading document...');
  const [isCompleted, setIsCompleted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isExtracting) {
      setShowOverlay(true);
      setIsCompleted(false);
      setProgress(6);
      setStageText('Reading document & pages...');

      let current = 6;
      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        // Smooth continuous advancement while waiting for processing
        if (current < 92) {
          const step = Math.max(1.2, (92 - current) * 0.085);
          current = Math.min(92, current + step);
        } else if (current < 97) {
          current += 0.45;
        }

        const rounded = Math.round(current);
        setProgress(rounded);

        if (rounded < 25) {
          setStageText('Reading document & pages...');
        } else if (rounded < 50) {
          setStageText('Multimodal vision OCR scanning...');
        } else if (rounded < 78) {
          setStageText('Extracting medications & dosages...');
        } else {
          setStageText('Screening interactions & rules...');
        }
      }, 70);
    } else if (showOverlay) {
      // Backend extraction complete: smoothly sweep to 100%
      if (intervalRef.current) clearInterval(intervalRef.current);

      setProgress(100);
      setStageText('Extraction Completed (100%)');
      setIsCompleted(true);

      const timer = setTimeout(() => {
        setShowOverlay(false);
        setIsCompleted(false);
        setProgress(0);
        if (onComplete) onComplete();
      }, 550);

      return () => clearTimeout(timer);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isExtracting]);

  if (!showOverlay) return null;

  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/75 backdrop-blur-[3px] rounded-2xl p-6 text-center select-none ${className}`}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          className="bg-white/95 rounded-2xl p-5 sm:p-6 shadow-xl border border-primary/20 flex flex-col items-center max-w-xs w-full"
        >
          {/* Circular Percentage Ring */}
          <div className="relative w-20 h-20 flex items-center justify-center mb-3">
            <svg className="w-20 h-20 -rotate-90 transform">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-primary/15"
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-primary transition-all duration-150 ease-out"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isCompleted ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="material-symbols-outlined text-primary text-3xl font-bold"
                >
                  check_circle
                </motion.span>
              ) : (
                <span className="text-lg font-extrabold text-on-surface font-mono tracking-tight">
                  {progress}%
                </span>
              )}
            </div>
          </div>

          {/* Dynamic Status Text */}
          <div className="space-y-1 w-full">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary">
              {!isCompleted ? (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
              <span className="truncate">{stageText}</span>
            </div>

            {fileName && (
              <p className="text-[11px] text-outline font-medium truncate max-w-[220px] mx-auto">
                {fileName}
              </p>
            )}
          </div>

          {/* Linear Progress Bar */}
          <div className="w-full bg-surface-container-high h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-600 via-primary to-teal-400 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
