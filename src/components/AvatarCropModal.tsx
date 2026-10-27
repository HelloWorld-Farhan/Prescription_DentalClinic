import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadToR2 } from '../services/storageService';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  userEmail: string;
  userName: string;
  onClose: () => void;
  onSuccess: (savedUrl: string) => void;
}

export default function AvatarCropModal({
  isOpen,
  imageSrc,
  userEmail,
  userName,
  onClose,
  onSuccess,
}: AvatarCropModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset transforms whenever a new image is loaded
  useEffect(() => {
    if (isOpen && imageSrc) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setErrorMessage(null);
    }
  }, [isOpen, imageSrc]);

  // Pointer Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  // Perform canvas crop and save to Cloudflare R2
  const handleConfirmCrop = async () => {
    if (!imageSrc || !imgRef.current) return;
    setIsSaving(true);

    try {
      const outputSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas rendering context not available');
      }

      // Fill with clean background
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, outputSize, outputSize);

      const img = imgRef.current;
      const natW = img.naturalWidth || 512;
      const natH = img.naturalHeight || 512;

      // Translate to center of canvas
      ctx.save();
      ctx.translate(outputSize / 2, outputSize / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Scale ratio based on crop frame (260px display frame)
      const displayCropSize = 260;
      const factor = outputSize / displayCropSize;

      ctx.translate(position.x * factor, position.y * factor);
      ctx.scale(scale, scale);

      // Draw image centered
      const drawW = (natW / Math.min(natW, natH)) * outputSize;
      const drawH = (natH / Math.min(natW, natH)) * outputSize;

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Convert canvas to Blob
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );

      if (!blob) {
        throw new Error('Failed to create image blob from cropped canvas.');
      }

      const file = new File(
        [blob],
        `avatar_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );

      // Upload directly to Cloudflare R2
      const r2Result = await uploadToR2(file, userEmail, userName);
      const savedUrl = r2Result.url;

      // Persist locally scoped to exact email
      const emailKey = userEmail.toLowerCase().trim();
      localStorage.setItem(`smileclinic_avatar_${emailKey}`, savedUrl);

      try {
        const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
        u.photoUrl = savedUrl;
        localStorage.setItem('smileclinic_auth_user', JSON.stringify(u));
      } catch {}

      // Dispatch global profile update event for Layout and other components
      window.dispatchEvent(
        new CustomEvent('smileclinic_avatar_updated', {
          detail: { url: savedUrl, avatarUrl: savedUrl, email: emailKey },
        })
      );

      onSuccess(savedUrl);
      onClose();
    } catch (err: any) {
      console.error('Avatar cropping / R2 upload error:', err);
      setErrorMessage(err?.message || 'Failed to upload cropped image to Cloudflare R2.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={isSaving ? undefined : onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-surface-container flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                <span className="material-symbols-outlined text-[22px]">crop</span>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-on-surface">
                  Crop &amp; Position Profile Photo
                </h3>
                <p className="text-[11px] text-outline mt-0.5">
                  Drag to reposition, adjust zoom slider, and save to Cloudflare R2.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">error</span>
              <span className="flex-1">{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-600 hover:text-rose-900 cursor-pointer text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Interactive Crop Viewport */}
          <div className="p-4 sm:p-6 flex flex-col items-center justify-center bg-slate-950/95 relative select-none">
            {/* Viewport Frame */}
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative w-[260px] h-[260px] rounded-2xl overflow-hidden border-2 border-primary/60 cursor-grab active:cursor-grabbing shadow-inner flex items-center justify-center touch-none bg-slate-900"
            >
              {/* Circular Guide Mask Overlay */}
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/60 pointer-events-none z-10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />

              {/* Center Crosshair Marker */}
              <div className="absolute w-3 h-3 pointer-events-none z-10 flex items-center justify-center text-white/40">
                <span className="material-symbols-outlined text-[18px]">add</span>
              </div>

              {/* Transformed Image */}
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Source to crop"
                draggable={false}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                }}
                className="max-w-none max-h-none pointer-events-none object-contain select-none"
              />
            </div>

            {/* Instruction Badge */}
            <div className="mt-3 text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-primary">touch_app</span>
              <span>Click &amp; drag inside frame to center your face</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="p-4 sm:p-5 border-t border-surface-container flex flex-col gap-4 bg-surface-container-low/40">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-outline text-[18px] shrink-0">zoom_out</span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
                className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-primary cursor-pointer h-1.5 bg-surface-container-high rounded-lg"
              />
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3, s + 0.15))}
                className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center justify-center cursor-pointer"
              >
                +
              </button>
              <span className="material-symbols-outlined text-outline text-[18px] shrink-0">zoom_in</span>
              <span className="text-[11px] font-mono font-bold text-on-surface w-10 text-right">
                {scale.toFixed(1)}x
              </span>
            </div>

            {/* Quick Actions (Rotate & Reset) */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">rotate_right</span>
                  <span>Rotate 90°</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span>Reset</span>
                </button>
              </div>

              {/* R2 Cloudflare Indicator */}
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold">
                <span className="material-symbols-outlined text-[13px] text-emerald-600">cloud_done</span>
                <span>Direct Cloudflare R2</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-surface-container flex items-center justify-between gap-3 bg-surface-container-lowest">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmCrop}
              className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Uploading to R2...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[17px]">check</span>
                  <span>Save &amp; Apply Avatar</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
