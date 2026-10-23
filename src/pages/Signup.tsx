import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';

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

  // Dual OTP Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [mockEmailOtp, setMockEmailOtp] = useState('749210');
  const [mockMobileOtp, setMockMobileOtp] = useState('482915');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(45);

  // Dynamic clinic logo
  const savedLogo = localStorage.getItem('dental_clinic_logo');

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
    setEmailOtp('');
    setMobileOtp('');
    setOtpError(null);
    setShowOtpModal(true);
    setResendCountdown(60);
  };

  const handleAutoFillOtp = () => {
    setEmailOtp(mockEmailOtp);
    setMobileOtp(mockMobileOtp);
    setOtpError(null);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    if (emailOtp.trim() !== mockEmailOtp) {
      setOtpError('Invalid Email OTP code. Check your code or click Auto-fill.');
      return;
    }

    if (mobileOtp.trim() !== mockMobileOtp) {
      setOtpError('Invalid Mobile OTP code. Check your code or click Auto-fill.');
      return;
    }

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

      // Also set flash notification in sessionStorage
      sessionStorage.setItem('smileclinic_prescriber_registered_flash', `Registration successful! You may now sign in as ${newPrescriber.fullName}.`);

      navigate('/login');
    }, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="bg-background font-sans text-on-surface antialiased min-h-screen flex flex-col justify-between selection:bg-primary-container selection:text-on-primary relative overflow-hidden"
    >
      {/* Ambient Animated Gradient Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.35, 0.5, 0.35],
          x: [0, 20, 0],
          y: [0, -15, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 left-1/3 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"
      />
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.25, 0.45, 0.25],
          x: [0, -25, 0],
          y: [0, 20, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute bottom-10 right-1/4 w-[450px] h-[350px] bg-secondary/15 rounded-full blur-3xl pointer-events-none -z-10"
      />

      {/* Header Bar */}
      <div className="w-full">
        <header className="w-full bg-surface-container-lowest/80 backdrop-blur-xl shadow-xs border-b border-surface-container-high z-30">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
      </div>

      {/* Main Form Viewport */}
      <main className="w-full flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-4xl mx-auto py-4">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl shadow-xl shadow-primary/5 border border-surface-container-high/60 overflow-hidden"
          >
            {/* Header Strip */}
            <div className="bg-gradient-to-r from-primary/10 via-primary-container/5 to-transparent p-6 sm:p-8 border-b border-surface-container-high/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-container text-on-primary uppercase tracking-wider">
                  Clinician Registration
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mt-2 tracking-tight">
                  Enroll as Authorized Prescriber
                </h1>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                  Connect your clinical license to run real-time drug-drug contraindication checks and attestation overrides.
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <div className="text-xs text-outline font-medium">Already have authorized access?</div>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-primary hover:underline mt-1"
                >
                  <span>Sign In to Prescriber Portal</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleInitiateSignup} className="p-6 sm:p-8 lg:p-10 space-y-6">
              {signupError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-700 flex items-start gap-2.5 shadow-xs">
                  <span className="material-symbols-outlined text-rose-600 shrink-0 text-base mt-0.5">error</span>
                  <span>{signupError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Full Legal Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    Full Legal Name &amp; Degree *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      person
                    </span>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Dr. Sarah Lin, PharmD"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline"
                    />
                  </div>
                </div>

                {/* Role Authorization */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    Clinical Role Scope *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      badge
                    </span>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface appearance-none"
                    >
                      <option value="Clinical Pharmacist">Clinical Pharmacist (Full Override &amp; Sign-off)</option>
                      <option value="Prescribing Clinician">Prescribing Clinician / Doctor (Order &amp; Check)</option>
                      <option value="Patient Safety Officer">Patient Safety Officer / Reviewer (QA Audit)</option>
                      <option value="System Administrator">System Administrator (Governance &amp; Tenant)</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-outline text-[18px] pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* NPI / License */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    NPI or Medical / Pharmacy License # *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      verified
                    </span>
                    <input
                      type="text"
                      required
                      value={npiLicense}
                      onChange={(e) => setNpiLicense(e.target.value)}
                      placeholder="e.g. NPI# 1092837482 / Lic# PH-98241"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline"
                    />
                  </div>
                </div>

                {/* Clinical Department */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    Hospital Facility / Department *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      local_hospital
                    </span>
                    <input
                      type="text"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Central Pharmacy / Oral Surgery Unit 4"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline"
                    />
                  </div>
                </div>

                {/* Official Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    Official Hospital / Clinical Email *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="clinician@smileclinic.com"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline"
                    />
                  </div>
                </div>

                {/* Mobile Phone */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    Mobile Phone (For 2FA OTP) *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      smartphone
                    </span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                      Create Password *
                    </label>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      lock
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-outline hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Password validation indicators */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                    <div className={`flex items-center gap-1 ${isMin8Chars ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {isMin8Chars ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>8+ characters</span>
                    </div>
                    <div className={`flex items-center gap-1 ${hasCapital ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {hasCapital ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>1 uppercase</span>
                    </div>
                    <div className={`flex items-center gap-1 ${hasMin2Numbers ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {hasMin2Numbers ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>2 numbers</span>
                    </div>
                    <div className={`flex items-center gap-1 ${hasSpecial ? 'text-emerald-700 font-semibold' : 'text-outline'}`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {hasSpecial ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>1 special symbol</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-on-surface uppercase tracking-wider">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
                      lock_reset
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-9 pr-10 py-2 text-xs sm:text-sm rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-outline"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-outline hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="pt-1 text-[11px]">
                      {passwordsMatch ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Passwords match perfectly
                        </span>
                      ) : (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          Passwords do not match
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Legal & Attestation Checkbox */}
              <div className="pt-2 border-t border-surface-container-high/60">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-primary rounded border-surface-container-highest focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs text-on-surface-variant leading-relaxed">
                    I attest that I am a licensed healthcare prescriber or clinical staff member authorized to access patient drug therapy records. I agree to the{' '}
                    <Link to="/terms-of-service" className="text-primary font-bold hover:underline">
                      Clinical Terms of Service
                    </Link>
                    ,{' '}
                    <Link to="/privacy-policy" className="text-primary font-bold hover:underline">
                      HIPAA Privacy Policy
                    </Link>
                    , and understand that algorithmic CDS flags constitute decision support rather than independent prescribing authority.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-outline flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">security</span>
                  <span>Instant 2FA verification code sent to email &amp; SMS</span>
                </div>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs sm:text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to 2FA Verification</span>
                  <span className="material-symbols-outlined text-[18px]">lock_clock</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      </main>

      {/* DUAL OTP MODAL */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">phonelink_lock</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Dual-Channel 2FA Verification</h3>
                    <p className="text-xs text-outline">Confirming identity for {email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleVerifyOtp} className="p-6 space-y-5">
                {otpError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
                    <span>{otpError}</span>
                  </div>
                )}

                {/* Email OTP Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-on-surface flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">mail</span>
                      Email Security Code
                    </span>
                    <span className="text-outline">Sent to {email}</span>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    placeholder="Enter 6-digit email code"
                    className="w-full px-4 py-2.5 text-center text-lg font-mono tracking-widest rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                  <div className="text-[11px] text-outline flex justify-between items-center px-1">
                    <span>Demo Mock Code: <strong className="text-primary font-mono">{mockEmailOtp}</strong></span>
                  </div>
                </div>

                {/* Mobile SMS OTP Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-on-surface flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-primary">smartphone</span>
                      SMS Security Code
                    </span>
                    <span className="text-outline">Sent to {phone}</span>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={mobileOtp}
                    onChange={(e) => setMobileOtp(e.target.value)}
                    placeholder="Enter 6-digit SMS code"
                    className="w-full px-4 py-2.5 text-center text-lg font-mono tracking-widest rounded-xl border border-surface-container-high bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                  <div className="text-[11px] text-outline flex justify-between items-center px-1">
                    <span>Demo Mock Code: <strong className="text-primary font-mono">{mockMobileOtp}</strong></span>
                  </div>
                </div>

                {/* Quick Auto-Fill Helper */}
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-between">
                  <div className="text-xs text-on-surface">
                    <span className="font-semibold text-primary">Instant Demo Verification:</span> Click to auto-fill both test OTP codes.
                  </div>
                  <button
                    type="button"
                    onClick={handleAutoFillOtp}
                    className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary text-xs font-bold hover:bg-primary transition-colors cursor-pointer shrink-0"
                  >
                    Auto-Fill Codes
                  </button>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="w-full sm:w-1/3 py-2.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isVerifying}
                    className="w-full sm:w-2/3 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Verifying &amp; Authorizing...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                        <span>Verify &amp; Create Account</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-outline text-xs gap-2">
          <div>© 2026 Smile Clinic Healthcare Technologies. RxGuard CDS Regulatory System.</div>
          <div className="flex items-center gap-4">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/patient-rights" className="hover:text-primary transition-colors">Patient Rights</Link>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
