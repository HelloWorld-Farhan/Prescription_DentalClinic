import { pullFromCloud } from '../services/cloudSyncService';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import OtpVerificationInput from '../components/OtpVerificationInput';
import AuthInfoPanel from '../components/AuthInfoPanel';
import { authApi } from '../services/authApi';
import { recordLoginEvent } from '../services/sessionAudit';
import { signInWithGooglePopup } from '../services/firebase';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const [clinicalId, setClinicalId] = useState(() => {
    return localStorage.getItem('smileclinic_remembered_email') || '';
  });
  const [password, setPassword] = useState('');
  const [clinicalIdTouched, setClinicalIdTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [authorizedConfirmation, setAuthorizedConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const revoked = sessionStorage.getItem('smileclinic_session_revoked_flash');
    if (revoked) {
      sessionStorage.removeItem('smileclinic_session_revoked_flash');
      return revoked;
    }
    return null;
  });
  const [successFlash, setSuccessFlash] = useState<string | null>(() => {
    const flash = sessionStorage.getItem('smileclinic_prescriber_registered_flash');
    if (flash) {
      sessionStorage.removeItem('smileclinic_prescriber_registered_flash');
      return flash;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // 2FA Login OTP state (required when Remember Device is unchecked)
  const [showLoginOtpModal, setShowLoginOtpModal] = useState(false);
  const [loginOtp, setLoginOtp] = useState<string[]>(Array(6).fill(''));
  const [loginOtpStatus, setLoginOtpStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [loginOtpError, setLoginOtpError] = useState<string | null>(null);
  const [isVerifyingLoginOtp, setIsVerifyingLoginOtp] = useState(false);
  const [loginOtpResendCountdown, setLoginOtpResendCountdown] = useState(60);
  const [isResendingLoginOtp, setIsResendingLoginOtp] = useState(false);

  // Device fingerprint token helper
  const getDeviceId = (): string => {
    let id = localStorage.getItem('rxguard_device_token');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('rxguard_device_token', id);
    }
    return id;
  };

  // Countdown timer for 2FA login OTP resend
  useEffect(() => {
    let timer: any;
    if (showLoginOtpModal && loginOtpResendCountdown > 0) {
      timer = setInterval(() => {
        setLoginOtpResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showLoginOtpModal, loginOtpResendCountdown]);

  // Dynamic clinic logo
  const savedLogo = localStorage.getItem('dental_clinic_logo');

  // Real-time validation helpers
  const getEmailError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Email address is required.';
    if (/^NPI#?\s*\d{8,12}$/i.test(trimmed)) return null; // Allow valid NPI license format
    if (!trimmed.includes('@')) return 'Email must contain an "@" symbol (e.g. name@gmail.com).';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmed)) return 'Please enter a valid domain (e.g. name@gmail.com).';
    return null;
  };

  const getPasswordError = (val: string): string | null => {
    if (!val) return 'System password is required.';
    if (val.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const emailError = (clinicalIdTouched || hasAttemptedSubmit) ? getEmailError(clinicalId) : null;
  const passwordError = (passwordTouched || hasAttemptedSubmit) ? getPasswordError(password) : null;
  const checkboxError = (hasAttemptedSubmit && !authorizedConfirmation) ? 'Please confirm clinician authorization before signing in.' : null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setClinicalIdTouched(true);
    setPasswordTouched(true);

    const emailErr = getEmailError(clinicalId);
    const passErr = getPasswordError(password);
    if (emailErr || passErr || !authorizedConfirmation) {
      return;
    }

    const inputEmail = clinicalId.trim().toLowerCase();
    const inputPass = password;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Attempt API authentication against the backend database
      const res = await authApi.login(inputEmail, inputPass, rememberDevice, getDeviceId());

      // If Remember Device is unchecked, backend requires step-up 2FA OTP verification
      if (res.status === 'otp_required') {
        setLoginOtp(Array(6).fill(''));
        setLoginOtpStatus('idle');
        setLoginOtpError(null);
        setShowLoginOtpModal(true);
        setLoginOtpResendCountdown(60);
        return;
      }

      if (res.token && res.user) {
        authApi.saveSession(res.token, res.user);
        recordLoginEvent('Success', `Authorized session established (${res.user.fullName})`, res.user.email);
        if (rememberDevice) {
          localStorage.setItem('rxguard_authenticated', 'true');
          localStorage.setItem('smileclinic_remembered_email', inputEmail);
        } else {
          localStorage.removeItem('rxguard_authenticated');
          localStorage.removeItem('smileclinic_remembered_email');
        }
        pullFromCloud().catch(() => {});
        navigate('/dashboard');
        return;
      }
    } catch (apiErr: any) {
      const errMsg = apiErr.message || 'Invalid credentials. No registered clinician account matches these credentials.';
      setErrorMessage(errMsg);

      // Record every failed / blocked credential entry in audit history
      recordLoginEvent('Blocked', `Failed authentication attempt: ${errMsg}`, inputEmail);

      // If account is locked due to 3 failed attempts, pop open Reset Password modal
      if (errMsg.toLowerCase().includes('account locked') || errMsg.toLowerCase().includes('3 failed login attempts')) {
        setTimeout(() => {
          setShowForgotPasswordModal(true);
        }, 1100);
      } else if (errMsg.toLowerCase().includes('not verified')) {
        // Unverified account: backend dispatched verification code to their email
        setTimeout(() => {
          setShowLoginOtpModal(true);
        }, 800);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const entered = directCode || loginOtp.join('');
    if (entered.length < 6 || !/^\d{6}$/.test(entered)) {
      setLoginOtpError('Please enter all 6 numeric digits of your sign-in verification code.');
      setLoginOtpStatus('error');
      setTimeout(() => setLoginOtpStatus('idle'), 1500);
      return;
    }

    setIsVerifyingLoginOtp(true);
    setLoginOtpStatus('verifying');
    setLoginOtpError(null);

    try {
      const res = await authApi.verifyLoginOtp(
        clinicalId.trim().toLowerCase(),
        entered,
        rememberDevice,
        getDeviceId()
      );
      if (res.token && res.user) {
        setLoginOtpStatus('success');
        authApi.saveSession(res.token, res.user);
        recordLoginEvent('2FA Verified', `Two-Factor sign-in OTP challenge verified (${res.user.fullName})`, res.user.email);
        if (rememberDevice) {
          localStorage.setItem('rxguard_authenticated', 'true');
          localStorage.setItem('smileclinic_remembered_email', clinicalId.trim().toLowerCase());
        } else {
          localStorage.removeItem('rxguard_authenticated');
          localStorage.removeItem('smileclinic_remembered_email');
        }
        setTimeout(() => {
          setShowLoginOtpModal(false);
          pullFromCloud().catch(() => {});
        navigate('/dashboard');
        }, 1200);
      }
    } catch (err: any) {
      setLoginOtpError(err.message || 'Invalid or expired sign-in code.');
      setLoginOtpStatus('error');
      setTimeout(() => setLoginOtpStatus('idle'), 1500);
    } finally {
      setIsVerifyingLoginOtp(false);
    }
  };

  const handleResendLoginOtp = async () => {
    if (loginOtpResendCountdown > 0 || isResendingLoginOtp) return;
    setIsResendingLoginOtp(true);
    try {
      setLoginOtp(Array(6).fill(''));
      setLoginOtpError(null);
      await authApi.resendOtp(clinicalId.trim().toLowerCase());
      setLoginOtpResendCountdown(60);
    } catch (err: any) {
      setLoginOtpError(err.message || 'Failed to resend sign-in code.');
    } finally {
      setIsResendingLoginOtp(false);
    }
  };

  const handlePasswordResetSuccess = (email: string) => {
    setClinicalId(email);
    setSuccessFlash(`Password updated successfully for ${email}. Please sign in with your new password.`);
    setErrorMessage(null);
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleAuth = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMessage(null);
      const hint = clinicalId.includes('@') ? clinicalId.trim() : undefined;
      const googleUser = await signInWithGooglePopup(hint);
      if (!googleUser) {
        // User closed or dismissed the popup
        return;
      }

      const res = await authApi.googleAuth(
        googleUser.email,
        googleUser.fullName,
        googleUser.idToken,
        googleUser.photoUrl,
        getDeviceId()
      );

      if (res.status === 'otp_required') {
        setClinicalId(googleUser.email);
        setLoginOtp(Array(6).fill(''));
        setLoginOtpStatus('idle');
        setLoginOtpError(null);
        setShowLoginOtpModal(true);
        setLoginOtpResendCountdown(60);
        return;
      }

      if (res.token && res.user) {
        if (!res.user.authProvider) res.user.authProvider = 'google';
        res.user.isGoogleLinked = true;
        authApi.saveSession(res.token, res.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`google_linked_${googleUser.email.toLowerCase()}`, 'true');
        }
        recordLoginEvent('Success', `Authenticated via 1-Click Google OAuth (${googleUser.email})`, googleUser.email);
        pullFromCloud().catch(() => {});
        navigate('/dashboard');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="bg-background font-sans text-on-surface antialiased min-h-screen flex flex-col justify-between selection:bg-primary-container selection:text-on-primary relative overflow-hidden"
    >
      {/* Global Clinical Header */}
      <header className="h-14 sm:h-16 w-full bg-surface-container-lowest border-b border-outline-variant/30 px-3 sm:px-6 lg:px-8 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold shadow-xs overflow-hidden shrink-0">
            {savedLogo ? (
              <img src={savedLogo} alt="Smile Clinic Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">dentistry</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 flex-nowrap">
              <span className="font-bold text-base sm:text-lg text-primary leading-none whitespace-nowrap">Smile Clinic</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] bg-primary/10 text-primary font-bold uppercase tracking-wider whitespace-nowrap">
                Prescription Portal
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-on-surface-variant font-medium truncate hidden sm:block">Prescription Safety &amp; Decision Support</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 text-on-surface-variant text-xs font-medium bg-surface-container-low px-3 py-1.5 rounded-full border border-surface-container-high">
            <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
            <span>HIPAA Compliant 256-Bit SSL</span>
          </div>
          <Link
            to="/support"
            className="flex items-center gap-1 sm:gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">help_outline</span>
            <span>Support</span>
          </Link>
        </div>
      </header>

      {/* Main 2-Column Split Viewport: Left = Login Form, Right = Prescription Video */}
      <main className="flex-1 flex items-center justify-center py-4 sm:py-10 px-2.5 sm:px-4 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          {/* High-Modern Floating Ambient Teal & Cyan Orbs */}
          <div className="relative">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.4, 0.2],
                x: [0, 20, 0],
                y: [0, -20, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-24 left-1/4 -translate-x-1/2 w-[340px] sm:w-[550px] h-[260px] sm:h-[380px] bg-primary/15 rounded-full blur-2xl sm:blur-3xl pointer-events-none -z-10 gpu-layer"
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">
              {/* LEFT COLUMN: Clean Clinician Login Form (7 cols on lg) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-7 flex flex-col justify-between"
              >
                <div className="bg-surface-container-lowest rounded-2xl sm:rounded-3xl shadow-xl shadow-primary/5 border border-surface-container-high p-3.5 sm:p-9 flex flex-col gap-4 sm:gap-6">
                  {/* Top Badge Strip */}
                  <div className="flex items-center justify-between text-on-surface-variant text-[11px] sm:text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                      <span className="font-semibold text-primary truncate">Secure Clinical Workspace</span>
                    </div>
                    <div className="flex items-center gap-1 text-on-surface-variant/90 font-medium shrink-0">
                      <span className="material-symbols-outlined text-[14px] text-primary">lock</span>
                      <span className="whitespace-nowrap">256-Bit SSL Encrypted</span>
                    </div>
                  </div>

                  {/* Header Title */}
                  <div className="flex items-start gap-3 sm:gap-3.5">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary shadow-xs">
                      <span className="material-symbols-outlined text-[20px] sm:text-[24px]">lock</span>
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight leading-tight">
                        Sign In &amp; Prescriber Access
                      </h1>
                      <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 leading-snug">
                        Enter authorized clinical credentials to access the real-time interaction &amp; safety engine.
                      </p>
                    </div>
                  </div>

                  {/* Success Flash Notification */}
                  {successFlash && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0 mt-0.5 text-emerald-600">check_circle</span>
                      <span>{successFlash}</span>
                    </div>
                  )}

                  {/* Error / Lockout Alert */}
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3.5 rounded-xl border text-xs font-medium flex items-start gap-2.5 shadow-xs ${
                        errorMessage.toLowerCase().includes('account locked')
                          ? 'bg-rose-100/90 border-rose-300 text-rose-950 font-semibold'
                          : errorMessage.toLowerCase().includes('rate limit')
                          ? 'bg-purple-50 border-purple-200 text-purple-900'
                          : errorMessage.toLowerCase().includes('attempt')
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                        {errorMessage.toLowerCase().includes('account locked')
                          ? 'lock_person'
                          : errorMessage.toLowerCase().includes('rate limit')
                          ? 'timer'
                          : errorMessage.toLowerCase().includes('attempt')
                          ? 'warning'
                          : 'error'}
                      </span>
                      <div className="flex-1">
                        <p className="leading-relaxed">{errorMessage}</p>
                        {errorMessage.toLowerCase().includes('account locked') && (
                          <p className="mt-1 text-[11px] text-rose-800 font-normal">
                            A one-time reset code has been sent to your email. Opening reset window...
                          </p>
                        )}
                        {errorMessage.toLowerCase().includes('not verified') && (
                          <p className="mt-1 text-[11px] text-teal-800 font-semibold">
                            Opening email verification window... Please enter the 6-digit code sent to your email.
                          </p>
                        )}
                        {(errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('no registered')) && (
                          <div className="mt-2 pt-2 border-t border-rose-200/60 flex items-center gap-3 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setShowForgotPasswordModal(true)}
                              className="font-bold underline text-rose-900 hover:text-rose-950 cursor-pointer"
                            >
                              Reset Password?
                            </button>
                            <span className="text-rose-400">•</span>
                            <Link
                              to="/signup"
                              className="font-bold underline text-rose-900 hover:text-rose-950"
                            >
                              Enroll Clinician Account →
                            </Link>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Credentials Form */}
                  <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                    {/* Clinical ID / Email */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-on-surface" htmlFor="clinical-id">
                        Email Address *
                      </label>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none select-none">
                          mail
                        </span>
                        <input
                          id="clinical-id"
                          type="email"
                          autoComplete="off"
                          value={clinicalId}
                          onBlur={() => setClinicalIdTouched(true)}
                          onChange={(e) => {
                            setClinicalId(e.target.value);
                            setErrorMessage(null);
                          }}
                          placeholder="name@gmail.com"
                          className={`w-full h-11 pl-10 pr-3 rounded-xl text-on-surface text-sm placeholder:text-outline focus:outline-none transition-all ${
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
                    </div>

                    {/* Password Field */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-on-surface" htmlFor="clinical-password">
                          System Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowForgotPasswordModal(true)}
                          className="text-xs text-primary font-bold hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none select-none">
                          lock
                        </span>
                        <input
                          id="clinical-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onBlur={() => setPasswordTouched(true)}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setErrorMessage(null);
                          }}
                          placeholder="••••••••••••"
                          className={`w-full h-11 pl-10 pr-10 rounded-xl text-on-surface text-sm placeholder:text-outline focus:outline-none transition-all ${
                            passwordError
                              ? 'bg-rose-50/20 border border-rose-400 focus:border-rose-500 focus:bg-white'
                              : 'bg-surface-container-low border border-surface-container-high focus:bg-surface-container-lowest focus:border-primary'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password visibility"
                          className="absolute right-3 text-outline hover:text-on-surface p-1 rounded cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
                          <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                          <span>{passwordError}</span>
                        </p>
                      )}
                    </div>

                    {/* Remember Device */}
                    <div className="flex items-center justify-between pt-0.5">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                        <div className="relative shrink-0">
                          <input
                            type="checkbox"
                            checked={rememberDevice}
                            onChange={(e) => setRememberDevice(e.target.checked)}
                            className="sr-only"
                          />
                          <motion.div
                            animate={rememberDevice ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                              rememberDevice
                                ? 'bg-primary border-primary text-white shadow-xs'
                                : 'bg-white border-outline/50 group-hover:border-primary/60'
                            }`}
                          >
                            {rememberDevice && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="material-symbols-outlined text-white text-[13px] font-bold"
                              >
                                check
                              </motion.span>
                            )}
                          </motion.div>
                        </div>
                        <span className="text-xs text-on-surface-variant group-hover:text-on-surface font-medium transition-colors">
                          Remember me on this workstation
                        </span>
                      </label>
                    </div>

                    {/* Clinician Authorization Confirmation Card */}
                    <div
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        checkboxError
                          ? 'bg-rose-50/60 border-rose-400 shadow-xs'
                          : authorizedConfirmation
                          ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                          : 'bg-surface-container-low border-surface-container-high/80 hover:border-primary/40 hover:bg-surface-container-lowest'
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer group select-none">
                        <div className="relative shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            checked={authorizedConfirmation}
                            onChange={(e) => {
                              setAuthorizedConfirmation(e.target.checked);
                              setErrorMessage(null);
                            }}
                            className="sr-only"
                          />
                          <motion.div
                            animate={authorizedConfirmation ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                            transition={{ duration: 0.22 }}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              authorizedConfirmation
                                ? 'bg-emerald-600 border-emerald-600 shadow-xs'
                                : checkboxError
                                ? 'bg-white border-rose-400'
                                : 'bg-white border-outline/50 group-hover:border-primary/60'
                            }`}
                          >
                            {authorizedConfirmation && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="material-symbols-outlined text-white text-[14px] font-bold"
                              >
                                check
                              </motion.span>
                            )}
                          </motion.div>
                        </div>
                        <div className="flex-1">
                          <span className={`text-xs leading-relaxed font-medium transition-colors block ${
                            checkboxError
                              ? 'text-rose-900 font-semibold'
                              : authorizedConfirmation
                              ? 'text-emerald-950 font-semibold'
                              : 'text-on-surface-variant group-hover:text-on-surface'
                          }`}>
                            I confirm that I am an authorized clinician accessing Smile Clinic patient records.
                          </span>
                        </div>
                      </label>
                      {checkboxError && (
                        <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 mt-2.5 pt-2 border-t border-rose-200 animate-fadeIn">
                          <span className="material-symbols-outlined text-[15px] shrink-0">error</span>
                          <span>{checkboxError}</span>
                        </p>
                      )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex flex-col gap-2 pt-1">
                      <motion.button
                        type="submit"
                        whileHover={!isLoading ? { scale: 1.015, y: -1 } : {}}
                        whileTap={!isLoading ? { scale: 0.985 } : {}}
                        disabled={isLoading}
                        className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 select-none ${
                          !isLoading
                            ? 'bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg cursor-pointer'
                            : 'bg-outline/20 text-on-surface/40 cursor-not-allowed'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-lg ${isLoading ? 'animate-spin' : ''}`}>
                          {isLoading ? 'sync' : 'login'}
                        </span>
                        <span>
                          {isLoading
                            ? 'Authenticating...'
                            : 'Sign In to Smile Clinic Portal'}
                        </span>
                      </motion.button>

                      {/* Divider */}
                      <div className="relative my-1 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-surface-container-high"></div>
                        </div>
                        <div className="relative bg-surface-container-lowest px-3 text-[11px] font-medium text-outline uppercase tracking-wider">
                          Or continue with
                        </div>
                      </div>

                      {/* Google Sign In Button */}
                      <motion.button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={isGoogleLoading || isLoading}
                        whileHover={{ scale: isGoogleLoading ? 1 : 1.015, y: isGoogleLoading ? 0 : -1 }}
                        whileTap={{ scale: isGoogleLoading ? 1 : 0.985 }}
                        className={`w-full h-11 rounded-xl font-semibold text-xs sm:text-sm border shadow-xs transition-all duration-200 flex items-center justify-center gap-2.5 select-none ${
                          isGoogleLoading
                            ? 'bg-surface-container-low text-on-surface-variant border-surface-container-high cursor-wait'
                            : 'bg-white hover:bg-surface-container-low text-on-surface border-surface-container-high hover:border-outline/40 hover:shadow-sm cursor-pointer'
                        }`}
                      >
                        {isGoogleLoading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                            <span>Connecting with Google...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            <span>Sign in with Google</span>
                          </>
                        )}
                      </motion.button>

                      {/* Link to Signup */}
                      <div className="pt-2 text-center text-xs">
                        <span className="text-outline">Need authorized prescriber credentials? </span>
                        <Link to="/signup" className="text-primary font-bold hover:underline">
                          Enroll as Prescriber / Pharmacist &rarr;
                        </Link>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Clean Bottom Security Strip */}
                <div className="mt-4 p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high/60 flex items-center justify-between text-xs text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-primary">verified_user</span>
                    <span className="text-[11px] font-medium">Smile Clinic Verified &amp; Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-outline font-medium">
                    <span className="material-symbols-outlined text-sm text-primary">lock</span>
                    <span>Protected Patient Privacy</span>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT COLUMN: Animated Info Panel */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="lg:col-span-5 flex flex-col h-full"
              >
                <AuthInfoPanel variant="login" />
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Standard Legal Footer */}
      <footer className="w-full bg-surface-container-low py-4 border-t border-surface-container-high shadow-xs z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant text-xs text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">shield_with_heart</span>
            <span>© 2026 Smile Clinic Health System. All health records encrypted.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6 text-[11px] font-medium">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/patient-rights" className="hover:text-primary transition-colors">Patient Rights</Link>
            <Link to="/support" className="hover:text-primary transition-colors">Support Desk</Link>
          </div>
        </div>
      </footer>

      {/* 2FA Login OTP Verification Modal (Triggered when "Remember this device" is unchecked) */}
      <AnimatePresence>
        {showLoginOtpModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setShowLoginOtpModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-6 sm:p-8 z-10 space-y-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">security</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Two-Factor Authentication</h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">6-digit verification code required to authorize clinical sign-in</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLoginOtpModal(false)}
                  className="text-outline hover:text-on-surface p-1 cursor-pointer rounded-lg hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Destination info */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <span className="material-symbols-outlined text-primary text-[20px]">mail</span>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">Passcode sent to</p>
                  <p className="text-sm font-bold text-on-surface font-mono">{clinicalId}</p>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {loginOtpError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2"
                  >
                    <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                    <span>{loginOtpError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* OTP Form */}
              <form onSubmit={handleVerifyLoginOtp} className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-3 text-center">
                    Enter the 6-Digit Verification Code
                  </label>
                  <OtpVerificationInput
                    value={loginOtp}
                    onChange={(newVal) => {
                      setLoginOtp(newVal);
                      setLoginOtpError(null);
                    }}
                    onComplete={(code) => handleVerifyLoginOtp(undefined, code)}
                    status={loginOtpStatus}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
                  <span>Didn't receive the passcode?</span>
                  {loginOtpResendCountdown > 0 ? (
                    <span className="text-outline font-mono font-medium">Resend in {loginOtpResendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      disabled={isResendingLoginOtp}
                      onClick={handleResendLoginOtp}
                      className="text-primary font-bold hover:underline cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {isResendingLoginOtp && (
                        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                      )}
                      <span>{isResendingLoginOtp ? 'Sending OTP...' : 'Resend Code'}</span>
                    </button>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLoginOtpModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-outline/30 text-on-surface font-semibold text-sm hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingLoginOtp || loginOtp.some(d => !d)}
                    className="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-semibold text-sm shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isVerifyingLoginOtp ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Sign In</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forgot Password Modal Dialog */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onSuccess={handlePasswordResetSuccess}
        initialEmail={clinicalId}
        initialStep={errorMessage?.toLowerCase().includes('account locked') ? 2 : 1}
      />
    </motion.div>
  );
}
