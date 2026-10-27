import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OtpVerificationInput from './OtpVerificationInput';
import PasswordStrengthMeter from './PasswordStrengthMeter';
import { authApi } from '../services/authApi';
import { recordLoginEvent } from '../services/sessionAudit';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
  initialEmail?: string;
  initialStep?: 1 | 2 | 3;
}

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  initialEmail = '',
  initialStep = 1
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [method, setMethod] = useState<'email' | 'sms' | 'previous'>('email');
  const [accountEmail, setAccountEmail] = useState(initialEmail || '');
  const [emailTouched, setEmailTouched] = useState(false);
  const [hasAttemptedStep1, setHasAttemptedStep1] = useState(false);
  const [mobilePhone, setMobilePhone] = useState('');
  
  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [otpStatus, setOtpStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [otpError, setOtpError] = useState('');
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Previous password verification state
  const [previousPasswordInput, setPreviousPasswordInput] = useState('');
  const [prevPassError, setPrevPassError] = useState('');
  const [showPrevPassword, setShowPrevPassword] = useState(false);

  // New password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync initial email
  useEffect(() => {
    if (initialEmail) {
      setAccountEmail(initialEmail);
    }
  }, [initialEmail]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep || 1);
      setMethod('email');
      setAccountEmail(initialEmail || '');
      setEmailTouched(false);
      setHasAttemptedStep1(false);
      setOtp(Array(6).fill(''));
      setOtpError('');
      setResendTimer(60);
      setCanResend(false);
      setResendCount(0);
      setPreviousPasswordInput('');
      setPrevPassError('');
      setNewPassword('');
      setConfirmPassword('');
      setResetError('');
      setIsSuccess(false);
    }
  }, [isOpen, initialEmail, initialStep]);

  // Resend countdown timer for Step 2
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && step === 2 && (method === 'email' || method === 'sms') && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpen, step, method, resendTimer]);

  const getEmailValidationError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Email address is required.';
    if (!trimmed.includes('@')) return 'Email must contain an "@" symbol (e.g. name@gmail.com).';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmed)) return 'Please enter a valid domain (e.g. name@gmail.com).';
    return null;
  };

  const emailError = (emailTouched || hasAttemptedStep1) ? getEmailValidationError(accountEmail) : null;

  // Step 1 -> Step 2
  const handleProceedToVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedStep1(true);
    setEmailTouched(true);

    const err = getEmailValidationError(accountEmail);
    if (err) {
      return;
    }

    setIsSubmitting(true);
    setResetError('');

    try {
      if (method === 'email') {
        await authApi.forgotPassword(accountEmail.trim().toLowerCase());
        setOtp(Array(6).fill(''));
        setResendTimer(60);
        setCanResend(false);
        setStep(2);
      } else {
        setStep(2);
      }
    } catch (apiErr: any) {
      setResetError(apiErr.message || 'Unable to request password reset code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend code trigger (1 time per 60 sec countdown)
  const handleResendOtp = async () => {
    if (!canResend || isResending) return;
    setIsResending(true);
    try {
      await authApi.forgotPassword(accountEmail.trim().toLowerCase());
      setOtp(Array(6).fill(''));
      setResendTimer(60);
      setCanResend(false);
      setResendCount((c) => c + 1);
      setOtpError('');
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  // Step 2 -> Step 3
  const handleConfirmVerification = async (e?: React.FormEvent, directOtp?: string) => {
    if (e) e.preventDefault();

    if (method === 'previous') {
      if (!previousPasswordInput.trim()) {
        setPrevPassError('Please enter your previous password.');
        return;
      }
      setIsSubmitting(true);
      setPrevPassError('');
      try {
        await authApi.verifyCurrentPassword(accountEmail.trim().toLowerCase(), previousPasswordInput);
        setStep(3);
      } catch (err: any) {
        setPrevPassError(err.message || 'Incorrect previous password. Please verify your credentials.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const entered = directOtp || otp.join('');
    if (entered.length < 6 || !/^\d{6}$/.test(entered)) {
      setOtpError('Please enter all 6 numeric digits of the security verification code.');
      setOtpStatus('error');
      setTimeout(() => setOtpStatus('idle'), 1500);
      return;
    }

    setIsSubmitting(true);
    setOtpStatus('verifying');
    setOtpError('');

    try {
      await authApi.verifyResetOtp(accountEmail.trim().toLowerCase(), entered);
      setOtpStatus('success');
      setTimeout(() => {
        setIsSubmitting(false);
        setStep(3);
        setOtpStatus('idle');
      }, 1200);
    } catch (err: any) {
      setOtpStatus('error');
      setOtpError(err.message || 'Invalid 6-digit verification code. Please check your email.');
      setIsSubmitting(false);
      setTimeout(() => setOtpStatus('idle'), 1500);
    }
  };

  // Step 3 Password Criteria
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const numberCount = (newPassword.match(/\d/g) || []).length;
  const hasMin2Numbers = numberCount >= 2;
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasMin2Numbers && hasSymbol && passwordsMatch;

  // Final Step: Save New Password
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setResetError('Please satisfy all password safety criteria before updating.');
      return;
    }

    setIsSubmitting(true);
    setResetError('');

    try {
      if (method === 'previous' && previousPasswordInput) {
        await authApi.changePasswordWithCurrent(
          accountEmail.trim().toLowerCase(),
          previousPasswordInput,
          newPassword
        );
      } else {
        await authApi.resetPassword(
          accountEmail.trim().toLowerCase(),
          otp.join(''),
          newPassword
        );
      }

      recordLoginEvent(
        'Success',
        `Credential security: Prescriber password reset authorized (${accountEmail.trim().toLowerCase()})`,
        accountEmail.trim().toLowerCase()
      );

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(accountEmail);
        onClose();
      }, 1400);
    } catch (err: any) {
      setResetError(err.message || 'Password reset failed. Please ensure the code is correct.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 18, filter: 'blur(5px)' }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(3px)' }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden z-10 flex flex-col"
        >
          {/* Top Clinical Header Strip */}
          <div className="bg-gradient-to-r from-primary/10 via-surface-container-low to-transparent p-5 sm:p-6 border-b border-surface-container-high/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                <span className="material-symbols-outlined text-[22px]">lock_reset</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-on-surface leading-tight">
                    Prescriber Password Recovery
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-bold uppercase tracking-wider">
                    EPCS 2FA
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Step {step} of 3 • Institutional Identity Verification
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-surface-container text-outline hover:text-on-surface transition-colors flex items-center justify-center cursor-pointer"
              title="Close modal"
              aria-label="Close modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="w-full bg-surface-container-low h-1 flex">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          {/* Modal Content Body */}
          <div className="p-5 sm:p-7 flex flex-col gap-5">
            {/* STEP 1: Account & Verification Method Choice */}
            {step === 1 && (
              <form onSubmit={handleProceedToVerify} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-on-surface">Email Address *</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">
                      mail
                    </span>
                    <input
                      type="email"
                      autoComplete="off"
                      value={accountEmail}
                      onBlur={() => setEmailTouched(true)}
                      onChange={(e) => {
                        setAccountEmail(e.target.value);
                        setResetError('');
                      }}
                      placeholder="name@gmail.com"
                      className={`w-full h-11 pl-10 pr-3 rounded-xl text-on-surface text-xs sm:text-sm font-medium placeholder:text-outline focus:outline-none transition-all ${
                        emailError
                          ? 'bg-rose-50/20 border border-rose-400 focus:border-rose-500 focus:bg-white'
                          : 'bg-surface-container-low border border-surface-container-high focus:bg-surface-container-lowest focus:border-primary'
                      }`}
                    />
                  </div>
                  {emailError && (
                    <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                      <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                      <span>{emailError}</span>
                    </p>
                  )}
                  <span className="text-[10px] text-outline">
                    We will verify your clinical profile against the institutional prescriber registry.
                  </span>
                </div>

                {/* Choose Verification Method */}
                <div className="flex flex-col gap-2 pt-1">
                  <label className="text-xs font-bold text-on-surface">Choose Verification Method</label>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {/* Method 1: Email OTP */}
                    <label
                      onClick={() => setMethod('email')}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        method === 'email'
                          ? 'border-primary bg-primary/5 shadow-xs'
                          : 'border-surface-container-high bg-surface-container-lowest hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="radio"
                        name="recoveryMethod"
                        checked={method === 'email'}
                        onChange={() => setMethod('email')}
                        className="mt-0.5 text-primary accent-primary cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                          <span className="material-symbols-outlined text-[16px] text-primary">mark_email_read</span>
                          <span>Email Verification Code (6-Digit OTP)</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Sends a secure 6-digit one-time code to {accountEmail || 'your authorized email'}.
                        </p>
                      </div>
                    </label>

                    {/* Method 2: SMS Mobile OTP (Blocked / Coming Soon) */}
                    <div
                      className="flex items-start gap-3 p-3 rounded-xl border border-surface-container-high/60 bg-surface-container-low/40 opacity-60 cursor-not-allowed select-none"
                    >
                      <input
                        type="radio"
                        name="recoveryMethod"
                        disabled
                        checked={false}
                        className="mt-0.5 text-outline accent-outline cursor-not-allowed"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface-variant">
                            <span className="material-symbols-outlined text-[16px] text-outline">sms</span>
                            <span>SMS Mobile OTP (Clinician Phone)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 uppercase tracking-wider shrink-0">
                            Coming Soon
                          </span>
                        </div>
                        <p className="text-[11px] text-outline mt-0.5">
                          SMS gateway integration in progress. Please use Email Verification.
                        </p>
                      </div>
                    </div>

                    {/* Method 3: Previous Password Verification */}
                    <label
                      onClick={() => setMethod('previous')}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        method === 'previous'
                          ? 'border-primary bg-primary/5 shadow-xs'
                          : 'border-surface-container-high bg-surface-container-lowest hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="radio"
                        name="recoveryMethod"
                        checked={method === 'previous'}
                        onChange={() => setMethod('previous')}
                        className="mt-0.5 text-primary accent-primary cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-xs text-on-surface">
                          <span className="material-symbols-outlined text-[16px] text-primary">history</span>
                          <span>Verify with Previous Master Password</span>
                        </div>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          Authenticate directly using your last known clinical password without receiving OTP.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {resetError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>{method === 'email' ? 'Sending OTP Code...' : 'Verifying Identity...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{method === 'email' ? 'Send OTP Code' : 'Proceed to Verification'}</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Verification Challenge (OTP or Previous Password) */}
            {step === 2 && (
              <form onSubmit={handleConfirmVerification} className="flex flex-col gap-4">
                {method === 'email' || method === 'sms' ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-on-surface">
                          Enter 6-Digit Verification Code
                        </label>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        {method === 'email'
                          ? `Code dispatched to email: ${accountEmail}`
                          : `Code dispatched to mobile SMS: ${mobilePhone}`}
                      </p>
                    </div>

                    {/* 6-box OTP entry with Morphing Animation */}
                    <div className="py-2">
                      <OtpVerificationInput
                        value={otp}
                        onChange={(newOtp) => {
                          setOtp(newOtp);
                          if (otpError) setOtpError('');
                          if (otpStatus === 'error') setOtpStatus('idle');
                        }}
                        onComplete={(code) => handleConfirmVerification(undefined, code)}
                        status={otpStatus}
                        errorMessage={otpError}
                        disabled={isSubmitting || otpStatus === 'success'}
                      />
                    </div>

                    {/* 60s Resend Countdown */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-surface-container-high/60 text-xs">
                      <div className="flex items-center gap-1.5 text-on-surface-variant text-[11px]">
                        <span className="material-symbols-outlined text-[16px] text-primary">timer</span>
                        {resendTimer > 0 ? (
                          <span>
                            Resend code available in{' '}
                            <strong className="text-primary font-mono font-bold">
                              {String(Math.floor(resendTimer / 60)).padStart(2, '0')}:
                              {String(resendTimer % 60).padStart(2, '0')}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold">
                            You can now request a new code.
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!canResend || isResending}
                        onClick={handleResendOtp}
                        className={`font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer ${
                          canResend && !isResending
                            ? 'text-primary hover:underline'
                            : 'text-outline cursor-not-allowed opacity-60'
                        }`}
                      >
                        {isResending ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                            <span>Sending OTP...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[14px]">refresh</span>
                            <span>Resend Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  // Previous Password Form
                  <div className="flex flex-col gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-on-surface">Enter Previous Master Password</h4>
                      <p className="text-[11px] text-on-surface-variant">
                        Enter your existing or previous password to prove clinical authorization.
                      </p>
                    </div>

                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">
                        key
                      </span>
                      <input
                        type={showPrevPassword ? 'text' : 'password'}
                        required
                        value={previousPasswordInput}
                        onChange={(e) => {
                          setPreviousPasswordInput(e.target.value);
                          setPrevPassError('');
                        }}
                        placeholder="Enter previous password"
                        className={`w-full h-10 pl-10 pr-10 rounded-xl ${
                          prevPassError
                            ? 'border-2 border-rose-500 bg-rose-50/25'
                            : 'bg-surface-container-low border border-surface-container-high'
                        } text-on-surface text-xs sm:text-sm font-medium focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPrevPassword(!showPrevPassword)}
                        className="absolute right-3 text-outline hover:text-on-surface p-1"
                      >
                        <span className="material-symbols-outlined text-lg">
                          {showPrevPassword ? 'visibility' : 'visibility_off'}
                        </span>
                      </button>
                    </div>

                    {prevPassError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-shake">
                        <span className="material-symbols-outlined text-rose-600 text-sm">error</span>
                        <span>{prevPassError}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-3 py-2 text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Change Method</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Confirm &amp; Proceed</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Change Password with Criteria Validation */}
            {step === 3 && (
              <form onSubmit={handleSaveNewPassword} className="flex flex-col gap-4">
                {/* OTP Confirmation Header Badge */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified</span>
                  <span>
                    Identity Confirmed &mdash;{' '}
                    {method === 'email' ? '6-Digit OTP Verified Successfully' : 'Previous Password Authenticated'}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-on-surface">Establish New Prescriber Password</h4>
                  <p className="text-[11px] text-on-surface-variant">
                    Your new credentials must satisfy strict DEA EPCS and HIPAA compliance standards.
                  </p>
                </div>

                {/* New Password Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">New System Password *</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">
                      lock
                    </span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setResetError('');
                      }}
                      placeholder="••••••••••••"
                      className="w-full h-10 pl-10 pr-10 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs sm:text-sm font-medium focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 text-outline hover:text-on-surface p-1"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showNewPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface">Confirm New Password *</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none">
                      check_circle
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setResetError('');
                      }}
                      placeholder="••••••••••••"
                      className="w-full h-10 pl-10 pr-10 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-xs sm:text-sm font-medium focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 text-outline hover:text-on-surface p-1"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showConfirmPassword ? 'visibility' : 'visibility_off'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Animated password strength + criteria */}
                <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high/60">
                  <PasswordStrengthMeter password={newPassword} confirmPassword={confirmPassword} />
                </div>

                {resetError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{resetError}</span>
                  </div>
                )}

                {isSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-700 text-lg">verified</span>
                    <span>Password successfully updated! Returning to login...</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isPasswordValid || isSubmitting || isSuccess}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>Update Prescriber Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
