import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface OtpVerificationInputProps {
  value: string[];
  onChange: (val: string[]) => void;
  status?: 'idle' | 'verifying' | 'success' | 'error';
  errorMessage?: string;
  disabled?: boolean;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
}

export default function OtpVerificationInput({
  value,
  onChange,
  status = 'idle',
  errorMessage,
  disabled = false,
  onComplete,
  autoFocus = true
}: OtpVerificationInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && status === 'idle' && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, status]);

  const handleChange = (index: number, val: string) => {
    if (disabled || status === 'success' || status === 'verifying') return;

    // Sanitize to single digit
    const cleaned = val.replace(/\D/g, '');
    const newArr = [...value];

    if (cleaned.length > 0) {
      newArr[index] = cleaned[cleaned.length - 1];
      onChange(newArr);

      // Focus next input
      if (index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }

      // If all 6 filled, fire onComplete
      const fullCode = newArr.join('');
      if (fullCode.length === 6 && onComplete) {
        onComplete(fullCode);
      }
    } else {
      newArr[index] = '';
      onChange(newArr);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0 && inputRefs.current[index - 1]) {
        const newArr = [...value];
        newArr[index - 1] = '';
        onChange(newArr);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newArr = [...value];
        newArr[index] = '';
        onChange(newArr);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newArr = Array(6).fill('');
    for (let i = 0; i < pasted.length; i++) {
      newArr[i] = pasted[i];
    }
    onChange(newArr);

    const targetIndex = Math.min(pasted.length, 5);
    inputRefs.current[targetIndex]?.focus();

    if (pasted.length === 6 && onComplete) {
      onComplete(pasted);
    }
  };

  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isVerifying = status === 'verifying';

  return (
    <div className="flex flex-col items-center justify-center w-full gap-3">
      {/* 6-BOX OR SUCCESS/ERROR MORPH WRAPPER */}
      <div className="relative min-h-[72px] w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            /* ================================================================= */
            /* SUCCESS MORPH: 6 boxes merged into glowing round badge with Green Tick */
            /* ================================================================= */
            <motion.div
              key="success-badge"
              initial={{ scale: 0.3, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 22 }}
              className="flex flex-col items-center justify-center gap-2"
            >
              <div className="relative flex items-center justify-center">
                {/* Outer Glow Halo Ring */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [1, 1.35, 1.2], opacity: [0.6, 0.2, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute w-20 h-20 rounded-full bg-emerald-500/30 blur-md pointer-events-none"
                />

                {/* Circular Emerald Badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-xl shadow-emerald-500/35 border-2 border-emerald-300 z-10"
                >
                  <svg
                    className="w-9 h-9 text-white stroke-current stroke-[3.5]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <motion.path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.15 }}
                    />
                  </svg>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="flex flex-col items-center"
              >
                <span className="text-sm font-extrabold text-emerald-800 tracking-tight">
                  Verification Confirmed
                </span>
                <span className="text-[11px] text-emerald-600 font-medium">
                  2FA Credential Match Verified
                </span>
              </motion.div>
            </motion.div>
          ) : (
            /* ================================================================= */
            /* 6 OTP BOXES (With Shake on Error & Round Morph on Submission) */
            /* ================================================================= */
            <motion.div
              key="otp-boxes-grid"
              initial={false}
              animate={
                isError
                  ? { x: [-14, 14, -10, 10, -5, 5, 0] }
                  : { x: 0 }
              }
              transition={
                isError
                  ? { duration: 0.45, ease: 'easeInOut' }
                  : { type: 'spring', stiffness: 350, damping: 25 }
              }
              className="flex items-center justify-center gap-2 sm:gap-3 py-1"
              onPaste={handlePaste}
            >
              {Array.from({ length: 6 }).map((_, idx) => {
                const digit = value[idx] || '';
                const isFilled = digit.length > 0;

                return (
                  <motion.div
                    key={idx}
                    animate={
                      isVerifying
                        ? {
                            borderRadius: ['16px', '50%', '16px'],
                            scale: [1, 0.95, 1],
                            transition: { duration: 0.8, repeat: Infinity, delay: idx * 0.1 }
                          }
                        : isError
                        ? { scale: [1, 0.96, 1] }
                        : { scale: 1 }
                    }
                    className="relative"
                  >
                    <input
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      disabled={disabled || isVerifying}
                      value={digit}
                      onChange={(e) => handleChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className={`w-11 sm:w-13 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono outline-none transition-all duration-200 select-none ${
                        isError
                          ? 'bg-rose-50 border-2 border-rose-500 text-rose-700 shadow-sm shadow-rose-200 rounded-2xl ring-2 ring-rose-400/20'
                          : isFilled
                          ? 'bg-surface-container-lowest border-2 border-primary text-primary shadow-xs rounded-2xl'
                          : 'bg-surface-container-low border border-surface-container-high text-on-surface hover:border-outline focus:border-primary focus:bg-surface-container-lowest focus:ring-4 focus:ring-primary/10 rounded-2xl'
                      }`}
                    />

                    {/* Subtle dot indicator when empty & focused */}
                    {!isFilled && !isError && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                        <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error Message with Shake */}
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px] text-rose-600">cancel</span>
            <span>{errorMessage || 'Invalid 6-digit code. Please verify and re-enter.'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
