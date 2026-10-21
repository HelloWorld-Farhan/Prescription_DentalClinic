import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const OFFICIAL_PRESCRIBER_CREDENTIALS = {
  email: 'rxguard@smileclinic.com',
  password: 'RxGuard@Smile2026#',
  name: 'Dr. Sarah Lin, PharmD (Clinical Prescriber)',
  npi: 'RX-774021'
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [badgeId, setBadgeId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);

  const handleFillDemo = () => {
    setEmail(OFFICIAL_PRESCRIBER_CREDENTIALS.email);
    setPassword(OFFICIAL_PRESCRIBER_CREDENTIALS.password);
    setBadgeId(OFFICIAL_PRESCRIBER_CREDENTIALS.npi);
    setLoginError(null);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const inputEmail = email.trim().toLowerCase();
    const isOfficial =
      (inputEmail === OFFICIAL_PRESCRIBER_CREDENTIALS.email.toLowerCase() ||
       inputEmail === 'doctor@smileclinic.com') &&
      (password === OFFICIAL_PRESCRIBER_CREDENTIALS.password ||
       password === 'Doctor@Smile2026#');

    if (isOfficial) {
      if (!consentAgreed) {
        setConsentOpen(true);
        return;
      }
      completeAuth();
    } else {
      setLoginError('Invalid credentials. Use rxguard@smileclinic.com / RxGuard@Smile2026# or click Auto-Fill.');
    }
  };

  const completeAuth = () => {
    setIsLoading(true);
    setTimeout(() => {
      sessionStorage.setItem('rxguard_authenticated', 'true');
      sessionStorage.setItem('rxguard_prescriber_name', OFFICIAL_PRESCRIBER_CREDENTIALS.name);
      sessionStorage.setItem('rxguard_prescriber_npi', badgeId || OFFICIAL_PRESCRIBER_CREDENTIALS.npi);
      navigate('/dashboard');
    }, 450);
  };

  return (
    <div className="w-full min-h-screen bg-surface flex flex-col lg:flex-row relative overflow-hidden font-sans">
      {/* Top Advisory Banner */}
      <div className="fixed top-0 inset-x-0 h-8 z-50 bg-[#d3e4ff] text-[#004881] flex items-center justify-center px-4 text-center shadow-xs">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-primary">shield_with_heart</span>
          Smile Clinic RxGuard — Restricted Clinical Decision Support Portal
        </span>
      </div>

      {/* LEFT COLUMN: Prescriber Sign In Form */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 pt-16 pb-12 z-10"
      >
        <div className="max-w-md w-full mx-auto space-y-6">
          {/* Logo & Header */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[28px] text-primary">shield_with_heart</span>
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-primary block leading-tight">Smile Clinic</span>
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">RxGuard Safety Checker</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">Clinician Sign-In</h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1.5 leading-relaxed">
              Authorized clinical pharmacists, dentists, and prescribing surgeons only.
            </p>
          </div>

          {/* Demo Credentials Auto-Fill Pill */}
          <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-primary block flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">key</span>
                Demo Prescriber Credentials
              </span>
              <p className="text-[11px] text-on-surface-variant font-mono">
                rxguard@smileclinic.com • RxGuard@Smile2026#
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="px-3 py-1.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container transition-all shadow-xs shrink-0"
            >
              Auto-Fill
            </button>
          </div>

          {loginError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2 font-medium">
              <span className="material-symbols-outlined text-[18px] text-rose-600">error</span>
              {loginError}
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Clinical Email / Prescriber ID
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-outline text-[18px] absolute left-3">badge</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rxguard@smileclinic.com"
                  required
                  className="w-full text-xs pl-10 pr-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-outline text-[18px] absolute left-3">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full text-xs pl-10 pr-10 py-3 rounded-xl bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1.5">
                Hospital Badge / NPI Number (Optional)
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined text-outline text-[18px] absolute left-3">fingerprint</span>
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  placeholder="RX-774021"
                  className="w-full text-xs pl-10 pr-4 py-3 rounded-xl bg-surface-container-lowest border border-surface-container-high focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-on-surface transition-all font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="consentCheck"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="w-4 h-4 rounded text-primary border-surface-container-high focus:ring-primary"
              />
              <label htmlFor="consentCheck" className="text-xs text-on-surface-variant cursor-pointer">
                I agree to the <button type="button" onClick={() => setConsentOpen(true)} className="text-primary font-bold underline">Clinical Decision Support Consent & Terms</button>.
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Authenticating Session...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">login</span>
                  Sign In to RxGuard Portal
                </>
              )}
            </button>
          </form>

          {/* Quick Links to Doctor and Patient Portals */}
          <div className="pt-6 border-t border-surface-container-high flex items-center justify-between text-xs text-on-surface-variant">
            <span>Other Portals:</span>
            <div className="flex items-center gap-3">
              <a href="https://doctor-dental-clinic.vercel.app/" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">stethoscope</span> Doctor
              </a>
              <span className="text-outline">•</span>
              <a href="https://patient-dental-clinic.vercel.app/" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">person</span> Patient
              </a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* RIGHT COLUMN: Clinical Feature Showcase */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#005c65] via-[#007782] to-[#1960a3] p-12 text-white flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>

        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            SMART on FHIR v4.0.1 Integrated
          </div>
          <h2 className="text-3xl font-black tracking-tight leading-snug">
            Real-Time Drug Interaction Screening & Prescribing Safety
          </h2>
          <p className="text-white/80 text-sm leading-relaxed max-w-lg">
            Protect dental patients from adverse drug events. Automatic cross-referencing of active anticoagulant therapies, beta-lactam allergies, and organ clearance thresholds.
          </p>
        </div>

        {/* Feature Cards Preview */}
        <div className="relative z-10 space-y-3 max-w-md">
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-rose-300 text-[26px]">dangerous</span>
            <div>
              <div className="font-bold text-xs">Fatal Hemorrhage Prevention</div>
              <div className="text-[11px] text-white/80">Blocks NSAIDs against active Warfarin or oral direct factor Xa inhibitors.</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-300 text-[26px]">biotech</span>
            <div>
              <div className="font-bold text-xs">Automated Alternative Suggestions</div>
              <div className="text-[11px] text-white/80">Provides non-beta-lactam and renal-sparing evidence-based dental alternatives.</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/60">
          Smile Clinic Clinical Pharmacopeia • Production R4 Gateway Active
        </div>
      </div>

      {/* Clinical Consent Modal */}
      <AnimatePresence>
        {consentOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-surface-container-high"
            >
              <div className="flex items-center gap-3 text-primary">
                <span className="material-symbols-outlined text-[28px]">shield</span>
                <h3 className="font-extrabold text-base text-on-surface">Clinical Decision Support Consent</h3>
              </div>

              <div className="text-xs text-on-surface-variant space-y-2.5 max-h-60 overflow-y-auto p-3 bg-surface-container-low rounded-xl border border-surface-container-high">
                <p>
                  <strong>1. Nature of the System:</strong> RxGuard is an automated clinical decision support system designed to assist licensed prescribers in identifying known drug-drug, drug-allergy, and dose-renal interactions.
                </p>
                <p>
                  <strong>2. Prescriber Responsibility:</strong> This system does not constitute medical advice or a substitute for independent clinical judgment. The treating clinician remains solely responsible for all final prescribing decisions.
                </p>
                <p>
                  <strong>3. Audit Trail:</strong> All queries, screenings, alert dismissals, and clinician overrides are permanently logged with your NPI and timestamp for medical-legal compliance.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConsentOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConsentAgreed(true);
                    setConsentOpen(false);
                    completeAuth();
                  }}
                  className="px-5 py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-container shadow-sm"
                >
                  Accept & Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
