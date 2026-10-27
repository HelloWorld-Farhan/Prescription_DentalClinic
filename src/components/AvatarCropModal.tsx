import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadToR2, deleteFromR2, deleteDocumentRecord } from '../services/storageService';
import { authApi } from '../services/authApi';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  currentAvatarUrl?: string;
  userEmail: string;
  userName: string;
  onClose: () => void;
  onSuccess: (savedUrl: string) => void;
  onReplaceImage?: (newSrc: string) => void;
}

export default function AvatarCropModal({
  isOpen,
  imageSrc: initialImageSrc,
  currentAvatarUrl,
  userEmail,
  userName,
  onClose,
  onSuccess,
  onReplaceImage,
}: AvatarCropModalProps) {
  const [currentImageSrc, setCurrentImageSrc] = useState<string | null>(initialImageSrc);
  const [scale, setScale] = useState(1.0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [savingStage, setSavingStage] = useState('Saving to Cloudflare R2...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Display crop frame dimensions (360px on desktop, 300px on mobile)
  const displayCropSize = 360;

  // Sync image source when prop updates
  useEffect(() => {
    setCurrentImageSrc(initialImageSrc);
  }, [initialImageSrc]);

  // Fit presets: Fill all 4 corners (Cover) or Fit whole picture (Contain)
  const handleFitCover = useCallback(() => {
    if (!naturalSize.width || !naturalSize.height) return;
    const { width: w, height: h } = naturalSize;
    // Scale needed so that both dimensions reach or exceed the square frame
    const coverScale = Math.max(w, h) / Math.min(w, h);
    setScale(parseFloat(Math.max(1.0, coverScale).toFixed(2)));
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, [naturalSize]);

  const handleFitContain = useCallback(() => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  }, []);

  // Automatically calculate ideal framing for the person when image loads
  const handleImageLoad = useCallback(() => {
    if (!imgRef.current) return;
    const natW = imgRef.current.naturalWidth || 512;
    const natH = imgRef.current.naturalHeight || 512;
    setNaturalSize({ width: natW, height: natH });

    // Fit the 100% whole picture by default with zero upper-area cutoff
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setErrorMessage(null);
  }, []);

  // Reset transforms whenever modal opens
  useEffect(() => {
    if (isOpen && currentImageSrc) {
      setScale(1.0);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setErrorMessage(null);
    }
  }, [isOpen, currentImageSrc]);

  // Pointer / Drag Handlers for fluid shifting
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
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

  // Mouse Wheel Zoom Listener inside viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setScale((s) => Math.min(3.5, Math.max(0.5, parseFloat((s + delta).toFixed(2)))));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [containerRef.current]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1.0);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };

  // Replace image handler (strictly image only)
  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|tiff|svg)$/i.test(file.name);
    if (!isImage) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP, GIF, etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCurrentImageSrc(reader.result);
        if (onReplaceImage) onReplaceImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // High-Resolution 1:1 Pixel-Accurate Canvas Crop and Cloudflare R2 Upload
  const handleConfirmCrop = async () => {
    if (!currentImageSrc || !imgRef.current) return;
    setIsSaving(true);
    setSavingStage('Cropping & optimizing photo...');

    try {
      const outputSize = 640; // High-resolution crystal clear avatar
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas rendering context not available');
      }

      // Fill with clean white background (no dark borders)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);

      const img = imgRef.current;
      const natW = naturalSize.width || img.naturalWidth || 512;
      const natH = naturalSize.height || img.naturalHeight || 512;
      const maxDim = Math.max(natW, natH);

      // Measure exact rendered dimension of containerRef in DOM to guarantee 1:1 match
      const containerBox = containerRef.current?.getBoundingClientRect();
      const currentBoxSize = (containerBox && containerBox.width > 0) ? containerBox.width : displayCropSize;
      const factor = outputSize / currentBoxSize;

      // Base dimensions rendered on screen before scaling
      const renderedW = (natW / maxDim) * currentBoxSize;
      const renderedH = (natH / maxDim) * currentBoxSize;

      ctx.save();
      // 1. Move to canvas center
      ctx.translate(outputSize / 2, outputSize / 2);
      // 2. Apply drag translation (scaled to canvas coordinates)
      ctx.translate(position.x * factor, position.y * factor);
      // 3. Apply user zoom scale
      ctx.scale(scale, scale);
      // 4. Apply rotation around center
      ctx.rotate((rotation * Math.PI) / 180);

      // 5. Draw image centered
      const drawW = renderedW * factor;
      const drawH = renderedH * factor;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      setSavingStage('Uploading to Cloudflare R2...');

      // Convert canvas to JPEG Blob with high quality
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.94)
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
      const r2Result = await uploadToR2(
        file,
        userEmail,
        userName,
        `avatar_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`
      );
      const savedUrl = r2Result.url;

      // Identify previous avatar URL to purge from Cloudflare R2
      const emailKey = userEmail.toLowerCase().trim();
      let oldAvatarUrl = currentAvatarUrl;
      if (!oldAvatarUrl && typeof window !== 'undefined') {
        oldAvatarUrl = localStorage.getItem(`smileclinic_avatar_${emailKey}`) || '';
        if (!oldAvatarUrl) {
          try {
            const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
            oldAvatarUrl = u.photoUrl || '';
          } catch {}
        }
      }

      // Purge previous avatar from Cloudflare R2 if it's an R2 URL and different
      if (oldAvatarUrl && oldAvatarUrl !== savedUrl) {
        const isR2 =
          oldAvatarUrl.includes('r2.dev') ||
          oldAvatarUrl.includes('cloudflarestorage.com') ||
          oldAvatarUrl.includes('uploads/');
        if (isR2) {
          try {
            await deleteFromR2(oldAvatarUrl);
            await deleteDocumentRecord('', oldAvatarUrl);
          } catch (delErr) {
            console.warn('[AvatarCropModal] Failed to delete previous avatar from R2:', delErr);
          }
        }
      }

      // Persist locally scoped to exact email
      localStorage.setItem(`smileclinic_avatar_${emailKey}`, savedUrl);

      // Persist to backend database so other devices (e.g. mobile phones) get the avatar
      setSavingStage('Syncing clinical profile...');
      try {
        await authApi.updateProfile({
          email: userEmail,
          photo_url: savedUrl,
        });
      } catch (dbErr) {
        console.warn('[AvatarCropModal] Failed to sync photoUrl to backend database:', dbErr);
      }

      try {
        const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
        u.photoUrl = savedUrl;
        localStorage.setItem('smileclinic_auth_user', JSON.stringify(u));
      } catch {}

      // Dispatch global profile update event for Navbar and Layout
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

  if (!isOpen || !currentImageSrc) return null;

  // Calculate rendered image dimensions in viewport to ensure 100% whole picture fits by default
  const maxDim = naturalSize.width && naturalSize.height
    ? Math.max(naturalSize.width, naturalSize.height)
    : 512;
  const renderedWidth = naturalSize.width ? (naturalSize.width / maxDim) * displayCropSize : displayCropSize;
  const renderedHeight = naturalSize.height ? (naturalSize.height / maxDim) * displayCropSize : displayCropSize;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-5 select-none print:hidden">
        {/* Animated Full-Screen Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 bg-black/65 backdrop-blur-md cursor-pointer"
          onClick={isSaving ? undefined : onClose}
        />

        {/* Modal Window Container matching SmileClinic UI Modal Architecture */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14, filter: 'blur(5px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-xl sm:max-w-2xl bg-surface-container-lowest border border-surface-container-high rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-surface-container flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[22px]">crop</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-on-surface">
                  Crop &amp; Frame Profile Photo
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Face is auto-centered. Drag to shift, scroll wheel or slider to zoom.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="p-2 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              title="Close modal"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2 shrink-0">
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

          {/* Interactive Crop Viewport Area (Clean White Light Theme) */}
          <div className="p-5 sm:p-6 flex flex-col items-center justify-center bg-white relative overflow-hidden border-y border-surface-container">
            {/* Viewport Frame with generous size */}
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                width: `${displayCropSize}px`,
                height: `${displayCropSize}px`,
                maxWidth: '100%',
                maxHeight: '100%',
                aspectRatio: '1 / 1',
              }}
              className="relative rounded-2xl overflow-hidden border-2 border-primary/60 cursor-grab active:cursor-grabbing shadow-lg flex items-center justify-center touch-none bg-white shrink-0 select-none"
            >
              {/* Profile Avatar Squircle Frame Matching User Profile Badge */}
              <div
                className="absolute inset-0 rounded-2xl border-2 border-primary/60 pointer-events-none z-20 shadow-[0_0_0_9999px_rgba(255,255,255,0.78)]"
              />

              {/* Dashed Inner Trim Guide */}
              <div
                className="absolute inset-0 rounded-2xl border border-dashed border-primary/30 pointer-events-none z-20"
              />

              {/* Center Guidance Crosshair Marker */}
              <div className="absolute w-5 h-5 pointer-events-none z-20 flex items-center justify-center text-primary/40">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </div>

              {/* Transformed Image Preview */}
              <img
                ref={imgRef}
                src={currentImageSrc}
                alt="Profile Source"
                draggable={false}
                onLoad={handleImageLoad}
                style={{
                  width: `${renderedWidth}px`,
                  height: `${renderedHeight}px`,
                  minWidth: `${renderedWidth}px`,
                  minHeight: `${renderedHeight}px`,
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                }}
                className="pointer-events-none select-none object-cover"
              />
            </div>

            {/* Hint & Gesture Indicators */}
            <div className="mt-3.5 flex items-center gap-3 text-xs font-semibold text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">pan_tool</span>
                <span>Drag to shift</span>
              </span>
              <span className="text-surface-container-high">•</span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-teal-600">mouse</span>
                <span>Mouse wheel to zoom</span>
              </span>
            </div>
          </div>

          {/* Interactive Controls Bar */}
          <div className="p-4 sm:p-5 border-t border-surface-container flex flex-col gap-3.5 bg-surface-container-low/40 shrink-0">
            {/* Zoom Slider (0.5x to 3.5x for full zoom in and zoom out) */}
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-outline text-[18px] shrink-0">zoom_out</span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.5, parseFloat((s - 0.15).toFixed(2))))}
                className="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                -
              </button>

              <input
                type="range"
                min="0.5"
                max="3.5"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-primary cursor-pointer h-2 bg-surface-container-high rounded-lg"
              />

              <button
                type="button"
                onClick={() => setScale((s) => Math.min(3.5, parseFloat((s + 0.15).toFixed(2))))}
                className="w-8 h-8 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold text-on-surface flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                title="Zoom In"
                aria-label="Zoom In"
              >
                +
              </button>
              <span className="material-symbols-outlined text-outline text-[18px] shrink-0">zoom_in</span>
              <span className="text-xs font-mono font-bold text-on-surface w-12 text-right">
                {scale.toFixed(2)}x
              </span>
            </div>

            {/* Quick Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFitCover}
                  className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-bold text-primary flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Fill all 4 corners without white borders"
                >
                  <span className="material-symbols-outlined text-[16px]">aspect_ratio</span>
                  <span>Fill Frame</span>
                </button>

                <button
                  type="button"
                  onClick={handleFitContain}
                  className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Fit 100% of whole photo"
                >
                  <span className="material-symbols-outlined text-[16px]">fit_screen</span>
                  <span>Fit Photo</span>
                </button>

                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-primary">rotate_right</span>
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

                <button
                  type="button"
                  onClick={() => replaceFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">image</span>
                  <span>Replace Photo</span>
                </button>
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.tiff,.svg"
                  className="hidden"
                  onChange={handleReplaceFile}
                />
              </div>

              {/* R2 Cloudflare Indicator */}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 font-bold">
                <span className="material-symbols-outlined text-[14px] text-emerald-600">cloud_done</span>
                <span>Direct Cloudflare R2</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-surface-container flex items-center justify-between gap-3 bg-surface-container-lowest shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-surface-container-high text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <motion.button
              type="button"
              layout
              whileHover={{ scale: isSaving ? 1 : 1.02 }}
              whileTap={{ scale: isSaving ? 1 : 0.98 }}
              disabled={isSaving}
              onClick={handleConfirmCrop}
              className="min-w-[210px] h-11 px-6 rounded-xl bg-primary text-white hover:bg-primary-hover font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-85 relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {isSaving ? (
                  <motion.div
                    key="saving"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2.5"
                  >
                    <svg className="saving-spinner w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-95" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="truncate">{savingStage}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Save &amp; Apply Avatar</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
