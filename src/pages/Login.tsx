import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ForgotPasswordModal from '../components/ForgotPasswordModal';
import AuthInfoPanel from '../components/AuthInfoPanel';

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
  const [authorizedConfirmation, setAuthorizedConfirmation] = useState(true);
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

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorizedConfirmation) {
      setErrorMessage('Please confirm authorization before signing in.');
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
                Prescription Portal
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
                            {showPassword ? 'visibility' : 'visibility_off'}
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
                          className="w-4 h-4 rounded text-primary focus:ring-0 accent-primary cursor-pointer"
                        />
                        <span className="text-xs text-on-surface-variant font-medium">Remember me on this workstation</span>
                      </label>
                    </div>

                    {/* Clinician Authorization Confirmation */}
                    <div className="bg-surface-container-low rounded-2xl p-3.5 border border-surface-container-high/60">
                      <label className="flex items-start gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={authorizedConfirmation}
                          onChange={(e) => setAuthorizedConfirmation(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-0 accent-primary cursor-pointer shrink-0"
                        />
                        <span className="text-xs text-on-surface-variant group-hover:text-on-surface transition-colors leading-relaxed">
                          I confirm that I am an authorized clinician accessing Smile Clinic patient records.
                        </span>
                      </label>
                    </div>

                    {/* Submit Button */}
                    <div className="flex flex-col gap-2 pt-1">
                      <motion.button
                        type="submit"
                        whileHover={authorizedConfirmation && !isLoading ? { scale: 1.015, y: -1 } : {}}
                        whileTap={authorizedConfirmation && !isLoading ? { scale: 0.985 } : {}}
                        disabled={!authorizedConfirmation || isLoading}
                        className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 select-none ${
                          authorizedConfirmation && !isLoading
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
