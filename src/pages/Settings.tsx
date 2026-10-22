import React, { useState } from 'react';

interface ClinicianUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: 'Clinician' | 'Pharmacist' | 'Reviewer' | 'Admin';
  roleColor: string;
  department: string;
  twoFactor: string;
  twoFactorStatus: 'Enabled' | 'Pending';
  lastActivity: string;
  isSelf?: boolean;
}

const initialUsers: ClinicianUser[] = [
  {
    id: '1',
    name: 'Dr. Elena Rostova, MD',
    initials: 'ER',
    email: 'e.rostova@smileclinic.com',
    role: 'Clinician',
    roleColor: 'bg-blue-50 text-blue-800 border-blue-200',
    department: 'Nephrology & Oral Surgery',
    twoFactor: 'Enabled',
    twoFactorStatus: 'Enabled',
    lastActivity: '12 mins ago'
  },
  {
    id: '2',
    name: 'Marcus Vance, PharmD',
    initials: 'MV',
    email: 'm.vance@smileclinic.com',
    role: 'Pharmacist',
    roleColor: 'bg-teal-50 text-teal-800 border-teal-200',
    department: 'Lead Clinical Pharmacist (4B)',
    twoFactor: 'Enabled',
    twoFactorStatus: 'Enabled',
    lastActivity: 'Active now',
    isSelf: true
  },
  {
    id: '3',
    name: 'Sarah Jenkins, RN',
    initials: 'SJ',
    email: 's.jenkins@smileclinic.com',
    role: 'Reviewer',
    roleColor: 'bg-amber-50 text-amber-800 border-amber-200',
    department: 'Patient Safety Officer',
    twoFactor: 'Enabled',
    twoFactorStatus: 'Enabled',
    lastActivity: 'Yesterday at 16:45'
  },
  {
    id: '4',
    name: 'David Chen, CISSP',
    initials: 'DC',
    email: 'd.chen@smileclinic.com',
    role: 'Admin',
    roleColor: 'bg-purple-50 text-purple-800 border-purple-200',
    department: 'Health Informatics & Security',
    twoFactor: 'Enabled (YubiKey)',
    twoFactorStatus: 'Enabled',
    lastActivity: 'Oct 24, 08:30'
  },
  {
    id: '5',
    name: 'Dr. Aisha Patel, DO',
    initials: 'AP',
    email: 'a.patel@smileclinic.com',
    role: 'Clinician',
    roleColor: 'bg-blue-50 text-blue-800 border-blue-200',
    department: 'Emergency & Urgent Dental Care',
    twoFactor: 'Enrollment Pending',
    twoFactorStatus: 'Pending',
    lastActivity: 'Oct 22, 14:12'
  }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'security' | 'users'>('privacy');

  // Privacy toggles state
  const [pseudoId, setPseudoId] = useState(true);
  const [scrubDob, setScrubDob] = useState(true);
  const [filterNotes, setFilterNotes] = useState(false);
  const [storeSex, setStoreSex] = useState(true);
  const [cacheLabs, setCacheLabs] = useState(true);
  const [autoPurge, setAutoPurge] = useState(true);
  const [retentionPeriod, setRetentionPeriod] = useState('7 days (recommended clinical audit window)');

  // Consent language
  const defaultConsent = `I consent to the pseudonymized processing of prescription data, current medications, allergies, and relevant laboratory biomarkers by RxGuard CDS for the sole purpose of detecting medication safety conflicts, teratogenic interactions, and contraindications. Identifiers are cryptographically isolated in accordance with HIPAA §164.514(b).`;
  const [consentText, setConsentText] = useState(defaultConsent);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('••••••••••••••••');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessions, setSessions] = useState([
    {
      id: 'SES-9812',
      name: 'Workstation 4B – Pharmacy Dispense',
      isCurrent: true,
      details: 'Chrome 122 on macOS Sonoma • IP: 10.240.12.84',
      badge: 'Active Now • Hospital Intranet Fiber (VLAN 14)',
      icon: 'desktop_windows'
    },
    {
      id: 'SES-8821',
      name: 'Clinic Tablet Cart #12 – Inpatient Ward 3',
      isCurrent: false,
      details: 'Safari on iPadOS 17.2 • IP: 10.240.18.201',
      badge: 'Last active 22 mins ago • Ward 3 Wi-Fi Mesh',
      icon: 'tablet_mac'
    },
    {
      id: 'SES-7734',
      name: 'Consultation Room 2 Terminal',
      isCurrent: false,
      details: 'Firefox 120 on Windows 11 • IP: 10.240.15.110',
      badge: 'Last active 3 hours ago • Outpatient Wing',
      icon: 'terminal'
    }
  ]);

  // Profile Toggles
  const [severeInterrupts, setSevereInterrupts] = useState(true);
  const [emergencySms, setEmergencySms] = useState(true);
  const [batchSummaries, setBatchSummaries] = useState(false);

  // Users Tab State
  const [userSearch, setUserSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('All');
  const [users, setUsers] = useState<ClinicianUser[]>(initialUsers);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Clinician' | 'Pharmacist' | 'Reviewer' | 'Admin'>('Clinician');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Export Policy JSON functionality
  const handleExportPolicyJson = () => {
    const policyPayload = {
      policySchema: 'SmileClinic-RxGuard-PrivacyPolicy-v4.12',
      exportDateUtc: new Date().toISOString(),
      governanceTier: 'Tier 3 Clinical Safeguard (HIPAA / GDPR)',
      dataMinimizationParameters: {
        pseudonymizePrimaryId: pseudoId,
        retainNormalizedAgeOnly: scrubDob,
        filterClinicalFreeTextNotes: filterNotes,
        storeBiologicalSexAndPregnancy: storeSex,
        cacheGfrCreatinineLabs90Days: cacheLabs
      },
      retentionPolicy: {
        ocrArtifactRetention: retentionPeriod,
        ephemeralPurgeEnabled: autoPurge,
        purgeInactivityThresholdHours: 48,
        storageCapacityGb: 10.0,
        currentUsageGb: 1.4
      },
      consentLanguageVersion: 'v2.3',
      consentLanguageText: consentText,
      regulatoryAudit: {
        status: 'Audit Validated',
        sha256Certificate: 'SHA256-4f8b9e892c21a9987b1c0e3e29f',
        authority: 'Smile Clinic Health System Privacy Board'
      }
    };

    const blob = new Blob([JSON.stringify(policyPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rxguard-policy.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Export Policy JSON downloaded successfully.');
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast(`Session #${sessionId} revoked successfully.`);
  };

  const handleTerminateAllRemote = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    showToast('All remote active sessions terminated.');
  };

  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const newUser: ClinicianUser = {
      id: Date.now().toString(),
      name: inviteName.trim(),
      initials: inviteName.trim().slice(0, 2).toUpperCase(),
      email: inviteEmail.trim(),
      role: inviteRole,
      roleColor:
        inviteRole === 'Clinician'
          ? 'bg-blue-50 text-blue-800 border-blue-200'
          : inviteRole === 'Pharmacist'
          ? 'bg-teal-50 text-teal-800 border-teal-200'
          : inviteRole === 'Reviewer'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-purple-50 text-purple-800 border-purple-200',
      department: 'Invited / Pending Verification',
      twoFactor: 'Enrollment Pending',
      twoFactorStatus: 'Pending',
      lastActivity: 'Just invited'
    };

    setUsers((prev) => [newUser, ...prev]);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    showToast(`Invitation sent to ${newUser.email}`);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.department.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole =
      selectedRoleFilter === 'All' ||
      (selectedRoleFilter === 'Clinicians' && u.role === 'Clinician') ||
      (selectedRoleFilter === 'Pharmacists' && u.role === 'Pharmacist') ||
      (selectedRoleFilter === 'Reviewers' && u.role === 'Reviewer') ||
      (selectedRoleFilter === 'Admins' && u.role === 'Admin');
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto py-2">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

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
              MV
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest"></span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-on-surface">Marcus Vance, PharmD</span>
              <span className="px-2 py-0.2 rounded-full text-[10px] bg-secondary-fixed text-on-secondary-fixed-variant font-bold">
                Active Session
              </span>
            </div>
            <div className="text-[11px] text-outline flex items-center gap-1.5 mt-0.5">
              <span>Lic #PH-98241</span>
              <span>•</span>
              <span className="text-primary font-semibold">Inpatient Central Pharmacy (Station 4B)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center justify-between border-b border-surface-container-high pb-px overflow-x-auto">
        <nav className="flex items-center gap-2" role="tablist">
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
            <span>Privacy &amp; Retention</span>
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
            <span>Security &amp; Hardware 2FA</span>
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
            <span>Users &amp; Roles</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-container-high text-on-surface-variant font-bold">
              {users.length} Active
            </span>
          </button>
        </nav>

        <div className="hidden sm:flex items-center gap-1.5 text-outline text-xs">
          <span className="material-symbols-outlined text-[16px] text-primary">sync</span>
          <span>Auto-sync with Smile Clinic IAM: <strong>Synced 4m ago</strong></span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB PANEL 1: PRIVACY & RETENTION (DEFAULT ACTIVE) */}
      {/* ========================================================================= */}
      {activeTab === 'privacy' && (
        <div className="flex flex-col gap-6">
          {/* HIPAA / Regulatory Compliance Alert Strip */}
          <div className="rounded-2xl p-4 bg-[#EBF8FF] border border-[#BEE3F8] text-[#2B6CB0] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] text-[#2B6CB0] shrink-0 mt-0.5">verified_user</span>
              <div>
                <div className="text-xs sm:text-sm font-bold text-[#1A4F7C] flex items-center gap-2">
                  <span>HIPAA &amp; GDPR Data Minimization Standards — Active Policy: Tier 3 Clinical Safeguard</span>
                </div>
                <p className="text-xs text-[#2B6CB0] mt-0.5">
                  Strict payload redaction enforces synthetic tokenization prior to routing to decision engine. Raw identifiers are never transmitted to LLM reasoning pipelines.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Audit Validated
              </span>
              <button
                type="button"
                onClick={handleExportPolicyJson}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-[#1A4F7C] bg-white border border-[#BEE3F8] hover:bg-sky-50 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Export Policy JSON</span>
              </button>
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
                    <p className="text-xs text-outline">Granular field redaction passed during CDS rule execution and ML inference</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                    5 Fields Scrutinized
                  </span>
                </div>

                {/* Toggles List */}
                <div className="flex flex-col divide-y divide-surface-container text-xs">
                  {/* Toggle 1 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Pseudonymize Patient Primary Identifier</span>
                        <span className="material-symbols-outlined text-outline text-[16px]" title="Replaces MRN with cryptographic surrogate key">info</span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Transformed as <code className="px-1.5 py-0.5 bg-surface-container text-primary rounded font-mono text-[11px]">PT-XXXX-8921</code> for external AI safety verification models.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={pseudoId}
                        onChange={(e) => setPseudoId(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>

                  {/* Toggle 2 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Retain Exact Date of Birth vs. Age in Years</span>
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
                        <span className="font-bold text-on-surface">Include Raw Clinical Free-Text Notes</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-[#ffdad6] text-[#ba1a1a] font-bold">
                          Privacy Risk
                        </span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Filter out unstructured clinical progress notes before third-party verification to eliminate accidental PII leakage.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={filterNotes}
                        onChange={(e) => setFilterNotes(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>

                  {/* Toggle 4 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Store Exact Biological Sex &amp; Pregnancy Status</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800 font-bold">
                          Mandatory for Dosing
                        </span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Critical physiological biomarker indispensable for teratogenic cross-checking, FDA Black Box warnings, and renal equations.
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

                  {/* Toggle 5 */}
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface">Cache Estimated GFR &amp; Serum Creatinine Labs</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] bg-surface-container-high text-on-surface font-bold">
                          90d Window
                        </span>
                      </div>
                      <p className="text-outline mt-0.5">
                        Lab parameters are restricted to an active 90-day clinical relevance window, after which values are purged from memory caches.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={cacheLabs}
                        onChange={(e) => setCacheLabs(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Ephemeral Purge Card */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">auto_delete</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">Automated Ephemeral Purge</h4>
                    <p className="text-xs text-outline mt-0.5">
                      Automatically wipe unconfirmed drafts and transient clinician session caches after 48 hours of inactivity.
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-primary font-medium">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      <span>Next scheduled batch sweep: Today at 02:00 UTC</span>
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={autoPurge}
                    onChange={(e) => setAutoPurge(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container"></div>
                </label>
              </div>
            </div>

            {/* Right: Retention Policies & Consent Editor (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Source Document Retention Period Card */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[20px]">document_scanner</span>
                  <h3 className="text-base font-bold text-on-surface">Artifact Retention Life-Cycle</h3>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface" htmlFor="retention-select">
                    Original Rx Image &amp; OCR Artifact Retention
                  </label>
                  <div className="relative">
                    <select
                      id="retention-select"
                      value={retentionPeriod}
                      onChange={(e) => setRetentionPeriod(e.target.value)}
                      className="w-full h-10 pl-3 pr-10 bg-surface-container-low border border-surface-container-high rounded-xl text-xs sm:text-sm text-on-surface focus:outline-none focus:border-primary appearance-none cursor-pointer"
                    >
                      <option>Immediate deletion after confirmation</option>
                      <option>24 hours</option>
                      <option>7 days (recommended clinical audit window)</option>
                      <option>30 days</option>
                      <option>Custom policy...</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-outline pointer-events-none text-[20px]">
                      expand_more
                    </span>
                  </div>
                  <p className="text-[11px] text-outline mt-1 leading-relaxed">
                    Prescription scans and handwritten OCR captures will be permanently scrubbed from encrypted S3 buckets upon expiry.
                  </p>
                </div>

                {/* Retention Storage Visual Metric */}
                <div className="p-4 bg-surface-container-low rounded-xl flex flex-col gap-2 border border-surface-container-high">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant font-medium">Encrypted OCR Scratchpad Buffer</span>
                    <span className="text-primary font-bold">1.4 GB / 10 GB (14%)</span>
                  </div>
                  <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                    <div className="bg-primary-container h-full rounded-full transition-all" style={{ width: '14%' }}></div>
                  </div>
                  <span className="text-[11px] text-outline">Next shredder cycle runs in 11h 24m</span>
                </div>
              </div>

              {/* Consent Text Template Editor */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-primary">
                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                    <h3 className="text-base font-bold text-on-surface">Patient CDS Consent Language</h3>
                  </div>
                  <span className="text-[11px] font-mono text-outline bg-surface-container px-2 py-0.5 rounded">
                    v2.3 (Active)
                  </span>
                </div>
                <p className="text-xs text-outline">
                  Presented to patients during portal check-in or read by admissions staff before initiating pharmacist checks.
                </p>
                <div className="flex flex-col gap-1.5">
                  <textarea
                    rows={6}
                    value={consentText}
                    onChange={(e) => setConsentText(e.target.value)}
                    className="w-full p-3 bg-surface-container-low border border-surface-container-high rounded-xl font-mono text-xs text-on-surface leading-relaxed focus:outline-none focus:border-primary resize-y"
                  />
                  <div className="flex items-center justify-between text-[11px] text-outline">
                    <span>Variables permitted: <code>{'{{PATIENT_NAME}}'}</code>, <code>{'{{CLINIC_NAME}}'}</code></span>
                    <span>{consentText.length} characters</span>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setConsentText(defaultConsent); showToast('Default consent language restored.'); }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                  >
                    Restore Default
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => showToast('Consent language draft saved.')}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/5 border border-primary transition-colors cursor-pointer"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast('Consent language published as v2.4.')}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary-container hover:bg-primary text-on-primary transition-colors shadow-xs cursor-pointer"
                    >
                      Publish v2.4
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB PANEL 2: SECURITY & HARDWARE 2FA */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="flex flex-col gap-6">
          {/* Security Status Dashboard Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">shield</span>
              </div>
              <div>
                <div className="text-[11px] text-outline uppercase font-semibold">Credential Health</div>
                <div className="text-base font-bold text-on-surface">Maximum Tier</div>
                <span className="text-xs text-emerald-700 font-semibold">Zero breaches detected</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-100 text-[#1960a3] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">key</span>
              </div>
              <div>
                <div className="text-[11px] text-outline uppercase font-semibold">2FA Compliance</div>
                <div className="text-base font-bold text-on-surface">100% Enforced</div>
                <span className="text-xs text-secondary font-semibold">FIPS 140-3 Hardware Key</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high/60 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[28px]">devices</span>
              </div>
              <div>
                <div className="text-[11px] text-outline uppercase font-semibold">Active Sessions</div>
                <div className="text-base font-bold text-on-surface">{sessions.length} Authorized Nodes</div>
                <span className="text-xs text-amber-800 font-semibold">All on Smile Clinic Intranet</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Password & Two Factor (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Password Card */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[20px]">password</span>
                  <h3 className="text-base font-bold text-on-surface">Update Clinician Password</h3>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newPassword && newPassword === confirmPassword) {
                      showToast('Clinician password updated successfully.');
                      setNewPassword('');
                      setConfirmPassword('');
                    } else {
                      showToast('Passwords do not match or field empty.');
                    }
                  }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-10 px-3 rounded-xl border border-surface-container-high bg-surface-container-low text-xs sm:text-sm focus:border-primary outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">New Clinical Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 14 characters"
                      className="h-10 px-3 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                    />
                    {/* Clinical Entropy Meter */}
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-outline">Entropy strength check</span>
                        <span className="text-emerald-700 font-bold">Strong (94 bits)</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 h-1.5 w-full">
                        <div className="bg-emerald-600 rounded-full"></div>
                        <div className="bg-emerald-600 rounded-full"></div>
                        <div className="bg-emerald-600 rounded-full"></div>
                        <div className="bg-emerald-600 rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-on-surface">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="h-10 px-3 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 h-10 rounded-xl bg-primary-container hover:bg-primary text-on-primary text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    Update Password
                  </button>
                </form>
              </div>

              {/* Two-Factor Authentication Card */}
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary">
                    <span className="material-symbols-outlined text-[20px]">security</span>
                    <h3 className="text-base font-bold text-on-surface">Two-Factor Authentication</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    FIPS 140-3 Compliant
                  </span>
                </div>
                <p className="text-xs text-outline">
                  Requires 6-digit TOTP code or WebAuthn hardware YubiKey at every clinical sign-in.
                </p>
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">phonelink_lock</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-on-surface">TOTP Authenticator &amp; YubiKey</div>
                      <div className="text-[11px] text-outline">Configured: YubiKey 5C NFC + 1 Phone</div>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Authenticator reconfiguration initiated.')}
                  className="w-full h-10 rounded-xl border border-primary text-primary hover:bg-primary/5 text-xs font-bold transition-colors cursor-pointer"
                >
                  Reconfigure Authenticator App
                </button>
              </div>
            </div>

            {/* Right: Active Authorized Sessions (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-container">
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Active Clinical Sessions</h3>
                    <p className="text-xs text-outline">Nodes with valid JSON Web Tokens currently authorized under your credentials</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTerminateAllRemote}
                    className="px-3 py-1.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition-colors self-start sm:self-auto flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Terminate Remote Sessions</span>
                  </button>
                </div>

                {/* Sessions List */}
                <div className="flex flex-col gap-3">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden ${
                        sess.isCurrent
                          ? 'bg-surface-container-low border-primary/30'
                          : 'bg-surface-container-lowest border-surface-container-high'
                      }`}
                    >
                      {sess.isCurrent && <div className="absolute top-0 left-0 bottom-0 w-1 bg-primary"></div>}
                      <div className="flex items-start gap-3 pl-1">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            sess.isCurrent
                              ? 'bg-primary-container text-on-primary'
                              : 'bg-surface-container-high text-on-surface'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[22px]">{sess.icon}</span>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-on-surface">{sess.name}</span>
                            {sess.isCurrent && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                                This Device
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-on-surface-variant mt-0.5">{sess.details}</div>
                          <div className="text-[11px] text-primary flex items-center gap-1 mt-1 font-medium">
                            {sess.isCurrent ? (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            ) : (
                              <span className="material-symbols-outlined text-[14px]">history</span>
                            )}
                            <span>{sess.badge}</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center self-end sm:self-center gap-2">
                        <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-surface-container-high text-on-surface-variant">
                          {sess.id}
                        </span>
                        {!sess.isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(sess.id)}
                            className="px-3 py-1 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface hover:bg-rose-50 hover:text-rose-600 hover:border-transparent transition-colors cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Hardware Security Token Advisory */}
                <div className="p-3.5 rounded-xl bg-surface-container-low text-on-surface flex items-start gap-2 border border-surface-container-high mt-1">
                  <span className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0">info</span>
                  <p className="text-[11px] text-outline leading-relaxed">
                    Hospital Information Security policy requires full credential re-authentication every 12 hours on fixed workstations, and 4 hours on mobile bedside tablet carts.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB PANEL 3: USERS AND ROLES */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-xs overflow-hidden">
            {/* Filter and Search Header */}
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container">
              <div className="flex items-center gap-3 flex-1 max-w-xl">
                <div className="w-full flex items-center bg-surface-container-low rounded-xl px-3 py-2 border border-surface-container-high focus-within:border-primary">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-2">search</span>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Filter by clinician name, license, email, or dept..."
                    className="w-full bg-transparent border-0 outline-none text-xs sm:text-sm text-on-surface placeholder:text-outline"
                  />
                </div>
                <div className="relative shrink-0">
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    className="h-10 pl-3 pr-8 bg-surface-container-low border border-surface-container-high rounded-xl text-xs sm:text-sm text-on-surface appearance-none focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="All">All Roles ({users.length})</option>
                    <option value="Clinicians">Clinicians</option>
                    <option value="Pharmacists">Pharmacists</option>
                    <option value="Reviewers">Reviewers</option>
                    <option value="Admins">Admins</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-outline pointer-events-none text-[18px]">
                    expand_more
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="h-10 px-4 rounded-xl bg-primary-container hover:bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Invite Clinician / User</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low/60 border-b border-surface-container text-on-surface-variant font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-6">Clinician / User</th>
                    <th className="py-3 px-4">Role Authorization</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Hardware 2FA</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`hover:bg-surface-container-low/40 transition-colors ${
                        u.isSelf ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-xs shrink-0">
                            {u.initials}
                          </div>
                          <div>
                            <div className="font-bold text-on-surface flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {u.isSelf && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary/10 text-primary font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-outline">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${u.roleColor}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface font-medium">{u.department}</td>
                      <td className="py-3.5 px-4">
                        {u.twoFactorStatus === 'Enabled' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                            <span className="material-symbols-outlined text-[16px]">verified</span>
                            {u.twoFactor}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-semibold">
                            <span className="material-symbols-outlined text-[16px]">pending</span>
                            {u.twoFactor}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-outline text-[11px]">{u.lastActivity}</td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => showToast(`Editing permissions for ${u.name}`)}
                            className="p-1 rounded-lg text-outline hover:text-primary hover:bg-surface-container transition-colors"
                            title="Edit Permissions"
                          >
                            <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                          </button>
                          {!u.isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                setUsers((prev) => prev.filter((item) => item.id !== u.id));
                                showToast(`Suspended access for ${u.name}`);
                              }}
                              className="p-1 rounded-lg text-outline hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Suspend Access"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Pagination / Footer */}
            <div className="px-6 py-3.5 bg-surface-container-low/40 border-t border-surface-container flex items-center justify-between text-[11px] text-outline">
              <div>Showing {filteredUsers.length} of {users.length} verified clinicians · Smile Clinic Directory Linked</div>
              <div className="flex items-center gap-1">
                <button className="px-2.5 py-1 rounded border border-surface-container-high opacity-50 cursor-not-allowed" disabled>
                  Previous
                </button>
                <button className="px-2.5 py-1 rounded bg-primary-container text-on-primary font-bold">1</button>
                <button className="px-2.5 py-1 rounded border border-surface-container-high opacity-50 cursor-not-allowed" disabled>
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Roles Explanatory Callout Grid / Role Governance Legend */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-on-surface">Role Privilege Matrix &amp; Clinical Scopes</h3>
                <p className="text-xs text-outline">Institutional boundaries enforced at CDS execution runtime</p>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono bg-surface-container text-on-surface-variant">
                RBAC Schema 3.2
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-1">
              {/* Role 1 */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-blue-200/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span className="font-bold text-xs text-on-surface">Clinician</span>
                </div>
                <p className="text-xs text-outline">
                  Run new interaction checks, review patient CDS risk alerts, and submit preliminary prescription orders.
                </p>
                <div className="mt-auto pt-2 text-[11px] text-blue-800 font-bold">Read/Run • No Override Auth</div>
              </div>

              {/* Role 2 */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-teal-200/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                  <span className="font-bold text-xs text-on-surface">Pharmacist</span>
                </div>
                <p className="text-xs text-outline">
                  Final sign-off on interactions, override alerts with documented justification, and dispense clearance.
                </p>
                <div className="mt-auto pt-2 text-[11px] text-teal-800 font-bold">Full Clinical Authority • Sign-off</div>
              </div>

              {/* Role 3 */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-amber-200/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                  <span className="font-bold text-xs text-on-surface">Reviewer</span>
                </div>
                <p className="text-xs text-outline">
                  Read-only oversight to historical audit trails, safety incident metrics, overrides, and QA logs.
                </p>
                <div className="mt-auto pt-2 text-[11px] text-amber-800 font-bold">Read-Only • Quality Assurance</div>
              </div>

              {/* Role 4 */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-purple-200/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  <span className="font-bold text-xs text-on-surface">Admin</span>
                </div>
                <p className="text-xs text-outline">
                  Manage enterprise tenant settings, data retention policies, rule weights, and clinician invitations.
                </p>
                <div className="mt-auto pt-2 text-[11px] text-purple-800 font-bold">Super-User • Governance Control</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB PANEL 4: PROFILE */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="flex flex-col gap-6">
          {/* Profile Card */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-3xl shadow-md">
                  MV
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Avatar upload ready.')}
                  className="absolute -bottom-2 -right-2 p-1.5 bg-surface-container-lowest text-primary rounded-xl border border-surface-container-high shadow hover:bg-surface-container cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] block">photo_camera</span>
                </button>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-on-surface">Marcus Vance, PharmD</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    Pharmacist Sign-Off Authority
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-outline mt-0.5">
                  Lead Clinical Pharmacist • License #PH-98241 (State Board of Pharmacy)
                </p>
                <div className="flex items-center gap-4 text-xs text-on-surface-variant mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                    Smile Clinic Central Hospital
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">local_hospital</span>
                    Inpatient Central Pharmacy (4B)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => showToast('Profile editor opened.')}
                className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-primary-container text-on-primary font-bold text-xs shadow-xs hover:bg-primary transition-colors cursor-pointer"
              >
                Edit Clinical Profile
              </button>
              <span className="text-xs text-outline font-mono">NPI: 1982740928</span>
            </div>
          </div>

          {/* Notification Preferences & CDS Delegation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Prescription Alert Routing */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
              <h3 className="text-base font-bold text-on-surface">Prescription Alert Routing</h3>
              <p className="text-xs text-outline">How critical drug-drug interaction triggers reach your personal workstation</p>
              <div className="flex flex-col divide-y divide-surface-container text-xs">
                <div className="pt-2 pb-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-on-surface">Severe / Fatal CDS Interrupts</div>
                    <div className="text-outline text-[11px]">Visual modal takeover + audio chime</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={severeInterrupts}
                    onChange={(e) => setSevereInterrupts(e.target.checked)}
                    className="w-4 h-4 text-primary rounded accent-primary cursor-pointer"
                  />
                </div>
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-on-surface">Emergency SMS Notifications</div>
                    <div className="text-outline text-[11px]">During On-Call Night Shifts only</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emergencySms}
                    onChange={(e) => setEmergencySms(e.target.checked)}
                    className="w-4 h-4 text-primary rounded accent-primary cursor-pointer"
                  />
                </div>
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-on-surface">Batch Shift Quality Summaries</div>
                    <div className="text-outline text-[11px]">Emailed at end of each 8-hour rotation</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={batchSummaries}
                    onChange={(e) => setBatchSummaries(e.target.checked)}
                    className="w-4 h-4 text-primary rounded accent-primary cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Clinical Signing Delegation */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4 justify-between">
              <div>
                <h3 className="text-base font-bold text-on-surface">Clinical Signing Delegation</h3>
                <p className="text-xs text-outline">Backup pharmacist authorized to clear severe interactions in your absence</p>
                <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-xs">
                      ER
                    </div>
                    <div>
                      <div className="font-bold text-xs text-on-surface">Dr. Elena Rostova, MD</div>
                      <div className="text-[11px] text-outline">Designated On-Duty Escalation Proxy</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    Active Proxy
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => showToast('Coverage delegation manager opened.')}
                className="w-full py-2.5 rounded-xl border border-surface-container-high text-on-surface hover:bg-surface-container font-bold text-xs transition-colors cursor-pointer"
              >
                Manage Coverage Delegations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Clinician Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <h3 className="text-base font-bold text-on-surface">Invite Clinician to Portal</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Full Name &amp; Degree</label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Dr. Julian Vance, PharmD"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Official Clinical Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="clinician@smileclinic.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                >
                  <option value="Clinician">Clinician (Read/Run Checks)</option>
                  <option value="Pharmacist">Pharmacist (Sign-Off &amp; Override)</option>
                  <option value="Reviewer">Reviewer (Audit QA)</option>
                  <option value="Admin">Admin (Tenant Governance)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="w-1/2 py-2 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 rounded-xl bg-primary-container text-on-primary text-xs font-bold hover:bg-primary shadow-xs"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
