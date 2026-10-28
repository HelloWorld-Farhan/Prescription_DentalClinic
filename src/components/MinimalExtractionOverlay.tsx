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
    let failsafeTimeout: any = null;

    if (isExtracting) {
      setShow(true);
      setProgress(1);
      progressRef.current = 1;

      // Failsafe: After 4.2 seconds, automatically transition to completion sweep
      failsafeTimeout = setTimeout(() => {
        isExtractingRef.current = false;
      }, 4200);

      // Smooth continuous real-time ticking from 1% to 99% without ever freezing
      interval = setInterval(() => {
        if (isExtractingRef.current) {
          if (progressRef.current < 85) {
            const step = Math.max(0.6, (85 - progressRef.current) * 0.035);
            progressRef.current = Math.min(85, progressRef.current + step);
          } else if (progressRef.current < 99) {
            // Smoothly tick through 90s all the way to 99% without stalling
            progressRef.current = Math.min(99, progressRef.current + 0.22);
          }
          setProgress(Math.round(progressRef.current));
        } else {
          // Accelerated sweep to 100% when backend work finishes
          if (progressRef.current < 100) {
            progressRef.current = Math.min(100, progressRef.current + 4.5);
            setProgress(Math.round(progressRef.current));
          } else {
            clearInterval(interval);
            setTimeout(() => {
              setShow(false);
              setProgress(1);
              progressRef.current = 1;
              if (onComplete) onComplete();
            }, 300);
          }
        }
      }, 30);
    } else if (show) {
      // Backend resolved; accelerate to 100%
      interval = setInterval(() => {
        if (progressRef.current < 100) {
          progressRef.current = Math.min(100, progressRef.current + 5);
          setProgress(Math.round(progressRef.current));
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setShow(false);
            setProgress(1);
            progressRef.current = 1;
            if (onComplete) onComplete();
          }, 300);
        }
      }, 25);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (failsafeTimeout) clearTimeout(failsafeTimeout);
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
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 z-30 flex items-center justify-center bg-white/85 backdrop-blur-md rounded-2xl pointer-events-none select-none overflow-hidden ${className}`}
      >
        {/* Ambient Floating Blurred Black Dots & Soft Charcoal Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Dot 1: Deep Charcoal floating orb */}
          <motion.div
            className="absolute w-32 h-32 rounded-full bg-slate-900/15 blur-2xl"
            animate={{
              x: ['-25%', '35%', '-15%'],
              y: ['-15%', '25%', '-20%'],
              scale: [1, 1.3, 0.9],
            }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
            style={{ top: '20%', left: '25%' }}
          />
          {/* Dot 2: Soft Black blur particle */}
          <motion.div
            className="absolute w-24 h-24 rounded-full bg-black/12 blur-xl"
            animate={{
              x: ['25%', '-30%', '15%'],
              y: ['20%', '-20%', '10%'],
              scale: [1.1, 0.85, 1.2],
            }}
            transition={{ repeat: Infinity, duration: 7, ease: 'easeInOut' }}
            style={{ top: '35%', right: '25%' }}
          />
          {/* Dot 3: Subtle Zinc dot */}
          <motion.div
            className="absolute w-20 h-20 rounded-full bg-zinc-800/14 blur-lg"
            animate={{
              x: ['-20%', '20%', '-20%'],
              y: ['10%', '-30%', '10%'],
            }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
            style={{ bottom: '15%', left: '40%' }}
          />
          {/* Dot 4: Accent soft slate dot */}
          <motion.div
            className="absolute w-16 h-16 rounded-full bg-slate-800/10 blur-md"
            animate={{
              x: ['15%', '-15%', '15%'],
              y: ['-20%', '15%', '-20%'],
            }}
            transition={{ repeat: Infinity, duration: 5.5, ease: 'easeInOut' }}
            style={{ top: '15%', right: '40%' }}
          />
        </div>

        {/* Real-Time Modern Percentage Display in Crisp Light Black / Charcoal */}
        <div className="relative z-10 flex items-baseline justify-center">
          <motion.span
            key="percentage-number"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-tighter bg-gradient-to-r from-slate-900 via-zinc-800 to-slate-700 bg-clip-text text-transparent drop-shadow-sm select-none"
          >
            {progress}%
          </motion.span>

          {/* Sequentially Pulsing Animated Dots in Light Black */}
          {!isFinished && (
            <span className="inline-flex items-center ml-1.5 text-4xl sm:text-5xl md:text-6xl font-black text-slate-700 tracking-widest select-none">
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
