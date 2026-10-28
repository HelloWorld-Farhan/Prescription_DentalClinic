import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export interface MinimalExtractionOverlayProps {
  isExtracting: boolean;
  onComplete?: () => void;
  onClose?: () => void;
  className?: string;
  label?: string;
}

const EXTRACTION_STAGES = [
  { id: 1, min: 0, max: 25, title: 'Vault Ingest', detail: 'Encrypting & uploading slip to secure HIPAA cloud storage' },
  { id: 2, min: 25, max: 55, title: 'Multimodal Vision OCR', detail: 'Scanning handwritten medications, dosages & instructions' },
  { id: 3, min: 55, max: 85, title: 'Monograph Normalization', detail: 'Standardizing active ingredients against RxNorm pharmacopeia' },
  { id: 4, min: 85, max: 100, title: 'Regimen Staging', detail: 'Cross-referencing contraindications & staging queue' },
];

export default function MinimalExtractionOverlay({
  isExtracting,
  onComplete,
  onClose,
  className = '',
  label = 'AI Multimodal Extraction Active',
}: MinimalExtractionOverlayProps) {
  const [progress, setProgress] = useState(1);
  const [show, setShow] = useState(false);
  
  // Stable refs to prevent re-render cancellations
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const currentProgressRef = useRef(1);
  const isClosingRef = useRef(false);

  // 1. When extraction starts
  useEffect(() => {
    if (isExtracting) {
      setShow(true);
      isClosingRef.current = false;
      currentProgressRef.current = 1;
      setProgress(1);

      let animFrame: number;
      const startTime = performance.now();

      const animateHoldingCurve = (now: number) => {
        if (isClosingRef.current) return;

        const elapsed = now - startTime;
        // Natural asymptotic progression that caps at 94% while waiting for backend
        const ratio = 1 - Math.exp(-elapsed / 2200);
        const p = Math.min(94, Math.max(1, Math.round(ratio * 94)));

        currentProgressRef.current = p;
        setProgress(p);

        animFrame = requestAnimationFrame(animateHoldingCurve);
      };

      animFrame = requestAnimationFrame(animateHoldingCurve);

      return () => {
        if (animFrame) cancelAnimationFrame(animFrame);
      };
    }
  }, [isExtracting]);

  // 2. When extraction completes (isExtracting flips from true to false while modal is open)
  useEffect(() => {
    if (!isExtracting && show && !isClosingRef.current) {
      isClosingRef.current = true;

      // Swiftly sweep from currentProgressRef (e.g. 70-94%) to 100%
      const startP = currentProgressRef.current;
      const sweepDuration = 280; // ms
      const sweepStart = performance.now();
      let sweepFrame: number;

      const sweepTo100 = (now: number) => {
        const elapsed = now - sweepStart;
        const progressFrac = Math.min(1, elapsed / sweepDuration);
        const currentSweepP = Math.round(startP + (100 - startP) * progressFrac);

        currentProgressRef.current = currentSweepP;
        setProgress(currentSweepP);

        if (progressFrac < 1) {
          sweepFrame = requestAnimationFrame(sweepTo100);
        } else {
          // Reached exactly 100% with checkmark
          setProgress(100);
          currentProgressRef.current = 100;

          // Give clinician 450ms visual confirmation of completion, then smoothly close
          setTimeout(() => {
            setShow(false);
            setProgress(1);
            currentProgressRef.current = 1;
            isClosingRef.current = false;
            if (onCompleteRef.current) {
              onCompleteRef.current();
            }
          }, 450);
        }
      };

      sweepFrame = requestAnimationFrame(sweepTo100);

      return () => {
        if (sweepFrame) cancelAnimationFrame(sweepFrame);
      };
    }
  }, [isExtracting, show]);

  const handleDismiss = () => {
    isClosingRef.current = true;
    setShow(false);
    setProgress(1);
    currentProgressRef.current = 1;
    if (onCloseRef.current) {
      onCloseRef.current();
    }
  };

  if (!show) return null;
  if (typeof document === 'undefined') return null;

  const isFinished = progress >= 100;

  // Accurate SVG circular geometry
  const radius = 56;
  const circumference = 2 * Math.PI * radius; // ~351.86
  const strokeDashoffset = circumference - (circumference * Math.min(progress, 100)) / 100;

  // Polar coordinates for traveling head dot on perimeter
  const angle = (Math.min(progress, 100) / 100) * 360 - 90;
  const headX = 70 + radius * Math.cos((angle * Math.PI) / 180);
  const headY = 70 + radius * Math.sin((angle * Math.PI) / 180);

  const currentStage =
    EXTRACTION_STAGES.find((s) => progress >= s.min && progress <= s.max) ||
    EXTRACTION_STAGES[EXTRACTION_STAGES.length - 1];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] overflow-y-auto flex items-center justify-center p-3 sm:p-5 print:hidden">
        {/* Backdrop matching all system modals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={handleDismiss}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window Container - Matching ClinicalInquiriesModal & PrescriptionCopyModal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className={`relative z-10 w-full max-w-lg bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-2xl flex flex-col gap-5 max-h-[92vh] overflow-hidden ${className}`}
        >
          {/* Top Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">document_scanner</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    Multimodal AI Prescription Extraction
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isFinished 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-teal-50 text-[#005c65] border border-teal-200'
                  }`}>
                    {isFinished ? 'Extraction Complete' : 'Active Pipeline'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gemini Vision OCR &amp; Clinical CDS Monograph Pipeline
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors shrink-0"
              title="Close popup"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Central Circular Progress Ring */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
                <defs>
                  <linearGradient id="tealPercentageGradModal" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#005c65" />
                    <stop offset="50%" stopColor="#007782" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>

                {/* Background Track */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  className="stroke-slate-100"
                  strokeWidth="8"
                  fill="none"
                />

                {/* Dynamic Animated Foreground Stroke */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  stroke="url(#tealPercentageGradModal)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset,
                    transition: 'stroke-dashoffset 0.05s linear',
                  }}
                />

                {/* Dynamic Traveling Head Dot on Circumference */}
                {!isFinished && progress > 2 && (
                  <circle
                    cx={headX}
                    cy={headY}
                    r="5.5"
                    fill="#005c65"
                    className="filter drop-shadow-[0_0_5px_rgba(0,119,130,0.7)]"
                  />
                )}
              </svg>

              {/* In-Ring Digital Readout */}
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                {!isFinished ? (
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-black font-mono tracking-tight text-slate-900 tabular-nums leading-none">
                      {progress}
                    </span>
                    <span className="text-2xl font-black text-[#007782] ml-0.5 leading-none">
                      %
                    </span>
                  </div>
                ) : (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 350 }}
                    className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"
                  >
                    <span className="material-symbols-outlined text-[32px] font-bold">check</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Active Stage Badge & Description */}
            <div className="mt-4 flex flex-col items-center gap-1 text-center w-full">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-[#005c65] border border-teal-200/80 shadow-2xs">
                {!isFinished ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#007782]"></span>
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 font-bold">check_circle</span>
                )}
                <span>{!isFinished ? currentStage.title : 'Extraction Complete — Ready for Review'}</span>
              </div>

              <p className="text-xs text-slate-600 mt-1 max-w-sm">
                {!isFinished ? currentStage.detail : 'Medications identified, verified, and staged into safety queue'}
              </p>
            </div>
          </div>

          {/* Connected 4-Step Pipeline Stepper */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {EXTRACTION_STAGES.map((stage) => {
              const isPassed = progress > stage.max;
              const isCurrent = progress >= stage.min && progress <= stage.max;

              return (
                <div
                  key={stage.id}
                  className={`flex flex-col items-center text-center p-2 rounded-xl transition-colors ${
                    isPassed
                      ? 'bg-emerald-50/70 text-emerald-800'
                      : isCurrent
                      ? 'bg-teal-50 text-[#005c65] ring-1 ring-teal-200'
                      : 'bg-slate-50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    {isPassed ? (
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                    ) : (
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent ? 'bg-[#007782] text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {stage.id}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold leading-tight line-clamp-1">{stage.title}</span>
                </div>
              );
            })}
          </div>

          {/* Bottom Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-medium">
              HIPAA &amp; Monograph Compliance Active
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel / Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
