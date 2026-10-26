import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import OtpVerificationInput from '../components/OtpVerificationInput';
import AuthInfoPanel from '../components/AuthInfoPanel';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';

export interface RegisteredPrescriber {
  fullName: string;
  email: string;
  phone: string;
  countryCode: string;
  password: string;
  registeredAt: string;
}

// Country dial codes for the picker
const COUNTRIES = [
  { code: 'IN', dial: '+91',  flag: '🇮🇳', name: 'India'          },
  { code: 'US', dial: '+1',   flag: '🇺🇸', name: 'United States'   },
  { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom'  },
  { code: 'AU', dial: '+61',  flag: '🇦🇺', name: 'Australia'       },
  { code: 'CA', dial: '+1',   flag: '🇨🇦', name: 'Canada'          },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE'             },
  { code: 'SG', dial: '+65',  flag: '🇸🇬', name: 'Singapore'       },
  { code: 'PK', dial: '+92',  flag: '🇵🇰', name: 'Pakistan'        },
  { code: 'BD', dial: '+880', flag: '🇧🇩', name: 'Bangladesh'      },
  { code: 'LK', dial: '+94',  flag: '🇱🇰', name: 'Sri Lanka'       },
  { code: 'MY', dial: '+60',  flag: '🇲🇾', name: 'Malaysia'        },
  { code: 'NP', dial: '+977', flag: '🇳🇵', name: 'Nepal'           },
  { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Germany'         },
  { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France'          },
  { code: 'NZ', dial: '+64',  flag: '🇳🇿', name: 'New Zealand'     },
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

  // Email OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState<string[]>(Array(6).fill(''));
  const [mockEmailOtp, setMockEmailOtp] = useState('749210');
  const [otpStatus, setOtpStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
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

  const handleInitiateSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (!isPasswordValid) {
      setSignupError('Password must contain at least 8 characters, 1 uppercase letter, 2 numbers, and 1 special symbol.');
      return;
    }
    if (!passwordsMatch) {
      setSignupError('Passwords do not match. Please verify your entries.');
      return;
    }
    // Validate bare number (digits only, at least 7)
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      setSignupError('Please provide a valid phone number.');
      return;
    }
    if (!agreedTerms) {
      setSignupError('Please confirm the clinical credentials attestation before proceeding.');
      return;
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setMockEmailOtp(newCode);
    setEmailOtp(Array(6).fill(''));
    setOtpStatus('idle');
    setOtpError(null);
    setShowOtpModal(true);
    setResendCountdown(60);
  };

  const handleVerifyOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError(null);

    const entered = emailOtp.join('');
    if (entered.length < 6) {
      setOtpError('Please enter all 6 digits of the Email security code.');
      setOtpStatus('error');
      setTimeout(() => setOtpStatus('idle'), 1500);
      return;
    }
    if (entered !== mockEmailOtp) {
      setOtpError('Invalid code. Please check the code or auto-fill the test code.');
      setOtpStatus('error');
      setTimeout(() => setOtpStatus('idle'), 1500);
      return;
    }

    setOtpStatus('success');
    setIsVerifying(true);
    setTimeout(() => {
      const existing: RegisteredPrescriber[] = JSON.parse(
        localStorage.getItem('smileclinic_registered_prescribers') || '[]'
      );
      const filtered = existing.filter((p) => p.email.toLowerCase() !== email.trim().toLowerCase());
      const newPrescriber: RegisteredPrescriber = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: selectedCountry.dial + ' ' + phone.trim(),
        countryCode: selectedCountry.code,
        password,
        registeredAt: new Date().toISOString(),
      };
      filtered.push(newPrescriber);
      localStorage.setItem('smileclinic_registered_prescribers', JSON.stringify(filtered));
      sessionStorage.setItem(
        'smileclinic_prescriber_registered_flash',
        `Registration successful! You may now sign in as ${newPrescriber.fullName}.`
      );
      navigate('/login');
    }, 1200);
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
              <span className="text-[10px] text-outline font-medium tracking-wider uppercase">RxGuard Safety Engine</span>
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
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10 px-4 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

            {/* LEFT: Info Panel */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5"
            >
              <AuthInfoPanel variant="signup" />
            </motion.div>

            {/* RIGHT: Registration Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="lg:col-span-7 flex flex-col justify-between"
            >
              <div className="bg-surface-container-lowest rounded-3xl shadow-xl shadow-primary/5 border border-surface-container-high p-6 sm:p-9 flex flex-col gap-6">
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
                      className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2"
                    >
                      <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                      <span>{signupError}</span>
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
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Arthur Vance, MD"
                      className="w-full px-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all"
                    />
                  </div>

                  {/* Email — full width */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Institutional Email Address *
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
                        mail
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="clinician@smileclinic.com"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all"
                      />
                    </div>
                  </div>

                  {/* Mobile Phone with Country Code Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Mobile Number *
                    </label>
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
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^\d\s\-()]/g, ''))}
                        placeholder={selectedCountry.code === 'IN' ? '98765 43210' : '555 234 5678'}
                        className="flex-1 px-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all font-mono"
                      />
                    </div>
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
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-3.5 pr-10 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-outline hover:text-on-surface p-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full pl-3.5 pr-10 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-2.5 text-outline hover:text-on-surface p-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showConfirmPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Animated password strength + criteria */}
                  <div className="bg-surface-container-low p-3.5 rounded-2xl border border-surface-container-high/60">
                    <PasswordStrengthMeter password={password} confirmPassword={confirmPassword} />
                  </div>

                  {/* Attestation checkbox — styled */}
                  <motion.label
                    whileTap={{ scale: 0.995 }}
                    className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                      agreedTerms
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-surface-container-low border-surface-container-high/60 hover:border-primary/40 hover:bg-surface-container-lowest'
                    }`}
                  >
                    {/* Custom checkbox visual */}
                    <div className="relative shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="sr-only"
                      />
                      <motion.div
                        animate={agreedTerms ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          agreedTerms
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'bg-surface-container border-outline/50'
                        }`}
                      >
                        {agreedTerms && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="material-symbols-outlined text-white text-[14px]"
                          >
                            check
                          </motion.span>
                        )}
                      </motion.div>
                    </div>
                    <span className={`text-xs leading-relaxed transition-colors ${agreedTerms ? 'text-emerald-800 font-medium' : 'text-on-surface-variant'}`}>
                      I certify that all licensing and institutional clinical credentials provided are authentic and active under{' '}
                      <strong>45 CFR §164</strong> and <strong>State Pharmacy Board regulations</strong>.
                    </span>
                  </motion.label>

                  {/* Submit */}
                  <motion.button
                    whileHover={{ scale: 1.015, y: -1 }}
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    className="w-full bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <span>Proceed to Email Verification</span>
                    <span className="material-symbols-outlined text-[18px]">mail_lock</span>
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
            <span>© 2026 Smile Clinic Healthcare Technologies. RxGuard CDS Regulatory System.</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOtpModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
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
                    status={otpStatus}
                    errorMessage={otpError || undefined}
                    disabled={isVerifying || otpStatus === 'success'}
                  />
                </div>

                {/* Dev auto-fill + timer */}
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high/60">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailOtp(mockEmailOtp.split(''));
                      setOtpError(null);
                      setOtpStatus('idle');
                    }}
                    className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    <span>Auto-fill test code</span>
                  </button>
                  <span className="text-outline text-[11px] font-mono">
                    {resendCountdown > 0 ? `Expires in ${resendCountdown}s` : 'Code expired'}
                  </span>
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
