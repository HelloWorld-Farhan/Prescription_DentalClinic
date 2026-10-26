import React from 'react';

/**
 * Clean Clinical Info Panel for Login and Signup screens.
 * Subtle, precise, and free of noisy floating particles or continuous bouncy animations.
 */
export default function AuthInfoPanel({ variant }: { variant: 'login' | 'signup' }) {
  const isLogin = variant === 'login';

  const features = isLogin
    ? [
        { icon: 'medication', label: 'Drug Interaction Screener', sub: 'Deterministic drug-to-drug safety screening', badge: 'Active' },
        { icon: 'verified_user', label: 'Patient Allergy Alerts', sub: 'Cross-class penicillin & allergen contraindication checks', badge: 'Protected' },
        { icon: 'health_and_safety', label: 'Safe Dosage Guidance', sub: 'Renal clearance (eGFR) and dosage calibration', badge: 'Verified' },
      ]
    : [
        { icon: 'dentistry', label: 'Dental Clinic Care Team', sub: 'Authorized dentists, clinicians & clinical staff', badge: 'Authorized' },
        { icon: 'lock', label: 'Secure Account Access', sub: 'Multi-factor authentication & credential encryption', badge: 'Encrypted' },
        { icon: 'clinical_notes', label: 'Safety Screening Tools', sub: 'Automated decision support during chairside visits', badge: 'Ready' },
      ];

  const titleText = isLogin ? 'Smile Clinic Prescription Safety' : 'Clinician Licensing & Access';
  const subText = isLogin ? 'Prescription Decision Support & Interaction Engine' : 'Prescriber & Healthcare Team Registration';

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-xl border border-surface-container-high h-full min-h-0 lg:min-h-[560px] w-full bg-gradient-to-br from-white via-slate-50 to-teal-50/20 flex flex-col justify-between p-6 sm:p-8 text-on-surface">
      {/* Static Subtle Ambient Gradient (No heavy animations) */}
      <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-teal-100/30 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-emerald-100/25 blur-2xl pointer-events-none" />

      {/* Top Header */}
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
            <span>Smile Clinic Platform</span>
          </div>
          <span className="text-[11px] font-mono text-outline font-semibold">v4.12 CDS</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-black text-on-surface tracking-tight leading-tight">
            {titleText}
          </h2>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1 leading-relaxed">
            {subText}
          </p>
        </div>
      </div>

      {/* Center Features List */}
      <div className="relative z-10 my-6 flex flex-col gap-3">
        {features.map((item, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-2xl bg-surface-container-lowest/80 border border-surface-container-high/60 flex items-start gap-3 shadow-2xs hover:border-primary/30 transition-colors duration-150"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-on-surface truncate">{item.label}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-200/60">
                  {item.badge}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                {item.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Footer Info */}
      <div className="relative z-10 pt-4 border-t border-surface-container-high/60 flex items-center justify-between text-xs text-on-surface-variant">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
          <span className="text-[11px] font-medium">HIPAA 256-Bit SSL Encrypted</span>
        </div>
        <span className="text-[11px] text-outline font-medium">Smile Clinic Verified</span>
      </div>
    </div>
  );
}
