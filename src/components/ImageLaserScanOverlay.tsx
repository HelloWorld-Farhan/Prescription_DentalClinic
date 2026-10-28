import React from 'react';
import { motion } from 'framer-motion';

interface ImageLaserScanOverlayProps {
  imageUrl: string;
  isScanning: boolean;
  progress?: number;
  className?: string;
}

export default function ImageLaserScanOverlay({
  imageUrl,
  isScanning,
  progress = 0,
  className = '',
}: ImageLaserScanOverlayProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden border border-primary/25 bg-slate-950 flex items-center justify-center max-h-[380px] ${className}`}>
      {/* Image Preview */}
      <img
        src={imageUrl}
        alt="Optical Scan Preview"
        className={`w-full max-h-[380px] object-contain transition-all duration-300 ${
          isScanning ? 'filter brightness-90 contrast-105' : ''
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
          {progress > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
              <span className="text-6xl sm:text-7xl font-black text-white font-mono tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] select-none">
                {Math.round(progress)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
