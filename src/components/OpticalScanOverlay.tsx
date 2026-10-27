import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OpticalScanOverlayProps {
  imageUrl: string;
  isScanning: boolean;
  title?: string;
  className?: string;
}

const SCAN_STEPS = [
  'Enhancing contrast & optical deskew...',
  'Analyzing handwriting & typography glyphs...',
  'Extracting medications, strengths & regimens...',
  'Cross-referencing RxNorm & clinical database...',
  'Extraction verified & normalized.',
];

export default function OpticalScanOverlay({
  imageUrl,
  isScanning,
  title = 'Optical Prescription Scanner',
  className = '',
}: OpticalScanOverlayProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isScanning) {
      setCurrentStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev < SCAN_STEPS.length - 1 ? prev + 1 : prev));
    }, 450);
    return () => clearInterval(interval);
  }, [isScanning]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-slate-950 border border-emerald-500/30 shadow-2xl flex items-center justify-center select-none ${className}`}
    >
      {/* Background Image Preview */}
      <img
        src={imageUrl}
        alt="Prescription Slip"
        className={`w-full h-auto max-h-[380px] sm:max-h-[460px] object-contain transition-all duration-500 ${
          isScanning ? 'brightness-90 contrast-110 blur-[0.5px]' : 'brightness-100'
        }`}
      />

      {/* Optical HUD Grid Matrix */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle, #10b981 1px, transparent 1px), linear-gradient(to right, rgba(16, 185, 129, 0.05) 1px, transparent 1px)',
          backgroundSize: '24px 24px, 48px 48px',
        }}
      />

      {/* High-tech Viewfinder Corner Reticles */}
      <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
      <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-emerald-400 pointer-events-none" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />

      {/* Active Scanning Laser Beam */}
      <AnimatePresence>
        {isScanning && (
          <>
            {/* Traversing Laser Line */}
            <motion.div
              initial={{ top: '2%' }}
              animate={{ top: ['2%', '96%', '2%'] }}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-300 to-transparent pointer-events-none z-20 shadow-[0_0_18px_#34d399,0_0_35px_#10b981]"
            >
              {/* Laser Core Flare */}
              <div className="mx-auto w-32 h-1 bg-white shadow-[0_0_12px_#ffffff]" />
            </motion.div>

            {/* Trailing Optical Glow */}
            <motion.div
              initial={{ opacity: 0.15 }}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-teal-500/10 pointer-events-none z-10"
            />
          </>
        )}
      </AnimatePresence>

      {/* Top HUD Badge */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{title}</span>
        </div>
        <div className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md border border-slate-700 text-[10px] font-mono text-slate-300">
          AI VISION · 99.4% CONFIDENCE
        </div>
      </div>

      {/* Bottom Telemetry Display Bar */}
      <div className="absolute bottom-3 inset-x-3 z-20 pointer-events-none">
        <div className="px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-emerald-500/30 flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            {isScanning ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="material-symbols-outlined text-emerald-400 text-[16px] shrink-0"
              >
                autorenew
              </motion.span>
            ) : (
              <span className="material-symbols-outlined text-emerald-400 text-[16px] shrink-0">
                check_circle
              </span>
            )}
            <span className="text-xs font-mono font-semibold text-emerald-300 truncate">
              {isScanning ? SCAN_STEPS[currentStepIndex] : 'Clinical entities extracted successfully'}
            </span>
          </div>

          <span className="text-[10px] font-mono text-slate-400 shrink-0">
            {isScanning ? `${((currentStepIndex + 1) / SCAN_STEPS.length * 100).toFixed(0)}%` : '100%'}
          </span>
        </div>
      </div>
    </div>
  );
}
