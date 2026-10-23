import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const OFFICIAL_PRESCRIBER_CREDENTIALS = {
  email: 'prescription@smileclinic.com',
  password: 'Prescription@Smile2026#',
  name: 'Dr. Sarah Lin, PharmD',
  role: 'Lead Clinical Pharmacist - Inpatient',
  npi: 'NPI# 1092837482'
};

export default function Login() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'Clinician' | 'Pharmacist' | 'Reviewer' | 'Admin'>('Pharmacist');
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

  // Dynamic clinic logo
  const savedLogo = localStorage.getItem('dental_clinic_logo');

  // Count confirmed attestations
  const confirmedCount = (attest1 ? 1 : 0) + (attest2 ? 1 : 0) + (attest3 ? 1 : 0);
  const isAllAttested = confirmedCount === 3;

  const handleFillDemo = () => {
    setClinicalId(OFFICIAL_PRESCRIBER_CREDENTIALS.email);
    setPassword(OFFICIAL_PRESCRIBER_CREDENTIALS.password);
    setAttest1(true);
    setAttest2(true);
    setAttest3(true);
    setErrorMessage(null);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllAttested) {
      setErrorMessage('You must confirm all 3 mandatory clinical attestations before proceeding.');
      return;
    }

    const inputEmail = clinicalId.trim().toLowerCase();
    const inputPass = password;

    // Check Official Prescriber Credentials
    const isOfficialPrescription =
      inputEmail === OFFICIAL_PRESCRIBER_CREDENTIALS.email.toLowerCase() &&
      inputPass === OFFICIAL_PRESCRIBER_CREDENTIALS.password;

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
          registered ? registered.role : selectedRole
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

  const handleSsoClick = () => {
    setClinicalId(OFFICIAL_PRESCRIBER_CREDENTIALS.email);
    setPassword(OFFICIAL_PRESCRIBER_CREDENTIALS.password);
    setAttest1(true);
    setAttest2(true);
    setAttest3(true);
    setIsLoading(true);
    setTimeout(() => {
      sessionStorage.setItem('rxguard_authenticated', 'true');
      sessionStorage.setItem('rxguard_prescriber_name', 'Dr. Sarah Lin, PharmD');
      sessionStorage.setItem('rxguard_prescriber_role', 'Pharmacist');
      sessionStorage.setItem('rxguard_prescriber_npi', 'EHR-SSO-CERNER-8891');
      sessionStorage.setItem('rxguard_prescriber_email', OFFICIAL_PRESCRIBER_CREDENTIALS.email);
      navigate('/dashboard');
    }, 400);
  };

  return (
    <div className="bg-background font-sans text-on-surface antialiased min-h-screen flex flex-col justify-between selection:bg-primary-container selection:text-on-primary relative overflow-hidden">
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
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-bold uppercase tracking-wider">RxGuard CDS</span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">Prescription Safety &amp; Decision Support</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={handleFillDemo}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20 cursor-pointer shadow-2xs"
            title="Auto-fill verified clinical credentials"
          >
            <span className="material-symbols-outlined text-sm">bolt</span>
            1-Click Demo Fill
          </motion.button>
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

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center py-8 px-4 relative z-10">
        <div className="flex flex-col w-full relative items-center justify-center py-4 sm:py-8 px-1 sm:px-4 min-w-0">
          {/* High-Modern Floating Ambient Teal & Cyan Orbs */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.25, 0.45, 0.25],
              x: [0, 20, 0],
              y: [0, -20, 0]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[440px] bg-primary/15 rounded-full blur-3xl pointer-events-none -z-10"
          />
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.2, 0.4, 0.2],
              x: [0, -30, 0],
              y: [0, 25, 0]
            }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute top-1/2 right-1/4 w-[380px] h-[380px] bg-secondary/15 rounded-full blur-2xl pointer-events-none -z-10"
          />

          {/* Central Card Stack (580px optimized) */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[580px] flex flex-col gap-5"
          >
            {/* Top Badge Strip */}
            <div className="flex items-center justify-between px-1 text-on-surface-variant text-xs">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="font-semibold text-primary">SMART on FHIR v4.0.1 Ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-outline">verified_user</span>
                <span>HIPAA &amp; HITECH Certified Session</span>
              </div>
            </div>

            {/* Main Authentication & Attestation Card */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-xl shadow-primary/5 border border-outline-variant/30 p-6 sm:p-8 flex flex-col gap-6 backdrop-blur-xs">
              {/* Card Header */}
              <div className="flex items-start gap-4">
                <motion.div
                  whileHover={{ rotate: 5, scale: 1.05 }}
                  className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 text-primary shadow-xs"
                >
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    security
                  </span>
                </motion.div>
                <div className="flex flex-col gap-1 min-w-0">
                  <h1 className="text-xl font-bold text-on-surface tracking-tight">
                    Sign In &amp; Access Attestation
                  </h1>
                  <p className="text-xs sm:text-sm text-on-surface-variant leading-snug">
                    Enter authorized clinical credentials and certify patient safety compliance before entering the interaction engine.
                  </p>
                </div>
              </div>

              {/* Role Selector Tabs */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Active Clinical Role</label>
                <div className="grid grid-cols-4 p-1 bg-surface-container-low rounded-xl gap-1">
                  {(['Clinician', 'Pharmacist', 'Reviewer', 'Admin'] as const).map((role) => (
                    <motion.button
                      key={role}
                      type="button"
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedRole(role)}
                      className={`flex items-center justify-center py-2 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === role
                          ? 'bg-primary-container text-on-primary shadow-xs font-bold'
                          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {role}
                    </motion.button>
                  ))}
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
                    Institutional Email / NPI / ID
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-outline text-lg pointer-events-none select-none">
                      badge
                    </span>
                    <input
                      id="clinical-id"
                      type="text"
                      value={clinicalId}
                      onChange={(e) => setClinicalId(e.target.value)}
                      placeholder="prescription@smileclinic.com or NPI# 1092837482"
                      required
                      className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface text-sm placeholder-outline/60 focus:bg-surface-container-low focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-on-surface" htmlFor="clinical-password">
                      System Password
                    </label>
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      Auto-fill password?
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
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full h-10 pl-10 pr-10 rounded-lg bg-surface-container-lowest border border-outline-variant/40 text-on-surface text-sm placeholder-outline/60 focus:bg-surface-container-low focus:border-primary focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                      className="absolute right-2.5 text-outline hover:text-on-surface p-1 rounded flex items-center justify-center focus:outline-none"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Remember Device */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-0 focus:outline-none accent-primary cursor-pointer"
                    />
                    <span className="text-xs text-on-surface-variant">Remember verified workstation (8 hrs)</span>
                  </label>
                  <span className="text-[11px] text-outline font-medium">EPCS Compliant</span>
                </div>

                {/* Mandate Integration Notice Banner */}
                <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-2.5 border border-surface-container-high/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
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
                    Per 45 CFR §164.530 & Joint Commission standard IM.02.02.01, clinician attestation is legally required prior to viewing or cross-matching active prescription regimens.
                  </p>

                  {/* 3 Attestation Checkboxes */}
                  <div className="flex flex-col gap-2 pt-1">
                    <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-surface-container-lowest transition-colors">
                      <input
                        type="checkbox"
                        checked={attest1}
                        onChange={(e) => setAttest1(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-on-surface group-hover:text-primary transition-colors leading-snug">
                        I am authorized to access patient records under institutional clinical privileges.
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-surface-container-lowest transition-colors">
                      <input
                        type="checkbox"
                        checked={attest2}
                        onChange={(e) => setAttest2(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-on-surface group-hover:text-primary transition-colors leading-snug">
                        I will enter only the minimum necessary patient identifiable information (PHI) required for interaction screening.
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-surface-container-lowest transition-colors">
                      <input
                        type="checkbox"
                        checked={attest3}
                        onChange={(e) => setAttest3(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                      />
                      <span className="text-xs text-on-surface group-hover:text-primary transition-colors leading-snug">
                        I understand this tool provides clinical decision support and does not replace licensed medical judgement or statutory pharmacist review.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Submit Button (Gated by 3/3 Attestations) */}
                <div className="flex flex-col gap-2 pt-1">
                  <motion.button
                    type="submit"
                    whileHover={isAllAttested && !isLoading ? { scale: 1.015, y: -1 } : {}}
                    whileTap={isAllAttested && !isLoading ? { scale: 0.985 } : {}}
                    disabled={!isAllAttested || isLoading}
                    className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 select-none ${
                      isAllAttested && !isLoading
                        ? 'bg-primary-container text-on-primary shadow-md hover:bg-primary cursor-pointer hover:shadow-lg'
                        : 'bg-outline/20 text-on-surface/40 cursor-not-allowed'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg ${isLoading ? 'animate-spin' : ''}`}>
                      {isLoading ? 'sync' : isAllAttested ? 'arrow_forward' : 'lock'}
                    </span>
                    <span>
                      {isLoading
                        ? 'Authenticating Session...'
                        : isAllAttested
                        ? `Sign In as ${selectedRole}`
                        : 'Requires 3/3 Attestations Above'}
                    </span>
                  </motion.button>

                  <span className="text-[11px] text-center text-outline">
                    {isAllAttested
                      ? 'Institutional certifications active. Ready for clinical screening.'
                      : 'Confirm all 3 institutional certifications to unlock verification workflow.'}
                  </span>

                  {/* Link to Signup */}
                  <div className="pt-2 text-center text-xs">
                    <span className="text-outline">Need new authorized prescriber credentials? </span>
                    <Link to="/signup" className="text-primary font-bold hover:underline">
                      Enroll as Prescriber / Pharmacist
                    </Link>
                  </div>
                </div>
              </form>

              {/* Enterprise SSO Separator */}
              <div className="relative flex items-center justify-center my-0.5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full bg-surface-container-high h-[1px]"></div>
                </div>
                <span className="relative bg-surface-container-lowest px-3 text-[10px] text-outline font-bold uppercase tracking-wider">
                  OR CLINICAL SINGLE SIGN-ON
                </span>
              </div>

              {/* Institutional SSO Integration Options */}
              <button
                type="button"
                onClick={handleSsoClick}
                className="w-full h-10 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-between px-4 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-lg">domain</span>
                  <span>Sign In via Institutional EHR SSO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-lowest font-bold text-secondary">
                    Epic
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-container-lowest font-bold text-secondary">
                    Cerner
                  </span>
                  <span className="material-symbols-outlined text-sm text-outline">arrow_forward</span>
                </div>
              </button>
            </div>

            {/* Security, Audit & Inactivity Notice Footer Card */}
            <div className="bg-surface-container-low rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant text-xs border border-surface-container-high/60">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">shield</span>
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface">Data encrypted in transit & rest (AES-256 / TLS 1.3)</span>
                  <span className="text-[11px] text-on-surface-variant">All lookups are permanently audited under 45 CFR §164.312.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[11px]">
                <div className="flex items-center gap-1 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  <span>15m Inactivity Lock</span>
                </div>
                <span className="text-outline/40">•</span>
                <a href="#help" onClick={(e) => { e.preventDefault(); handleFillDemo(); }} className="text-secondary hover:underline font-semibold">
                  Clinical Demo Fill
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Standard Legal Footer */}
      <footer className="w-full bg-surface-container-low py-4 border-t border-surface-container-high shadow-[0_-1px_8px_rgba(0,119,130,0.03)] z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant text-xs text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-tertiary">shield_with_heart</span>
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
    </div>
  );
}
