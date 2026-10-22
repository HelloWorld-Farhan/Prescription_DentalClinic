import { useState } from 'react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'security' | 'users'>('privacy');

  // Privacy toggles state
  const [pseudoKey, setPseudoKey] = useState(true);
  const [scrubDob, setScrubDob] = useState(true);
  const [redactNotes, setRedactNotes] = useState(true);
  const [storeSex, setStoreSex] = useState(false);
  const [inactivityMinutes, setInactivityMinutes] = useState(15);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  // Profile data
  const [clinicianName, setClinicianName] = useState('Dr. Sarah Lin, PharmD');
  const [npiNumber, setNpiNumber] = useState('1092837482');
  const [deaNumber, setDeaNumber] = useState('BL7849201');
  const [institution, setInstitution] = useState('Smile Clinic Health System — Inpatient & Surgery');

  const usersList = [
    { name: 'Dr. Sarah Lin, PharmD', role: 'Lead Clinical Pharmacist', npi: '1092837482', status: 'Active' },
    { name: 'Dr. Arthur Vance, MD', role: 'Inpatient Prescribing Surgeon', npi: '1849204910', status: 'Active' },
    { name: 'Dr. Elena Rostova, DDS', role: 'Oral & Maxillofacial Surgeon', npi: '1902847192', status: 'Active' },
    { name: 'James Thorne, RPh', role: 'Clinical Staff Pharmacist', npi: '1092817293', status: 'Active' },
    { name: 'Marcus Vance, PharmD', role: 'Inpatient Pharmacy Station 4B', npi: '1482019482', status: 'Active' },
  ];

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Top System Header & Clinical Profile Overview */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-surface-container-high/60">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-primary text-xs font-bold tracking-wide uppercase">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Enterprise Decision Governance · Version 4.12</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">System Settings</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
            Manage organizational clinical governance, FHIR data privacy retention boundaries, multi-factor credential security, and clinician authorization roles.
          </p>
        </div>

        {/* Quick Session Badge / Contextual Clinician Strip */}
        <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-surface-container-high shrink-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-sm">
              SL
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest"></span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-on-surface">Dr. Sarah Lin, PharmD</span>
              <span className="px-2 py-0.2 rounded-full text-[10px] bg-secondary-fixed text-on-secondary-fixed-variant font-bold">
                Active Session
              </span>
            </div>
            <div className="text-[11px] text-outline flex items-center gap-1.5 mt-0.5">
              <span>Lic #PH-98241</span>
              <span>•</span>
              <span className="text-primary font-semibold">Smile Clinic Central Pharmacy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center justify-between border-b border-surface-container-high pb-px overflow-x-auto">
        <nav className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            <span>Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">shield</span>
            <span>Privacy & Retention</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 font-bold">
              TIER 3
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>Security & Hardware 2FA</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            <span>Users & Roles</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant font-bold">
              5 Active
            </span>
          </button>
        </nav>

        <div className="hidden sm:flex items-center gap-1.5 text-outline text-xs">
          <span className="material-symbols-outlined text-[16px] text-primary">sync</span>
          <span>Auto-sync with IAM: <strong>Synced 4m ago</strong></span>
        </div>
      </div>

      {/* TAB PANEL 1: PRIVACY & RETENTION (DEFAULT ACTIVE) */}
      {activeTab === 'privacy' && (
        <div className="flex flex-col gap-6">
          {/* HIPAA / Regulatory Compliance Alert Strip */}
          <div className="rounded-2xl p-4 bg-[#EBF8FF] border border-[#BEE3F8] text-[#2B6CB0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] text-[#2B6CB0] shrink-0 mt-0.5">verified_user</span>
              <div>
                <div className="text-xs sm:text-sm font-bold text-[#1A4F7C] flex items-center gap-2">
                  <span>HIPAA & GDPR Data Minimization Standards — Active Policy: Tier 3 Clinical Safeguard</span>
                </div>
                <p className="text-xs text-[#2B6CB0] mt-0.5">
                  Strict payload redaction enforces synthetic tokenization prior to routing to decision engine. Raw identifiers are never transmitted to LLM reasoning pipelines.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Audit Validated
              </span>
            </div>
          </div>

          {/* Main Privacy Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Minimization Checklist Toggles (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Data Minimization Parameters</h3>
                    <p className="text-xs text-outline">Granular field redaction passed during CDS rule execution</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                    4 Fields Scrutinized
                  </span>
                </div>

                {/* Toggles List */}
                <div className="flex flex-col divide-y divide-surface-container text-xs">
                  {/* Toggle 1 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Pseudonymize Patient Primary Identifier</span>
                        <span className="material-symbols-outlined text-outline text-[16px]">info</span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Transformed as <code className="px-1.5 py-0.5 bg-surface-container text-primary rounded font-mono text-[11px]">PT-XXXX-8921</code> for external AI safety verification models.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={pseudoKey}
                        onChange={(e) => setPseudoKey(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>

                  {/* Toggle 2 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Scrub Exact Date of Birth to Age in Years</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-secondary-fixed text-on-secondary-fixed-variant font-bold">
                          Safe Harbor
                        </span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Store and transmit normalized age integer (e.g. 64y) only. Exact day and month scrubbed to prevent micro-targeting.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={scrubDob}
                        onChange={(e) => setScrubDob(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>

                  {/* Toggle 3 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Redact Unstructured Free-Text Clinical Notes</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-[#ffdad6] text-[#ba1a1a] font-bold">
                          Privacy Guard
                        </span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Filter out unstructured clinical progress notes to eliminate accidental PII or identity leakage.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={redactNotes}
                        onChange={(e) => setRedactNotes(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>

                  {/* Toggle 4 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Store Biological Sex & Pregnancy Parameters</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-surface-container text-on-surface-variant font-bold">
                          Clinical Essential
                        </span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Required for teratogenic drug checks (e.g. ACE inhibitors, Doxycycline) and Cockcroft-Gault calculations.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={storeSex}
                        onChange={(e) => setStoreSex(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Retention & Inactivity Policy Card (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-on-surface">Session Inactivity Lock</h3>
                <p className="text-xs text-on-surface-variant">
                  Mandatory under EPCS regulations. Automatically locks session after clinical inactivity.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-on-surface">
                    <span>Inactivity Timeout</span>
                    <span className="text-primary">{inactivityMinutes} minutes</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={inactivityMinutes}
                    onChange={(e) => setInactivityMinutes(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-outline">
                    <span>5 mins (Strict)</span>
                    <span>15 mins (Standard)</span>
                    <span>60 mins (Max)</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-container flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface">Hardware Token MFA</span>
                  <button
                    type="button"
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs ${
                      twoFactorEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {twoFactorEnabled ? 'Enabled (FIDO2)' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB PANEL 2: PROFILE */}
      {activeTab === 'profile' && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs max-w-3xl space-y-4">
          <h3 className="text-base font-bold text-on-surface">Clinician Profile & Prescribing Authority</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-on-surface">Full Clinical Name</label>
              <input
                type="text"
                value={clinicianName}
                onChange={(e) => setClinicianName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-on-surface">National Provider Identifier (NPI)</label>
              <input
                type="text"
                value={npiNumber}
                onChange={(e) => setNpiNumber(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-on-surface">DEA Registration</label>
              <input
                type="text"
                value={deaNumber}
                onChange={(e) => setDeaNumber(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-on-surface">Hospital / Clinical Facility</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => alert('Profile settings updated successfully.')}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-all"
          >
            Save Profile Changes
          </button>
        </div>
      )}

      {/* TAB PANEL 3: SECURITY */}
      {activeTab === 'security' && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs max-w-3xl space-y-4 text-xs">
          <h3 className="text-base font-bold text-on-surface">Security & Hardware 2FA</h3>
          <p className="text-on-surface-variant">
            Electronic Prescriptions for Controlled Substances (EPCS) requires two-factor authentication satisfying DEA § 1311.115.
          </p>
          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-on-surface">FIDO2 / YubiKey Hardware Token</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                Enrolled
              </span>
            </div>
            <p className="text-[11px] text-outline">
              Workstation Serial: YUBI-SEC-992014 • Last verified: Today 08:30 UTC
            </p>
          </div>
        </div>
      )}

      {/* TAB PANEL 4: USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-on-surface">Authorized Clinicians & Permissions</h3>
            <span className="text-xs text-outline">{usersList.length} Active Accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px] text-xs">
              <thead>
                <tr className="bg-surface-container-low text-outline uppercase tracking-wider font-semibold border-b border-surface-container">
                  <th className="py-2.5 px-3">Clinician Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">NPI</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-on-surface">
                {usersList.map((user, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-low/50">
                    <td className="py-3 px-3 font-bold">{user.name}</td>
                    <td className="py-3 px-3 text-on-surface-variant">{user.role}</td>
                    <td className="py-3 px-3 font-mono">{user.npi}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {user.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
