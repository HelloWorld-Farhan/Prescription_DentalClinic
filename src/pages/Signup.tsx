import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import OtpVerificationInput from '../components/OtpVerificationInput';
import AuthInfoPanel from '../components/AuthInfoPanel';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { authApi } from '../services/authApi';
import { recordLoginEvent } from '../services/sessionAudit';
import { signInWithGooglePopup } from '../services/firebase';

export interface RegisteredPrescriber {
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  password: string;
  registeredAt: string;
}

// Country dial codes for the picker with expected phone length
const COUNTRIES = [
  { code: 'IN', dial: '+91',  flag: '🇮🇳', name: 'India',          min: 10, max: 10 },
  { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'United States',  min: 10, max: 10 },
  { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom', min: 10, max: 11 },
  { code: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Australia',      min: 9,  max: 10 },
  { code: 'CA', dial: '+1',   flag: '🇨🇦', name: 'Canada',         min: 10, max: 10 },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE',            min: 9,  max: 9  },
  { code: 'SG', dial: '+65',  flag: '🇸🇬', name: 'Singapore',      min: 8,  max: 8  },
  { code: 'PK', dial: '+92',  flag: '🇵🇰', name: 'Pakistan',       min: 10, max: 10 },
  { code: 'BD', dial: '+880', flag: '🇧🇩', name: 'Bangladesh',     min: 10, max: 10 },
  { code: 'LK', dial: '+94',  flag: '🇱🇰', name: 'Sri Lanka',      min: 9,  max: 9  },
  { code: 'MY', dial: '+60',  flag: '🇲🇾', name: 'Malaysia',       min: 9,  max: 10 },
  { code: 'NP', dial: '+977', flag: '🇳🇵', name: 'Nepal',          min: 10, max: 10 },
  { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Germany',        min: 10, max: 11 },
  { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France',         min: 9,  max: 9  },
  { code: 'NZ', dial: '+64',  flag: '🇳🇿', name: 'New Zealand',    min: 9,  max: 10 },
];

export default function Signup() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // India default
  const [phone, setPhone] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Field Touched Tracking
  const [fullNameTouched, setFullNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Email OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState<string[]>(Array(6).fill(''));
  const [otpStatus, setOtpStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);

  // Dynamic clinic logo
  const savedLogo = localStorage.getItem('dental_clinic_logo');

  // Resend Countdown Timer
  useEffect(() => {
    let timer: any;
    if (showOtpModal && resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown((p) => p - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, resendCountdown]);

  // Password criteria
  const isMin8Chars = password.length >= 8;
  const hasCapital = /[A-Z]/.test(password);
  const hasMin2Numbers = (password.match(/\d/g) || []).length >= 2;
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = isMin8Chars && hasCapital && hasMin2Numbers && hasSpecial;

  // Smart Auto Country Code Detection on typing/pasting
  const handlePhoneChange = (rawInput: string) => {
    let cleanInput = rawInput;
    const trimmed = rawInput.trim();

    // Check international dial prefix match (+91, +1, +44, etc.)
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

    if (trimmed.startsWith('+')) {
      for (const country of sortedCountries) {
        if (trimmed.startsWith(country.dial)) {
          setSelectedCountry(country);
          cleanInput = trimmed.slice(country.dial.length).trim();
          break;
        }
      }
    } else {
      const allDigits = trimmed.replace(/\D/g, '');
      // If user pasted something like 919876543210 or 14155552671
      if (allDigits.length >= 11) {
        for (const country of sortedCountries) {
          const dialDigits = country.dial.replace('+', '');
          if (allDigits.startsWith(dialDigits) && allDigits.length === dialDigits.length + country.min) {
            setSelectedCountry(country);
            cleanInput = allDigits.slice(dialDigits.length);
            break;
          }
        }
      }
    }

    setPhone(cleanInput.replace(/[^\d\s\-()]/g, ''));
    setSignupError(null);
  };

  // Real-time validation error functions
  const getNameError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Full legal name & title is required.';
    if (trimmed.length < 2) return 'Full name must be at least 2 characters.';
    return null;
  };

  const getEmailError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'Email address is required.';
    if (!trimmed.includes('@')) return 'Email must contain an "@" symbol (e.g. name@gmail.com).';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(trimmed)) return 'Please enter a valid domain (e.g. name@gmail.com).';
    return null;
  };

  const getPhoneError = (val: string, country: typeof selectedCountry): string | null => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return 'Mobile phone number is required.';
    if (digits.length < country.min) {
      return `Phone number for ${country.name} must be ${country.min === country.max ? country.min : `${country.min}-${country.max}`} digits (currently ${digits.length}).`;
    }
    if (digits.length > country.max) {
      return `Phone number cannot exceed ${country.max} digits for ${country.name}.`;
    }
    return null;
  };

  const getPasswordError = (val: string): string | null => {
    if (!val) return 'System password is required.';
    if (!isPasswordValid) return 'Password must fulfill all 4 security criteria below.';
    return null;
  };

  const getConfirmPasswordError = (confirmVal: string, pwd: string): string | null => {
    if (!confirmVal) return 'Please confirm your system password.';
    if (confirmVal !== pwd) return 'Passwords do not match. Please verify.';
    return null;
  };

  const getTermsError = (agreed: boolean): string | null => {
    if (!agreed) return 'Please confirm clinical credentials and accept terms.';
    return null;
  };

  const nameError = (fullNameTouched || hasAttemptedSubmit) ? getNameError(fullName) : null;
  const emailError = (emailTouched || hasAttemptedSubmit) ? getEmailError(email) : null;
  const phoneError = (phoneTouched || hasAttemptedSubmit) ? getPhoneError(phone, selectedCountry) : null;
  const passwordError = (passwordTouched || hasAttemptedSubmit) ? getPasswordError(password) : null;
  const confirmPasswordError = (confirmPasswordTouched || hasAttemptedSubmit) ? getConfirmPasswordError(confirmPassword, password) : null;
  const termsError = (hasAttemptedSubmit && !agreedTerms) ? getTermsError(agreedTerms) : null;

  const handleInitiateSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setFullNameTouched(true);
    setEmailTouched(true);
    setPhoneTouched(true);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);
    setSignupError(null);

    const nErr = getNameError(fullName);
    const eErr = getEmailError(email);
    const pErr = getPhoneError(phone, selectedCountry);
    const passErr = getPasswordError(password);
    const cPassErr = getConfirmPasswordError(confirmPassword, password);
    const tErr = getTermsError(agreedTerms);

    if (nErr || eErr || pErr || passErr || cPassErr || tErr) {
      const firstError = nErr || eErr || pErr || passErr || cPassErr || tErr;
      setSignupError(firstError || 'Please complete all required fields and accept the clinical terms.');
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }

    try {
      setIsSubmitting(true);
      const fullPhone = selectedCountry.dial + ' ' + phone.trim();
      sessionStorage.setItem('rxguard_prescriber_phone', fullPhone);
      localStorage.setItem('rxguard_prescriber_phone', fullPhone);

      const res = await authApi.signup({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: fullPhone,
        country_code: selectedCountry.code,
        role: 'USER'
      });
      if (res.dev_otp) {
        console.log('[SmileClinic Dev] One-Time Passcode:', res.dev_otp);
      }
      setEmailOtp(Array(6).fill(''));
      setOtpStatus('idle');
      setOtpError(null);
      setShowOtpModal(true);
      setResendCountdown(60);
    } catch (err: any) {
      setSignupError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    setOtpError(null);

    const entered = codeOverride || emailOtp.join('');
    if (entered.length < 6 || !/^\d{6}$/.test(entered)) {
      setOtpError('Please enter all 6 numeric digits of the Email security code.');
      setOtpStatus('error');
      setTimeout(() => setOtpStatus('idle'), 1500);
      return;
    }

    try {
      setIsVerifying(true);
      setOtpStatus('verifying');
      const res = await authApi.verifyOtp(email, entered);
      if (res.token && res.user) {
        if (!res.user.phone) {
          res.user.phone = sessionStorage.getItem('rxguard_prescriber_phone') || localStorage.getItem('rxguard_prescriber_phone') || (selectedCountry.dial + ' ' + phone.trim());
        }
        authApi.saveSession(res.token, res.user);
        recordLoginEvent('Success', `Account created & authorized session established (${res.user.fullName})`, res.user.email);
      }
      setOtpStatus('success');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err: any) {
      setOtpStatus('error');
      setOtpError(err.message || 'Invalid or expired code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await authApi.resendOtp(email);
      if (res.dev_otp) {
        console.log('[SmileClinic Dev] Resent OTP:', res.dev_otp);
      }
      setResendCountdown(60);
      setOtpError(null);
      setOtpStatus('idle');
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code');
    }
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignup = async () => {
    try {
      setIsGoogleLoading(true);
      setSignupError(null);
      const googleUser = await signInWithGooglePopup();
      if (!googleUser) {
        // User closed or dismissed the popup
        return;
      }

      const res = await authApi.googleAuth(
        googleUser.email,
        googleUser.fullName,
        googleUser.idToken,
        googleUser.photoUrl
      );

      if (res.status === 'otp_required') {
        navigate('/login');
        return;
      }

      if (res.token && res.user) {
        if (!res.user.authProvider) res.user.authProvider = 'google';
        res.user.isGoogleLinked = true;
        authApi.saveSession(res.token, res.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`google_linked_${googleUser.email.toLowerCase()}`, 'true');
        }
        recordLoginEvent('Success', `Account created/authenticated via 1-Click Google OAuth (${googleUser.email})`, googleUser.email);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setSignupError(err.message || 'Google registration failed. Please try again.');
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
      {/* Header */}
      <header className="h-16 w-full bg-surface-container-lowest/90 backdrop-blur-xl shadow-xs border-b border-surface-container-high z-30">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs overflow-hidden"
            >
              {savedLogo ? (
                <img src={savedLogo} alt="Clinic Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-[24px]">shield_with_heart</span>
              )}
            </motion.div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-primary tracking-tight leading-none">Smile Clinic</span>
              <span className="text-[10px] text-outline font-medium tracking-wider uppercase">Smile Clinic Portal</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5 text-on-surface-variant text-xs font-medium bg-surface-container-low px-3 py-1.5 rounded-full border border-surface-container-high">
              <span className="material-symbols-outlined text-[16px] text-primary">badge</span>
              <span>Clinician Licensing Registry</span>
            </div>
            <Link
              to="/support"
              className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-xs font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">help_outline</span>
              <span>Help &amp; Support</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center py-4 sm:py-10 px-3 sm:px-4 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch">

            {/* LEFT: Info Panel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 flex flex-col h-full order-2 lg:order-1"
            >
              <AuthInfoPanel variant="signup" />
            </motion.div>

            {/* RIGHT: Registration Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="lg:col-span-7 flex flex-col justify-between order-1 lg:order-2"
            >
              <div className="bg-surface-container-lowest rounded-2xl sm:rounded-3xl shadow-xl shadow-primary/5 border border-surface-container-high p-4 sm:p-9 flex flex-col gap-5 sm:gap-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-container text-on-primary uppercase tracking-wider">
                      Prescriber Registration
                    </span>
                    <h1 className="text-xl sm:text-2xl font-bold text-on-surface mt-2 tracking-tight">
                      Enroll as Prescriber / Pharmacist
                    </h1>
                    <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-snug">
                      Provision authorized access to real-time drug interaction and renal clearance screening.
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary shadow-xs">
                    <span className="material-symbols-outlined text-[24px]">person_add</span>
                  </div>
                </div>

                {/* Error banner */}
                <AnimatePresence>
                  {signupError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-base shrink-0 mt-0.5 text-rose-600">error</span>
                      <div className="flex-1">
                        <span className="font-semibold block">{signupError}</span>
                        {signupError.toLowerCase().includes('already exists') && (
                          <div className="mt-2 flex items-center gap-2">
                            <Link
                              to="/login"
                              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700 transition-colors inline-block"
                            >
                              Sign In to Account →
                            </Link>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleInitiateSignup} className="space-y-4">

                  {/* Full Name — full width */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Full Legal Name &amp; Title *
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onBlur={() => setFullNameTouched(true)}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        setSignupError(null);
                      }}
                      placeholder="Dr. Arthur Vance, MD"
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-on-surface focus:outline-none transition-all ${
                        nameError
                          ? 'bg-rose-50/20 border border-rose-400 focus:border-rose-500 focus:bg-white'
                          : 'bg-surface-container-low border border-surface-container-high focus:border-primary focus:bg-surface-container-lowest'
                      }`}
                    />
                    {nameError && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                        <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                        <span>{nameError}</span>
                      </p>
                    )}
                  </div>

                  {/* Email — full width */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                        mail
                      </span>
                      <input
                        type="email"
                        autoComplete="off"
                        value={email}
                        onBlur={() => setEmailTouched(true)}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setSignupError(null);
                        }}
                        placeholder="name@gmail.com"
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-on-surface focus:outline-none transition-all ${
                          emailError
                            ? 'bg-rose-50/20 border border-rose-400 focus:border-rose-500 focus:bg-white'
                            : 'bg-surface-container-low border border-surface-container-high focus:border-primary focus:bg-surface-container-lowest'
                        }`}
                      />
                    </div>
                    {emailError && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                        <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                        <span>{emailError}</span>
                      </p>
                    )}
                  </div>

                  {/* Mobile Phone with Country Code Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-on-surface">
                        Mobile Number *
                      </label>
                      <span className="text-[10px] text-outline">
                        Auto-detects country from +code
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {/* Country picker trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          id="country-picker-btn"
                          onClick={() => setShowCountryPicker((p) => !p)}
                          className="h-full min-w-[88px] flex items-center gap-1.5 px-3 py-2.5 bg-surface-container-low rounded-xl border border-surface-container-high hover:border-primary focus:border-primary focus:outline-none transition-all text-xs font-semibold text-on-surface cursor-pointer"
                        >
                          <span className="text-base leading-none">{selectedCountry.flag}</span>
                          <span className="text-on-surface-variant font-mono">{selectedCountry.dial}</span>
                          <span className="material-symbols-outlined text-[14px] text-outline ml-auto">
                            {showCountryPicker ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>

                        <AnimatePresence>
                          {showCountryPicker && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.97 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-full left-0 mt-1 z-50 w-56 bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-xl overflow-hidden"
                            >
                              <div className="max-h-52 overflow-y-auto py-1">
                                {COUNTRIES.map((c) => (
                                  <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                      setSelectedCountry(c);
                                      setShowCountryPicker(false);
                                    }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium hover:bg-surface-container-low transition-colors cursor-pointer ${
                                      selectedCountry.code === c.code ? 'text-primary bg-primary/5' : 'text-on-surface'
                                    }`}
                                  >
                                    <span className="text-base">{c.flag}</span>
                                    <span className="flex-1 text-left">{c.name}</span>
                                    <span className="font-mono text-on-surface-variant text-[11px]">{c.dial}</span>
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Phone number input */}
                      <input
                        type="tel"
                        value={phone}
                        onBlur={() => setPhoneTouched(true)}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder={selectedCountry.code === 'IN' ? '98765 43210' : '555 234 5678'}
                        className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-on-surface focus:outline-none transition-all font-mono ${
                          phoneError
                            ? 'bg-rose-50/20 border border-rose-400 focus:border-rose-500 focus:bg-white'
                            : 'bg-surface-container-low border border-surface-container-high focus:border-primary focus:bg-surface-container-lowest'
                        }`}
                      />
                    </div>
                    {phoneError && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                        <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                        <span>{phoneError}</span>
                      </p>
                    )}
                  </div>

                  {/* Password row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Create System Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onBlur={() => setPasswordTouched(true)}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setSignupError(null);
                          }}
                          placeholder="••••••••••••"
                          className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs sm:text-sm text-on-surface focus:outline-none transition-all ${
                            passwordError
                              ? 'bg-rose-50/20 border border-rose-400 focus:border-rose-500 focus:bg-white'
                              : 'bg-surface-container-low border border-surface-container-high focus:border-primary focus:bg-surface-container-lowest'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-outline hover:text-on-surface p-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                          <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                          <span>{passwordError}</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onBlur={() => setConfirmPasswordTouched(true)}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setSignupError(null);
                          }}
                          placeholder="••••••••••••"
                          className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs sm:text-sm text-on-surface focus:outline-none transition-all ${
                            confirmPasswordError
                              ? 'bg-rose-50/20 border border-rose-400 focus:border-rose-500 focus:bg-white'
                              : 'bg-surface-container-low border border-surface-container-high focus:border-primary focus:bg-surface-container-lowest'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-2.5 text-outline hover:text-on-surface p-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showConfirmPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                      {confirmPasswordError && (
                        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 animate-fadeIn">
                          <span className="material-symbols-outlined text-[14px] shrink-0">error</span>
                          <span>{confirmPasswordError}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Animated password strength + criteria */}
                  <div className="bg-surface-container-low p-3.5 rounded-2xl border border-surface-container-high/60">
                    <PasswordStrengthMeter password={password} confirmPassword={confirmPassword} />
                  </div>

                  {/* Attestation confirmation card */}
                  <div
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      termsError
                        ? 'bg-rose-50/60 border-rose-400 shadow-xs'
                        : agreedTerms
                        ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                        : 'bg-surface-container-low border-surface-container-high/80 hover:border-primary/40 hover:bg-surface-container-lowest'
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer select-none group">
                      {/* Custom checkbox visual */}
                      <div className="relative shrink-0 mt-0.5">
                        <input
                          type="checkbox"
                          checked={agreedTerms}
                          onChange={(e) => {
                            setAgreedTerms(e.target.checked);
                            setSignupError(null);
                          }}
                          className="sr-only"
                        />
                        <motion.div
                          animate={agreedTerms ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                          transition={{ duration: 0.22 }}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            agreedTerms
                              ? 'bg-emerald-600 border-emerald-600 shadow-xs'
                              : termsError
                              ? 'bg-white border-rose-400'
                              : 'bg-white border-outline/50 group-hover:border-primary/60'
                          }`}
                        >
                          {agreedTerms && (
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
                          termsError
                            ? 'text-rose-900 font-semibold'
                            : agreedTerms
                            ? 'text-emerald-950 font-semibold'
                            : 'text-on-surface-variant group-hover:text-on-surface'
                        }`}>
                          I confirm that all details provided are accurate and I agree to the clinical terms and privacy policy.
                        </span>
                      </div>
                    </label>

                    {termsError && (
                      <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1.5 mt-2.5 pt-2 border-t border-rose-200 animate-fadeIn">
                        <span className="material-symbols-outlined text-[15px] shrink-0">error</span>
                        <span>{termsError}</span>
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <motion.button
                    whileHover={{ scale: isSubmitting ? 1 : 1.015, y: isSubmitting ? 0 : -1 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.985 }}
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer ${
                      isSubmitting
                        ? 'bg-primary/80 text-white cursor-wait opacity-90'
                        : 'bg-primary hover:bg-primary-hover text-white hover:shadow-lg'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Authenticating &amp; Sending Verification Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Proceed to Email Verification</span>
                        <span className="material-symbols-outlined text-[18px]">mail_lock</span>
                      </>
                    )}
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

                  {/* Google Sign Up Button */}
                  <motion.button
                    type="button"
                    onClick={handleGoogleSignup}
                    disabled={isGoogleLoading || isSubmitting}
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
                        <span>Sign up with Google</span>
                      </>
                    )}
                  </motion.button>

                  <div className="text-center pt-1 text-xs text-outline">
                    Already an authorized prescriber?{' '}
                    <Link to="/login" className="font-bold text-primary hover:underline">
                      Sign In &rarr;
                    </Link>
                  </div>
                </form>
              </div>
            </motion.div>


          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low py-4 border-t border-surface-container-high shadow-xs z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant text-xs text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-tertiary">shield_with_heart</span>
            <span>© 2026 Smile Clinic Healthcare Technologies. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-4 sm:gap-6 text-[11px] font-medium">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/patient-rights" className="hover:text-primary transition-colors">Patient Rights</Link>
          </div>
        </div>
      </footer>

      {/* Email OTP Verification Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setShowOtpModal(false)}
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
              {/* Modal header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">mail_lock</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Email Verification</h3>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">Enter the 6-digit code sent to your email</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="text-outline hover:text-on-surface p-1 cursor-pointer rounded-lg hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Destination info */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <span className="material-symbols-outlined text-primary text-[20px]">mail</span>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-wider">Code dispatched to</p>
                  <p className="text-sm font-bold text-on-surface font-mono">{email}</p>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {otpError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2"
                  >
                    <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                    <span>{otpError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {/* 6-box OTP */}
                <div className="py-1">
                  <OtpVerificationInput
                    value={emailOtp}
                    onChange={(val) => {
                      setEmailOtp(val);
                      if (otpError) setOtpError(null);
                      if (otpStatus === 'error') setOtpStatus('idle');
                    }}
                    onComplete={(code) => handleVerifyOtp(undefined, code)}
                    status={otpStatus}
                    errorMessage={otpError || undefined}
                    disabled={isVerifying || otpStatus === 'success'}
                  />
                </div>

                {/* Resend & Timer */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high/60">
                  <span className="text-on-surface-variant text-[11px]">
                    Didn't receive the email?
                  </span>
                  {resendCountdown > 0 ? (
                    <span className="text-outline text-[11px] font-mono">
                      Resend in {resendCountdown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      className="text-primary font-bold text-[11px] hover:underline cursor-pointer"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={isVerifying || otpStatus === 'success'}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">verified_user</span>
                        <span>Verify &amp; Activate Account</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
