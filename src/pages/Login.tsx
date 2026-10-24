import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export const OFFICIAL_PRESCRIBER_CREDENTIALS = {
  email: 'prescription@smileclinic.com',
  password: 'Prescription@Smile2026#',
  name: 'Dr. Sarah Lin, PharmD',
  role: 'Lead Clinical Pharmacist - Inpatient',
  npi: 'NPI# 1092837482'
};

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const [clinicalId, setClinicalId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [attest1, setAttest1] = useState(true);
  const [attest2, setAttest2] = useState(true);
  const [attest3, setAttest3] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  // Dynamic clinic logo
  const savedLogo = localStorage.getItem('dental_clinic_logo');

  // Count confirmed attestations
  const confirmedCount = (attest1 ? 1 : 0) + (attest2 ? 1 : 0) + (attest3 ? 1 : 0);
  const isAllAttested = confirmedCount === 3;

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAttested) {
      setErrorMessage('You must confirm all 3 mandatory clinical attestations before proceeding.');
      return;
    }

    const inputEmail = clinicalId.trim().toLowerCase();
    const inputPass = password;

    // Check custom password if prescriber previously reset it
    const customPass = localStorage.getItem('smileclinic_custom_prescriber_password');

    // Check Official Prescriber Credentials
    const isOfficialPrescription =
      inputEmail === OFFICIAL_PRESCRIBER_CREDENTIALS.email.toLowerCase() &&
      (inputPass === OFFICIAL_PRESCRIBER_CREDENTIALS.password || (customPass && inputPass === customPass));

    // Check legacy rxguard & doctor credentials
    const isOfficialRxGuard =
      (inputEmail === 'rxguard@smileclinic.com' && inputPass === 'RxGuard@Smile2026#') ||
      (inputEmail === 'doctor@smileclinic.com' && inputPass === 'Doctor@Smile2026#');

    // Check Registered Prescribers
    const registeredPrescribers = JSON.parse(
      localStorage.getItem('smileclinic_registered_prescribers') || '[]'
    );
    const registered = registeredPrescribers.find(
      (p: any) => p.email.toLowerCase() === inputEmail && p.password === inputPass
    );

    // Also check registered doctors from Doctor portal if shared
    const registeredDoctors = JSON.parse(
      localStorage.getItem('smileclinic_registered_doctors') || '[]'
    );
    const registeredDoc = registeredDoctors.find(
      (d: any) => d.email.toLowerCase() === inputEmail && d.password === inputPass
    );

    if (isOfficialPrescription || isOfficialRxGuard || registered || registeredDoc) {
      setIsLoading(true);
      setTimeout(() => {
        sessionStorage.setItem('rxguard_authenticated', 'true');
        if (rememberDevice) {
          localStorage.setItem('rxguard_authenticated', 'true');
        }
        sessionStorage.setItem(
          'rxguard_prescriber_name',
          registered ? registered.fullName : registeredDoc ? registeredDoc.name : OFFICIAL_PRESCRIBER_CREDENTIALS.name
        );
        sessionStorage.setItem(
          'rxguard_prescriber_role',
          registered ? registered.role : 'Clinical Pharmacist'
        );
        sessionStorage.setItem(
          'rxguard_prescriber_npi',
          registered ? registered.npiLicense : OFFICIAL_PRESCRIBER_CREDENTIALS.npi
        );
        sessionStorage.setItem(
          'rxguard_prescriber_email',
          inputEmail
        );
        navigate('/dashboard');
      }, 400);
    } else {
      setErrorMessage(
        'Invalid credentials. Please enter authorized prescriber email and password, or enroll below.'
      );
    }
  };

  const handlePasswordResetSuccess = (email: string) => {
    setClinicalId(email);
    setSuccessFlash(`Password updated successfully for ${email}. Please sign in with your new password.`);
    setErrorMessage(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="bg-background font-sans text-on-surface antialiased min-h-screen flex flex-col justify-between selection:bg-primary-container selection:text-on-primary relative overflow-hidden"
    >
      {/* Global Clinical Header */}
      <header className="h-16 w-full bg-surface-container-lowest border-b border-outline-variant/30 px-4 lg:px-8 flex items-center justify-between shadow-xs z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold shadow-xs overflow-hidden">
            {savedLogo ? (
              <img src={savedLogo} alt="Smile Clinic Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="material-symbols-outlined text-[22px]">dentistry</span>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-primary leading-none">Smile Clinic</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-bold uppercase tracking-wider">
                RxGuard CDS
              </span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">Prescription Safety &amp; Decision Support</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 text-on-surface-variant text-xs font-medium bg-surface-container-low px-3 py-1.5 rounded-full border border-surface-container-high">
            <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
            <span>HIPAA Compliant 256-Bit SSL</span>
          </div>
          <Link
            to="/support"
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-primary transition-colors text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">help_outline</span>
            <span>Support</span>
          </Link>
        </div>
      </header>

      {/* Main 2-Column Split Viewport: Left = Login Form, Right = Prescription Video */}
      <main className="flex-1 flex items-center justify-center py-6 sm:py-10 px-4 relative z-10">
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
              className="absolute -top-24 left-1/4 -translate-x-1/2 w-[550px] h-[380px] bg-primary/15 rounded-full blur-3xl pointer-events-none -z-10"
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* LEFT COLUMN: Clean Clinician Login Form (7 cols on lg) */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-7 flex flex-col justify-between"
              >
                <div className="bg-surface-container-lowest rounded-3xl shadow-xl shadow-primary/5 border border-surface-container-high p-6 sm:p-9 flex flex-col gap-6">
                  {/* Top Badge Strip */}
                  <div className="flex items-center justify-between text-on-surface-variant text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                      <span className="font-semibold text-primary">SMART on FHIR v4.0.1 Ready</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-outline">verified_user</span>
                      <span>HIPAA &amp; EPCS Certified</span>
                    </div>
                  </div>

                  {/* Header Title */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">lock</span>
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
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

                  {/* Error Message */}
                  {errorMessage && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
                      <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">error</span>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Credentials Form */}
                  <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                    {/* Clinical ID / Email */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-on-surface" htmlFor="clinical-id">
                        Institutional Email / Prescriber NPI *
                      </label>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none select-none">
                          badge
                        </span>
                        <input
                          id="clinical-id"
                          type="text"
                          value={clinicalId}
                          onChange={(e) => {
                            setClinicalId(e.target.value);
                            setErrorMessage(null);
                          }}
                          placeholder="prescription@smileclinic.com or NPI# 1092837482"
                          required
                          className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-sm placeholder:text-outline focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all"
                        />
                      </div>
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
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setErrorMessage(null);
                          }}
                          placeholder="••••••••••••"
                          required
                          className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface text-sm placeholder:text-outline focus:bg-surface-container-lowest focus:border-primary focus:outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label="Toggle password visibility"
                          className="absolute right-3 text-outline hover:text-on-surface p-1 rounded cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Remember Device & EPCS Flag */}
                    <div className="flex items-center justify-between pt-0.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberDevice}
                          onChange={(e) => setRememberDevice(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-0 accent-primary cursor-pointer"
                        />
                        <span className="text-xs text-on-surface-variant font-medium">Remember verified workstation (8 hrs)</span>
                      </label>
                      <span className="text-[11px] text-outline font-semibold">21 CFR EPCS Ready</span>
                    </div>

                    {/* Mandatory Regulatory Attestations */}
                    <div className="bg-surface-container-low rounded-2xl p-4 flex flex-col gap-2.5 border border-surface-container-high/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-base">
                            gavel
                          </span>
                          <span className="text-xs font-bold text-on-surface">Mandatory Regulatory Attestations</span>
                        </div>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold transition-colors ${
                            isAllAttested
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          {confirmedCount} of 3 Confirmed
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        Per 45 CFR §164.530 &amp; Joint Commission standard IM.02.02.01, clinician attestation is legally required prior to viewing active prescription regimens.
                      </p>

                      <div className="flex flex-col gap-2 pt-1">
                        <label className="flex items-start gap-2.5 cursor-pointer group p-1.5 rounded-lg hover:bg-surface-container-lowest transition-colors">
                          <input
                            type="checkbox"
                            checked={attest1}
                            onChange={(e) => setAttest1(e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                          />
                          <span className="text-xs text-on-surface group-hover:text-primary transition-colors leading-snug">
                            I am authorized under institutional clinical privileges.
                          </span>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer group p-1.5 rounded-lg hover:bg-surface-container-lowest transition-colors">
                          <input
                            type="checkbox"
                            checked={attest2}
                            onChange={(e) => setAttest2(e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                          />
                          <span className="text-xs text-on-surface group-hover:text-primary transition-colors leading-snug">
                            I will enter only minimum necessary patient identifiable information (PHI).
                          </span>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer group p-1.5 rounded-lg hover:bg-surface-container-lowest transition-colors">
                          <input
                            type="checkbox"
                            checked={attest3}
                            onChange={(e) => setAttest3(e.target.checked)}
                            className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                          />
                          <span className="text-xs text-on-surface group-hover:text-primary transition-colors leading-snug">
                            I understand this tool provides CDS and does not replace statutory pharmacist review.
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex flex-col gap-2 pt-1">
                      <motion.button
                        type="submit"
                        whileHover={isAllAttested && !isLoading ? { scale: 1.015, y: -1 } : {}}
                        whileTap={isAllAttested && !isLoading ? { scale: 0.985 } : {}}
                        disabled={!isAllAttested || isLoading}
                        className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 select-none ${
                          isAllAttested && !isLoading
                            ? 'bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg cursor-pointer'
                            : 'bg-outline/20 text-on-surface/40 cursor-not-allowed'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-lg ${isLoading ? 'animate-spin' : ''}`}>
                          {isLoading ? 'sync' : isAllAttested ? 'login' : 'lock'}
                        </span>
                        <span>
                          {isLoading
                            ? 'Authenticating Clinical Session...'
                            : isAllAttested
                            ? 'Sign In to RxGuard Portal'
                            : 'Requires 3/3 Attestations Above'}
                        </span>
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

                {/* Clean Bottom Security Strip (No demo buttons) */}
                <div className="mt-4 p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high/60 flex items-center justify-between text-xs text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-primary">shield</span>
                    <span className="text-[11px] font-medium">Data encrypted in transit &amp; rest (AES-256 / TLS 1.3)</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-outline font-medium">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>15m Inactivity Lock</span>
                  </div>
                </div>
              </motion.div>

              {/* RIGHT COLUMN: Modern Clinical Safety Stream & CDS Engine Showcase Card (5 cols on lg) */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="lg:col-span-5 relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 min-h-[580px] bg-gradient-to-br from-[#02131b] via-[#041d27] to-[#010b10] flex flex-col justify-between p-6 sm:p-8 text-white group"
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
                    src="https://assets.mixkit.co/videos/preview/mixkit-doctor-working-with-a-tablet-41617-large.mp4"
                    type="video/mp4"
                  />
                </video>

                {/* Ambient Glowing Radial Beams */}
                <div className="absolute -top-12 -right-12 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
                <div className="absolute -bottom-12 -left-12 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

                {/* Top Video Header Overlay */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-white tracking-wide uppercase">
                      Prescription Safety Stream
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-teal-300 font-bold bg-teal-950/80 px-2.5 py-1 rounded-lg border border-teal-500/40 shadow-xs">
                    FHIR R4 v4.0.1
                  </span>
                </div>

                {/* Center Telemetry Card */}
                <div className="relative z-10 my-auto py-6">
                  <div className="bg-white/[0.07] backdrop-blur-2xl p-6 rounded-2xl border border-white/15 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500/25 to-emerald-500/25 border border-teal-400/30 text-teal-300 flex items-center justify-center shadow-xs">
                          <span className="material-symbols-outlined text-[22px]">medication</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-tight">Clinical Interaction Screener</h4>
                          <span className="text-[11px] text-slate-300">Deterministic Cross-Match Engine</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full font-bold border border-emerald-500/30">
                        Live Screening
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <motion.div
                        whileHover={{ y: -2, scale: 1.01 }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                          <span className="text-slate-200 text-xs font-medium">Warfarin + Fluconazole</span>
                        </div>
                        <span className="text-rose-300 font-bold text-[10px] uppercase bg-rose-950/70 border border-rose-500/40 px-2 py-0.5 rounded-md">
                          Contraindicated
                        </span>
                      </motion.div>

                      <motion.div
                        whileHover={{ y: -2, scale: 1.01 }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-slate-200 text-xs font-medium">eGFR Renal Clearance &lt;50mL</span>
                        </div>
                        <span className="text-amber-300 font-bold text-[10px] uppercase bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-md">
                          Auto-Adjust Dose
                        </span>
                      </motion.div>

                      <motion.div
                        whileHover={{ y: -2, scale: 1.01 }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-teal-400" />
                          <span className="text-slate-200 text-xs font-medium">Penicillin Anaphylaxis Guard</span>
                        </div>
                        <span className="text-teal-300 font-bold text-[10px] uppercase bg-teal-950/70 border border-teal-500/40 px-2 py-0.5 rounded-md">
                          Cross-Class Safe
                        </span>
                      </motion.div>
                    </div>
                  </div>
                </div>

                {/* Bottom Telemetry Strip */}
                <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Engine Verification</span>
                    <span className="text-xs font-bold text-teal-300 font-mono flex items-center gap-1.5 mt-0.5">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Real-Time Interlock · Zero Fault</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Compliance Matrix</span>
                    <span className="text-xs font-bold text-emerald-300">21 CFR §1311 EPCS</span>
                  </div>
                </div>
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

      {/* Forgot Password Modal Dialog */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        onSuccess={handlePasswordResetSuccess}
        initialEmail={clinicalId}
      />
    </motion.div>
  );
}
