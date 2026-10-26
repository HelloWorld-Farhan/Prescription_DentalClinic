import React, { useRef, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  EASE,
  DURATIONS,
  shakeVariants,
  otpBoxVariants,
  popCheckVariants
} from '../lib/motion';

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

  // Auto-focus first box on mount
  useEffect(() => {
    if (autoFocus && status === 'idle' && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, status]);

  // Handle error auto-clear and refocus after shake
  useEffect(() => {
    if (status === 'error') {
      const timer = setTimeout(() => {
        onChange(Array(6).fill(''));
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [status, onChange]);

  const handleChange = (index: number, val: string) => {
    if (disabled || status === 'success' || status === 'verifying') return;

    const cleaned = val.replace(/\D/g, '');
    const newArr = [...value];

    if (cleaned.length > 0) {
      newArr[index] = cleaned[cleaned.length - 1];
      onChange(newArr);

      // Auto-advance to next box
      if (index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all 6 digits entered
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
      <div className="relative min-h-[72px] w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            /* SUCCESS CONFIRMATION: Teal badge with drawn checkmark */
            <motion.div
              key="success-badge"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { duration: DURATIONS.fast, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="flex flex-col items-center justify-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-teal-50 border-2 border-teal-600 text-teal-700 flex items-center justify-center shadow-xs">
                <svg
                  className="w-7 h-7 text-teal-700 stroke-current stroke-[3]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    variants={popCheckVariants}
                    initial="hidden"
                    animate="visible"
                  />
                </svg>
              </div>

              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-bold text-teal-900 tracking-tight">
                  Security Passcode Verified
                </span>
                <span className="text-[11px] text-teal-700 font-medium">
                  Authentication confirmed • Proceeding...
                </span>
              </div>
            </motion.div>
          ) : (
            /* 6 OTP BOXES (With Shake on Error) */
            <motion.div
              key="otp-boxes-grid"
              variants={shakeVariants}
              animate={isError ? 'shake' : 'idle'}
              className="flex items-center justify-center gap-2 sm:gap-3 py-1"
              onPaste={handlePaste}
            >
              {Array.from({ length: 6 }).map((_, idx) => {
                const digit = value[idx] || '';
                const isFilled = digit.length > 0;

                return (
                  <motion.div
                    key={idx}
                    variants={otpBoxVariants}
                    initial="initial"
                    animate={isFilled ? 'entered' : 'initial'}
                    className="relative"
                  >
                    <input
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={1}
                      disabled={disabled || isVerifying}
                      value={digit}
                      onChange={(e) => handleChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className={`w-11 sm:w-13 h-12 sm:h-14 text-center text-lg sm:text-xl font-bold font-mono outline-none transition-colors duration-150 select-none ${
                        isError
                          ? 'bg-rose-50 border-2 border-rose-500 text-rose-800 rounded-xl'
                          : isFilled
                          ? 'bg-surface-container-lowest border-2 border-primary text-primary shadow-2xs rounded-xl'
                          : 'bg-surface-container-low border border-surface-container-high text-on-surface hover:border-outline focus:border-primary focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 rounded-xl'
                      }`}
                    />

                    {/* Subtle empty dot indicator */}
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

      {/* Error Message banner */}
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: DURATIONS.fast, ease: EASE } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px] text-rose-600">error</span>
            <span>{errorMessage || 'Invalid 6-digit code. Please verify and re-enter.'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
