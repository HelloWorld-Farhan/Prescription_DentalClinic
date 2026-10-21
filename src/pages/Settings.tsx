import React, { useState } from 'react';

export default function Settings() {
  const [sensitivity, setSensitivity] = useState<'strict' | 'standard' | 'minimal'>('standard');
  const [blockContraindicated, setBlockContraindicated] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [autoOpenDrawer, setAutoOpenDrawer] = useState(true);
  const [fhirConnected, setFhirConnected] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Clinic logo from localStorage
  const [clinicLogo, setClinicLogo] = useState<string>(() => {
    return localStorage.getItem('dental_clinic_logo') || '';
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('dental_clinic_logo', clinicLogo);
    window.dispatchEvent(new Event('clinic_logo_updated'));

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[24px]">settings</span>
          <h1 className="text-2xl font-black text-on-surface">RxGuard Safety Portal Settings</h1>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Customize clinical sensitivity thresholds, FHIR integration endpoints, and portal preferences.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>
          Clinical preferences and clinic branding saved successfully!
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* 1. Alert Sensitivity Settings */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-xs space-y-4">
          <h2 className="font-extrabold text-sm text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
            Clinical Alert Sensitivity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'strict', label: 'Strict Protocol', desc: 'Flags all Minor, Moderate, and Major interactions.' },
              { key: 'standard', label: 'Standard Clinical', desc: 'Focuses on Contraindicated & Major threats (Recommended).' },
              { key: 'minimal', label: 'Critical Only', desc: 'Suppresses Minor/Moderate; flags only fatal contraindications.' }
            ].map((s) => (
              <button
                type="button"
                key={s.key}
                onClick={() => setSensitivity(s.key as any)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  sensitivity === s.key
                    ? 'bg-primary/5 border-primary text-primary shadow-xs'
                    : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
                }`}
              >
                <div className="font-bold text-xs">{s.label}</div>
                <div className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">{s.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3 pt-3 border-t border-surface-container-low text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-bold text-on-surface">Hard-Stop on Contraindicated Interactions</span>
              <input
                type="checkbox"
                checked={blockContraindicated}
                onChange={(e) => setBlockContraindicated(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-bold text-on-surface">Auto-Open Monograph Drawer on Major Finding</span>
              <input
                type="checkbox"
                checked={autoOpenDrawer}
                onChange={(e) => setAutoOpenDrawer(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="font-bold text-on-surface">Audible Warning Tone for High-Severity Alerts</span>
              <input
                type="checkbox"
                checked={soundAlerts}
                onChange={(e) => setSoundAlerts(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
            </label>
          </div>
        </div>

        {/* 2. Clinic Branding Synchronization */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-xs space-y-4">
          <h2 className="font-extrabold text-sm text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">palette</span>
            Clinic Logo & Multi-Portal Synchronization
          </h2>
          <p className="text-xs text-on-surface-variant">
            Enter an image URL for your clinic logo. It will sync automatically across the Doctor, Patient, and RxGuard portals.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface block">Clinic Logo Image URL</label>
            <div className="flex gap-3 items-center">
              <div className="w-12 h-12 rounded-xl border border-surface-container-high bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0">
                {clinicLogo ? (
                  <img src={clinicLogo} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="material-symbols-outlined text-primary text-[24px]">shield_with_heart</span>
                )}
              </div>
              <input
                type="url"
                value={clinicLogo}
                onChange={(e) => setClinicLogo(e.target.value)}
                placeholder="https://example.com/clinic-logo.png"
                className="flex-1 text-xs bg-surface-container-low border border-surface-container-high p-3 rounded-xl outline-none text-on-surface"
              />
            </div>
          </div>
        </div>

        {/* 3. SMART on FHIR Gateway Status */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-sm text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
              SMART on FHIR v4.0.1 Integration Gateway
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              fhirConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {fhirConnected ? 'ONLINE & RECONCILED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high space-y-1">
              <span className="text-[10px] text-outline uppercase font-bold">EMR Provider</span>
              <div className="font-bold text-on-surface">St. Jude Health System (Epic FHIR R4)</div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high space-y-1">
              <span className="text-[10px] text-outline uppercase font-bold">Security & Token</span>
              <div className="font-bold text-emerald-700">OAuth2.0 Bearer Valid (Expires 14h)</div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setFhirConnected(!fhirConnected)}
              className="text-xs font-bold text-primary hover:underline"
            >
              {fhirConnected ? 'Simulate Re-Authentication Ping' : 'Reconnect Gateway'}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm hover:bg-primary-container transition-all shadow-sm"
          >
            Save All Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
