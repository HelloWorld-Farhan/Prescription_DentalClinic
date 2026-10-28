import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MinimalExtractionOverlayProps {
  isExtracting: boolean;
  onComplete?: () => void;
  className?: string;
}

export default function MinimalExtractionOverlay({
  isExtracting,
  onComplete,
  className = '',
}: MinimalExtractionOverlayProps) {
  const [progress, setProgress] = useState(1);
  const [show, setShow] = useState(false);
  const progressRef = useRef(1);
  const isExtractingRef = useRef(isExtracting);
  isExtractingRef.current = isExtracting;

  useEffect(() => {
    let interval: any = null;

    if (isExtracting) {
      setShow(true);
      setProgress(1);
      progressRef.current = 1;

      // Smooth continuous real-time ticking
      interval = setInterval(() => {
        if (isExtractingRef.current) {
          // Continuous progress while async work is underway
          if (progressRef.current < 92) {
            const step = Math.max(0.5, (92 - progressRef.current) * 0.022);
            progressRef.current = Math.min(92, progressRef.current + step);
          } else if (progressRef.current < 97) {
            progressRef.current += 0.15;
          }
          setProgress(Math.round(progressRef.current));
        } else {
          // Accelerated sweep to 100% when backend work finishes
          if (progressRef.current < 100) {
            progressRef.current = Math.min(100, progressRef.current + 3.5);
            setProgress(Math.round(progressRef.current));
          } else {
            clearInterval(interval);
            setTimeout(() => {
              setShow(false);
              setProgress(1);
              progressRef.current = 1;
              if (onComplete) onComplete();
            }, 380);
          }
        }
      }, 35);
    } else if (show) {
      // Backend resolved; accelerate to 100%
      interval = setInterval(() => {
        if (progressRef.current < 100) {
          progressRef.current = Math.min(100, progressRef.current + 4);
          setProgress(Math.round(progressRef.current));
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setShow(false);
            setProgress(1);
            progressRef.current = 1;
            if (onComplete) onComplete();
          }, 380);
        }
      }, 30);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isExtracting]);

  if (!show) return null;

  const isFinished = progress >= 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 z-30 flex items-center justify-center bg-white/45 backdrop-blur-[1px] rounded-2xl pointer-events-none select-none overflow-hidden ${className}`}
      >
        {/* Subtle Ambient Floating Blurred Orbs in Background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute w-28 h-28 rounded-full bg-slate-900/10 blur-xl"
            animate={{
              x: ['-20%', '30%', '-10%'],
              y: ['-10%', '20%', '-20%'],
              scale: [1, 1.25, 0.95],
            }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
            style={{ top: '30%', left: '35%' }}
          />
          <motion.div
            className="absolute w-36 h-36 rounded-full bg-teal-500/15 blur-2xl"
            animate={{
              x: ['20%', '-25%', '15%'],
              y: ['20%', '-15%', '10%'],
              scale: [1.1, 0.9, 1.2],
            }}
            transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
            style={{ top: '25%', right: '30%' }}
          />
          <motion.div
            className="absolute w-20 h-20 rounded-full bg-emerald-600/10 blur-lg"
            animate={{
              x: ['-15%', '25%', '-15%'],
              y: ['15%', '-25%', '15%'],
            }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
            style={{ bottom: '20%', left: '45%' }}
          />
        </div>

        {/* Real-Time Modern Percentage Display with Sequentially Pulsing Triple Dots */}
        <div className="relative z-10 flex items-baseline justify-center">
          <motion.span
            key="percentage-number"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-tighter bg-gradient-to-r from-teal-950 via-primary to-teal-600 bg-clip-text text-transparent drop-shadow-sm select-none"
          >
            {progress}%
          </motion.span>

          {/* Sequentially Pulsing Animated Dots (Active while counting up to 100%) */}
          {!isFinished && (
            <span className="inline-flex items-center ml-1.5 text-4xl sm:text-5xl md:text-6xl font-black text-primary/70 tracking-widest select-none">
              <motion.span
                animate={{ opacity: [0.15, 1, 0.15] }}
                transition={{ repeat: Infinity, duration: 1.1, delay: 0, ease: 'easeInOut' }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.15, 1, 0.15] }}
                transition={{ repeat: Infinity, duration: 1.1, delay: 0.22, ease: 'easeInOut' }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.15, 1, 0.15] }}
                transition={{ repeat: Infinity, duration: 1.1, delay: 0.44, ease: 'easeInOut' }}
              >
                .
              </motion.span>
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
