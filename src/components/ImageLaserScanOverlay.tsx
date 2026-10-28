import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface ImageLaserScanOverlayProps {
  imageUrl: string;
  isScanning: boolean;
  className?: string;
}

export default function ImageLaserScanOverlay({
  imageUrl,
  isScanning,
  className = '',
}: ImageLaserScanOverlayProps) {
  const [progress, setProgress] = useState(1);
  const progressRef = useRef(1);

  useEffect(() => {
    let interval: any = null;
    if (isScanning) {
      setProgress(1);
      progressRef.current = 1;
      interval = setInterval(() => {
        if (progressRef.current < 94) {
          const step = Math.max(0.6, (94 - progressRef.current) * 0.025);
          progressRef.current = Math.min(94, progressRef.current + step);
          setProgress(Math.round(progressRef.current));
        } else if (progressRef.current < 99) {
          progressRef.current += 0.15;
          setProgress(Math.round(progressRef.current));
        }
      }, 35);
    } else {
      setProgress(100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScanning]);

  const isFinished = progress >= 100;

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-primary/25 bg-surface-container-lowest flex items-center justify-center max-h-[380px] ${className}`}>
      {/* Image Preview */}
      <img
        src={imageUrl}
        alt="Optical Scan Preview"
        className={`w-full max-h-[380px] object-contain transition-all duration-300 ${
          isScanning ? 'filter brightness-95 contrast-105' : ''
        }`}
      />

      {/* Laser Scanning Line Animation - Active only when isScanning is true */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Sweeping Teal Laser Beam */}
          <motion.div
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_18px_#2dd4bf,0_0_30px_#0f766e]"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{
              repeat: Infinity,
              duration: 2.2,
              ease: 'easeInOut',
            }}
          >
            {/* Subtle trailing light glow */}
            <div className="w-full h-16 bg-gradient-to-b from-teal-500/15 to-transparent -translate-y-full" />
          </motion.div>

          {/* Large Centered Percentage during Image Scan */}
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="flex items-baseline justify-center">
              <span className="text-6xl sm:text-7xl font-black font-mono tracking-tighter bg-gradient-to-r from-teal-950 via-primary to-teal-600 bg-clip-text text-transparent drop-shadow-md select-none">
                {progress}%
              </span>
              {!isFinished && (
                <span className="inline-flex items-center ml-1 text-4xl sm:text-5xl font-black text-primary/70 tracking-widest select-none">
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
          </div>
        </div>
      )}
    </div>
  );
}
