import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MinimalExtractionOverlayProps {
  isExtracting: boolean;
  progress?: number;
  className?: string;
}

export default function MinimalExtractionOverlay({
  isExtracting,
  progress = 0,
  className = '',
}: MinimalExtractionOverlayProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    if (!isExtracting) {
      if (progress >= 100) {
        setDisplayProgress(100);
      }
      return;
    }

    const target = Math.min(100, Math.max(0, Math.round(progress)));
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < target) {
          const step = Math.max(1, Math.ceil((target - prev) * 0.25));
          return Math.min(target, prev + step);
        } else if (prev > target) {
          return target;
        }
        return prev;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [isExtracting, progress]);

  if (!isExtracting) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 z-30 flex items-center justify-center bg-white/45 backdrop-blur-[1px] rounded-2xl pointer-events-none select-none ${className}`}
      >
        <motion.span
          key="percentage-display"
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="text-7xl sm:text-8xl md:text-9xl font-black text-primary font-mono tracking-tighter drop-shadow-md select-none"
        >
          {displayProgress}%
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );
}
