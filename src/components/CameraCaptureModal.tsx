import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize and stop camera stream cleanly
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setCameraError(null);
      return;
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();
    setIsInitializing(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera initiation failed:', err);
      setCameraError(
        err?.message ||
          'Unable to access camera. Please allow camera permissions in your browser or try uploading an image.'
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const w = video.videoWidth || video.clientWidth || 1280;
    const h = video.videoHeight || video.clientHeight || 720;
    if (w <= 0 || h <= 0) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the current video frame onto canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  const retakeSnapshot = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  const acceptSnapshot = () => {
    if (!capturedImage) return;

    // Convert data URL to Blob and File
    const arr = capturedImage.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const filename = `camera_scan_${Date.now()}.jpg`;
    const file = new File([blob], filename, { type: 'image/jpeg' });

    onCapture(file);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-5 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="relative w-full max-w-2xl bg-surface-container-lowest rounded-3xl overflow-hidden shadow-2xl border border-surface-container-high flex flex-col max-h-[92dvh] my-auto"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-on-surface truncate">
                  Capture Clinical Document Scan
                </h3>
                <p className="text-[10px] sm:text-[11px] text-on-surface-variant truncate">
                  High-definition optical scan compatible with phones and laptops
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors shrink-0"
              aria-label="Close camera modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Viewfinder / Capture Canvas Container with Responsive 4-Corner Padding */}
          <div className="flex-1 min-h-0 p-3 sm:p-5 bg-surface-container-lowest flex flex-col justify-center items-center">
            <div className="relative w-full h-[50vh] sm:h-[55vh] max-h-[480px] rounded-2xl sm:rounded-3xl bg-slate-950 border border-slate-800/80 shadow-inner overflow-hidden flex items-center justify-center p-2 sm:p-3">
              {cameraError ? (
                <div className="p-6 text-center text-white max-w-md flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[28px]">videocam_off</span>
                  </div>
                  <h4 className="text-sm font-bold text-rose-300">Camera Access Issue</h4>
                  <p className="text-xs text-white/70 leading-relaxed">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    Retry Camera
                  </button>
                </div>
              ) : capturedImage ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured document"
                    className="max-h-full max-w-full w-auto h-auto object-contain rounded-xl shadow-lg border border-white/10"
                  />
                  <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-md shadow-md border border-emerald-400/30">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Photo Captured</span>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  {isInitializing && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 text-white gap-2 backdrop-blur-xs">
                      <span className="material-symbols-outlined text-[32px] animate-spin text-primary">
                        sync
                      </span>
                      <span className="text-xs font-medium">Connecting to optical sensor...</span>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain max-h-full rounded-xl"
                  />

                  {/* Optical Scanner Corner Target Guides & Status HUD */}
                  <div className="absolute inset-3 sm:inset-5 pointer-events-none rounded-xl flex flex-col justify-between">
                    {/* Top Row with Corner Brackets & Live Indicator */}
                    <div className="flex items-start justify-between">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-t-2 border-l-2 border-primary rounded-tl-lg shadow-sm" />
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-white/10 text-white text-[10px] sm:text-xs font-semibold backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Viewfinder</span>
                      </div>
                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-t-2 border-r-2 border-primary rounded-tr-lg shadow-sm" />
                    </div>

                    {/* Center Guidance Pill */}
                    <div className="relative flex items-center justify-center py-2">
                      <span className="text-white/85 text-[11px] sm:text-xs font-medium px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-white/15 backdrop-blur-md shadow-md text-center max-w-[85%]">
                        Align Prescription or Clinical Guideline within frame
                      </span>
                    </div>

                    {/* Bottom Row with Corner Brackets */}
                    <div className="flex items-end justify-between">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-b-2 border-l-2 border-primary rounded-bl-lg shadow-sm" />
                      <div className="w-6 h-6 sm:w-8 sm:h-8 border-b-2 border-r-2 border-primary rounded-br-lg shadow-sm" />
                    </div>
                  </div>
                </div>
              )}

              {/* Hidden canvas for drawing frame */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-2 sm:gap-3 shrink-0">
            {!capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container cursor-pointer transition-colors shrink-0"
                  title="Switch between front and back camera"
                >
                  <span className="material-symbols-outlined text-[18px]">cameraswitch</span>
                  <span className="hidden sm:inline">
                    {facingMode === 'user' ? 'Use Back Camera' : 'Use Front Camera'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={Boolean(cameraError) || isInitializing}
                  onClick={takeSnapshot}
                  className="flex items-center gap-2 px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-primary text-white text-xs sm:text-sm font-bold hover:bg-primary-hover shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-white flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white" />
                  </span>
                  <span>Capture Photo</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-outline hover:text-on-surface cursor-pointer transition-colors shrink-0"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={retakeSnapshot}
                  className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-surface-container-high bg-surface-container-lowest text-on-surface text-xs font-bold hover:bg-surface-container cursor-pointer transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  <span>Retake</span>
                </button>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-outline hover:text-on-surface cursor-pointer transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={acceptSnapshot}
                    className="flex items-center gap-1.5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    <span>Use This Photo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
