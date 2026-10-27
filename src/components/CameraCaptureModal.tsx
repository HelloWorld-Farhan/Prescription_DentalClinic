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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
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

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-2xl bg-surface-container-lowest rounded-3xl overflow-hidden shadow-2xl border border-surface-container-high flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-on-surface">Capture Clinical Document Scan</h3>
                <p className="text-[11px] text-on-surface-variant">
                  High-definition optical scan compatible with phones and laptops
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Viewfinder / Capture Canvas Container */}
          <div className="relative flex-1 bg-black flex items-center justify-center min-h-[340px] sm:min-h-[420px] overflow-hidden">
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
                  className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors"
                >
                  Retry Camera
                </button>
              </div>
            ) : capturedImage ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <img
                  src={capturedImage}
                  alt="Captured document"
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold flex items-center gap-1.5 backdrop-blur-xs">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Photo Captured</span>
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                {isInitializing && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 text-white gap-2">
                    <span className="material-symbols-outlined text-[32px] animate-spin text-primary">
                      sync
                    </span>
                    <span className="text-xs font-medium">Connecting to camera sensor...</span>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover max-h-[70vh]"
                />
                {/* Viewfinder Target Guidelines */}
                <div className="absolute inset-8 pointer-events-none border-2 border-white/40 border-dashed rounded-2xl flex items-center justify-center">
                  <span className="text-white/60 text-xs font-semibold px-3 py-1 rounded-full bg-black/40 backdrop-blur-xs">
                    Align Prescription or Clinical Guideline within frame
                  </span>
                </div>
              </div>
            )}

            {/* Hidden canvas for drawing frame */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Footer Controls */}
          <div className="px-5 py-4 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-3">
            {!capturedImage ? (
              <>
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-surface-container-high bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container cursor-pointer transition-colors"
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
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[20px]">circle</span>
                  <span>Capture Photo</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={retakeSnapshot}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-surface-container-high bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  <span>Retake</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-outline hover:text-on-surface cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={acceptSnapshot}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
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
