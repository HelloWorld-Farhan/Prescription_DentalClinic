import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import OtpVerificationInput from '../components/OtpVerificationInput';

export interface RegisteredPrescriber {
  fullName: string;
  role: 'Prescribing Clinician' | 'Clinical Pharmacist' | 'Patient Safety Officer' | 'System Administrator';
  npiLicense: string;
  department: string;
  email: string;
  phone: string;
  password: string;
  registeredAt: string;
}

export default function Signup() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'Prescribing Clinician' | 'Clinical Pharmacist' | 'Patient Safety Officer' | 'System Administrator'>('Clinical Pharmacist');
  const [npiLicense, setNpiLicense] = useState('');
  const [department, setDepartment] = useState('Inpatient Dental Surgery');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Dual OTP Modal State (6-box OTP with circle-to-tick morph animation)
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStage, setOtpStage] = useState<'email' | 'mobile'>('email');
  const [emailOtp, setEmailOtp] = useState<string[]>(Array(6).fill(''));
  const [mobileOtp, setMobileOtp] = useState<string[]>(Array(6).fill(''));
  const [mockEmailOtp, setMockEmailOtp] = useState('749210');
  const [mockMobileOtp, setMockMobileOtp] = useState('482915');
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
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, resendCountdown]);

  // Password criteria check
  const isMin8Chars = password.length >= 8;
  const hasCapital = /[A-Z]/.test(password);
  const numberCount = (password.match(/\d/g) || []).length;
  const hasMin2Numbers = numberCount >= 2;
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

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setSignupError('Please provide a valid 10-digit phone number for multi-factor OTP verification.');
      return;
    }

    if (!agreedTerms) {
      setSignupError('Please confirm the Clinical Safety & HIPAA Protocol attestation before proceeding.');
      return;
    }

    // Generate random 6-digit mock OTPs
    const newEmailCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newMobileCode = Math.floor(100000 + Math.random() * 900000).toString();
    setMockEmailOtp(newEmailCode);
    setMockMobileOtp(newMobileCode);
    setEmailOtp(Array(6).fill(''));
    setMobileOtp(Array(6).fill(''));
    setOtpStage('email');
    setOtpStatus('idle');
    setOtpError(null);
    setShowOtpModal(true);
    setResendCountdown(60);
  };

  const handleAutoFillOtp = () => {
    if (otpStage === 'email') {
      setEmailOtp(mockEmailOtp.split(''));
    } else {
      setMobileOtp(mockMobileOtp.split(''));
    }
    setOtpError(null);
    setOtpStatus('idle');
  };

  const handleVerifyOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError(null);

    if (otpStage === 'email') {
      const entered = emailOtp.join('');
      if (entered.length < 6) {
        setOtpError('Please enter all 6 digits of the Email security code.');
        setOtpStatus('error');
        setTimeout(() => setOtpStatus('idle'), 1500);
        return;
      }
      if (entered !== mockEmailOtp) {
        setOtpError('Invalid Email security code. Please check code or auto-fill test code.');
        setOtpStatus('error');
        setTimeout(() => setOtpStatus('idle'), 1500);
        return;
      }

      // Morph 6 boxes into green tick on success
      setOtpStatus('success');
      setIsVerifying(true);
      setTimeout(() => {
        setIsVerifying(false);
        setOtpStage('mobile');
        setOtpStatus('idle');
      }, 1200);
    } else {
      // Mobile stage
      const entered = mobileOtp.join('');
      if (entered.length < 6) {
        setOtpError('Please enter all 6 digits of the Mobile SMS code.');
        setOtpStatus('error');
        setTimeout(() => setOtpStatus('idle'), 1500);
        return;
      }
      if (entered !== mockMobileOtp) {
        setOtpError('Invalid Mobile SMS code. Please check code or auto-fill test code.');
        setOtpStatus('error');
        setTimeout(() => setOtpStatus('idle'), 1500);
        return;
      }

      // Final Morph into Green Tick
      setOtpStatus('success');
      setIsVerifying(true);

      setTimeout(() => {
        // Save new prescriber to localStorage
        const existingPrescribers: RegisteredPrescriber[] = JSON.parse(
          localStorage.getItem('smileclinic_registered_prescribers') || '[]'
        );

        // Check if email already registered
        const filtered = existingPrescribers.filter(p => p.email.toLowerCase() !== email.trim().toLowerCase());
        const newPrescriber: RegisteredPrescriber = {
          fullName: fullName.trim(),
          role,
          npiLicense: npiLicense.trim(),
          department: department.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          registeredAt: new Date().toISOString()
        };

        filtered.push(newPrescriber);
        localStorage.setItem('smileclinic_registered_prescribers', JSON.stringify(filtered));

        // Set flash notification in sessionStorage
        sessionStorage.setItem('smileclinic_prescriber_registered_flash', `Registration successful! You may now sign in as ${newPrescriber.fullName}.`);

        navigate('/login');
      }, 1200);
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

      {/* Main 2-Column Split Viewport: INVERTED (Left = Video Showcase, Right = Registration Form) */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10 px-4 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* LEFT COLUMN: Modern Clinical Credential Stream & Privileges Gateway (5 cols on lg) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 min-h-[580px] bg-gradient-to-br from-[#02131b] via-[#05212d] to-[#010c12] flex flex-col justify-between p-6 sm:p-8 text-white group"
            >
              {/* Refined Background Video with Glassmorphic Blend */}
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-screen scale-105 group-hover:scale-100 transition-transform duration-1000 pointer-events-none"
              >
                <source
                  src="https://assets.mixkit.co/videos/preview/mixkit-scientist-looking-at-a-sample-under-a-microscope-41614-large.mp4"
                  type="video/mp4"
                />
              </video>

              {/* Ambient Glowing Radial Beams */}
              <div className="absolute -top-12 -right-12 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
              <div className="absolute -bottom-12 -left-12 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Top Video Header Overlay */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold text-white tracking-wide uppercase">
                    Prescriber Credential Stream
                  </span>
                </div>
                <span className="text-[11px] font-mono text-cyan-300 font-bold bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/40 shadow-xs">
                  NPI Registry v4.1
                </span>
              </div>

              {/* Center Telemetry Card */}
              <div className="relative z-10 my-auto py-6">
                <div className="bg-white/[0.07] backdrop-blur-2xl p-6 rounded-2xl border border-white/15 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/25 to-emerald-500/25 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shadow-xs">
                        <span className="material-symbols-outlined text-[22px]">badge</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">Prescriber Privileges Gateway</h4>
                        <span className="text-[11px] text-slate-300">Dual-Factor Notarized Identity</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">
                      Tier II Ready
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <motion.div
                      whileHover={{ y: -2, scale: 1.01 }}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-slate-200 text-xs font-medium">HHS NPI National Registry</span>
                      </div>
                      <span className="text-emerald-400 font-bold text-[10px] uppercase bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                        Verified Live
                      </span>
                    </motion.div>

                    <motion.div
                      whileHover={{ y: -2, scale: 1.01 }}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="text-slate-200 text-xs font-medium">DEA Schedule II-IV EPCS</span>
                      </div>
                      <span className="text-cyan-300 font-bold text-[10px] uppercase bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                        2FA Biometric Ready
                      </span>
                    </motion.div>

                    <motion.div
                      whileHover={{ y: -2, scale: 1.01 }}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-teal-400" />
                        <span className="text-slate-200 text-xs font-medium">Hospital Inpatient Dental Privileges</span>
                      </div>
                      <span className="text-teal-300 font-bold text-[10px] uppercase bg-teal-950/70 border border-teal-500/30 px-2 py-0.5 rounded-md">
                        Active Tier I
                      </span>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Bottom Telemetry Strip */}
              <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Security Architecture</span>
                  <span className="text-xs font-bold text-emerald-300 font-mono flex items-center gap-1.5 mt-0.5">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    <span>256-Bit TLS AES · Zero-Knowledge</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Regulatory Standard</span>
                  <span className="text-xs font-bold text-cyan-300">21 CFR §1311 EPCS</span>
                </div>
              </div>
            </motion.div>

            {/* RIGHT COLUMN: Clinician Registration Form (7 cols on lg) - Swapped from Left! */}
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

                {signupError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                    <span>{signupError}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleInitiateSignup} className="space-y-4">
                  {/* Row 1: Full Name & Role */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Clinical Role / Credential *
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all cursor-pointer font-medium"
                      >
                        <option value="Clinical Pharmacist">Clinical Pharmacist (PharmD)</option>
                        <option value="Prescribing Clinician">Prescribing Clinician (MD / DDS)</option>
                        <option value="Patient Safety Officer">Patient Safety Officer</option>
                        <option value="System Administrator">System Administrator (CDS Admin)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Department & NPI */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Clinical Department / Unit *
                      </label>
                      <input
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Inpatient Dental Surgery"
                        className="w-full px-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        NPI / State License # *
                      </label>
                      <input
                        type="text"
                        required
                        value={npiLicense}
                        onChange={(e) => setNpiLicense(e.target.value)}
                        placeholder="NPI# 1928304918"
                        className="w-full px-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Row 3: Institutional Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Institutional Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="clinician@smileclinic.com"
                        className="w-full px-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Mobile Phone (for 2FA OTP) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(555) 234-5678"
                        className="w-full px-3.5 py-2.5 bg-surface-container-low rounded-xl text-xs sm:text-sm text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-all"
                      />
                    </div>
                  </div>

                  {/* Row 4: Password & Confirm Password */}
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

                  {/* Password Safety Criteria Indicators */}
                  <div className="bg-surface-container-low p-3.5 rounded-2xl border border-surface-container-high/60 space-y-1.5 text-xs">
                    <span className="font-bold text-[11px] text-on-surface">Password Standards (EPCS):</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className={`flex items-center gap-1.5 ${isMin8Chars ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                        <span className="material-symbols-outlined text-[15px]">
                          {isMin8Chars ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span>8+ Characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasCapital ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                        <span className="material-symbols-outlined text-[15px]">
                          {hasCapital ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span>1 Uppercase Letter</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasMin2Numbers ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                        <span className="material-symbols-outlined text-[15px]">
                          {hasMin2Numbers ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span>2 Numbers</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                        <span className="material-symbols-outlined text-[15px]">
                          {hasSpecial ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <span>1 Special Symbol</span>
                      </div>
                    </div>
                  </div>

                  {/* HIPAA & EPCS Attestation */}
                  <label className="flex items-start gap-3 p-3 bg-surface-container-low rounded-xl border border-surface-container-high/60 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={agreedTerms}
                      onChange={(e) => setAgreedTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                    />
                    <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors leading-relaxed">
                      I certify that all licensing and institutional clinical credentials provided are authentic and active under 45 CFR §164 and State Pharmacy Board regulations.
                    </span>
                  </label>

                  {/* Submit Button */}
                  <motion.button
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    className="w-full bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <span>Proceed to Dual OTP Verification</span>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                  </motion.button>

                  <div className="text-center pt-2 text-xs text-outline">
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

      {/* Standard Legal Footer */}
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

      {/* Dual OTP Verification Modal */}
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
              className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-6 sm:p-8 z-10 space-y-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[24px]">phonelink_lock</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-on-surface">Dual-Factor Verification</h3>
                    <p className="text-xs text-on-surface-variant">Verify ownership of both email and clinical mobile phone</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="text-outline hover:text-on-surface p-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* STEP PROGRESS TABS */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-xl border border-surface-container-high/60">
                <button
                  type="button"
                  onClick={() => {
                    if (otpStatus !== 'verifying' && otpStatus !== 'success') {
                      setOtpStage('email');
                      setOtpError(null);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    otpStage === 'email'
                      ? 'bg-surface-container-lowest text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  <span>1. Email Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (otpStatus !== 'verifying' && otpStatus !== 'success') {
                      setOtpStage('mobile');
                      setOtpError(null);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    otpStage === 'mobile'
                      ? 'bg-surface-container-lowest text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">sms</span>
                  <span>2. Mobile SMS OTP</span>
                </button>
              </div>

              {otpError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                  <span>{otpError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {otpStage === 'email' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <label className="text-xs font-bold text-on-surface">
                          Email Security Verification Code
                        </label>
                        <span className="text-[11px] text-on-surface-variant">
                          Dispatched to: <strong className="text-on-surface font-mono">{email}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
                        Mock Code: {mockEmailOtp}
                      </span>
                    </div>

                    {/* 6-box OTP Component with Circle Morph & Green Tick */}
                    <div className="py-2">
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
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <label className="text-xs font-bold text-on-surface">
                          SMS Mobile Authentication OTP
                        </label>
                        <span className="text-[11px] text-on-surface-variant">
                          Dispatched to: <strong className="text-on-surface font-mono">{phone}</strong>
                        </span>
                      </div>
                      <span className="text-[10px] text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-full font-bold">
                        Mock Code: {mockMobileOtp}
                      </span>
                    </div>

                    {/* 6-box OTP Component with Circle Morph & Green Tick */}
                    <div className="py-2">
                      <OtpVerificationInput
                        value={mobileOtp}
                        onChange={(val) => {
                          setMobileOtp(val);
                          if (otpError) setOtpError(null);
                          if (otpStatus === 'error') setOtpStatus('idle');
                        }}
                        status={otpStatus}
                        errorMessage={otpError || undefined}
                        disabled={isVerifying || otpStatus === 'success'}
                      />
                    </div>
                  </div>
                )}

                {/* Quick Auto-Fill and Timer */}
                <div className="flex items-center justify-between text-xs pt-1 p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high/60">
                  <button
                    type="button"
                    onClick={handleAutoFillOtp}
                    className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    <span>1-Click Test Code Auto-Fill</span>
                  </button>

                  <span className="text-outline text-[11px] font-mono">
                    Expires in {resendCountdown}s
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifying || otpStatus === 'success'}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">
                          {otpStage === 'email' ? 'arrow_forward' : 'verified_user'}
                        </span>
                        <span>
                          {otpStage === 'email'
                            ? 'Verify Email & Proceed to SMS'
                            : 'Confirm SMS & Activate Account'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
