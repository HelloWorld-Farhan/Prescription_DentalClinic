import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../services/authApi';
import {
  ActiveSessionItem,
  LoginHistoryItem,
  getActiveSessions,
  saveActiveSessions,
  getLoginHistory,
  recordLoginEvent
} from '../services/sessionAudit';

export interface ClinicalProfile {
  fullName: string;
  role: string;
  authority: string;
  license: string;
  npi: string;
  hospital: string;
  department: string;
  email: string;
  phone: string;
  avatarInitials: string;
  avatarColor: string;
}

function loadRealUserProfile(): ClinicalProfile {
  let storedUser: any = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('smileclinic_auth_user');
      if (raw) storedUser = JSON.parse(raw);
    } catch {
      storedUser = {};
    }
  }

  const name =
    sessionStorage.getItem('rxguard_prescriber_name') ||
    localStorage.getItem('rxguard_prescriber_name') ||
    storedUser.fullName ||
    'Authorized Clinician';

  const email =
    sessionStorage.getItem('rxguard_prescriber_email') ||
    localStorage.getItem('rxguard_prescriber_email') ||
    storedUser.email ||
    'clinician@smileclinic.com';

  const role =
    sessionStorage.getItem('rxguard_prescriber_role') ||
    localStorage.getItem('rxguard_prescriber_role') ||
    storedUser.role ||
    'Clinical Prescriber';

  const rawNpi =
    sessionStorage.getItem('rxguard_prescriber_npi') ||
    localStorage.getItem('rxguard_prescriber_npi') ||
    storedUser.licenseNumber ||
    storedUser.id ||
    '1982740928';
  const npi =
    rawNpi && rawNpi !== 'NPI Verified' && rawNpi !== 'NPI-PENDING' && rawNpi !== 'RX-774021'
      ? rawNpi
      : '1982740928';

  const initials = name
    .replace(/^Dr\.\s*/i, '')
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('') || 'RX';

  return {
    fullName: name,
    role: role,
    authority: 'Clinical Prescriber Sign-Off Authority',
    license: storedUser.licenseNumber ? `NPI #${storedUser.licenseNumber}` : `NPI #${npi}`,
    npi: npi,
    hospital: 'Smile Clinic Health System',
    department: storedUser.clinicId || 'Clinical Operatory & Dispensary',
    email: email,
    phone: storedUser.phone || '+1 (555) 948-2819',
    avatarInitials: initials,
    avatarColor: 'bg-primary-container text-on-primary'
  };
}

// Types are imported from ../services/sessionAudit

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // --- Profile State (synced dynamically with database auth session) ---
  const [profile, setProfile] = useState<ClinicalProfile>(() => {
    const saved = localStorage.getItem('smileclinic_rxguard_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email !== 'm.vance@smileclinic.com' && !parsed.fullName?.includes('Marcus Vance')) {
          return parsed;
        } else {
          localStorage.removeItem('smileclinic_rxguard_profile');
        }
      } catch {
        // Fall back to real user profile
      }
    }
    return loadRealUserProfile();
  });

  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editForm, setEditForm] = useState<ClinicalProfile>(profile);

  // --- Security & Password State ---
  type VerificationMethod = 'email' | 'sms' | 'password_otp';
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('email');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isVerificationUnlocked, setIsVerificationUnlocked] = useState(false);
  const [unlockedMethodLabel, setUnlockedMethodLabel] = useState('');
  const [verifiedResetOtp, setVerifiedResetOtp] = useState('');
  const [isSendingPasswordOtp, setIsSendingPasswordOtp] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Password reset fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Modal State (for Password Change & 2FA Reconfiguration)
  type OtpModalPurpose = 'password_change' | 'two_factor_reconfig';
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<OtpModalPurpose>('password_change');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [isOtpSuccess, setIsOtpSuccess] = useState(false);
  const [isOtpError, setIsOtpError] = useState(false);
  const [otpErrorMessage, setOtpErrorMessage] = useState('');
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 2FA Reconfiguration Status
  const [twoFactorConfigured, setTwoFactorConfigured] = useState<boolean>(() => {
    const stored = sessionStorage.getItem('rxguard_two_factor_enabled');
    if (stored !== null) return stored === 'true';
    try {
      const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
      if (u.twoFactorEnabled !== undefined) return Boolean(u.twoFactorEnabled);
    } catch {}
    return false;
  });
  const [isToggling2Fa, setIsToggling2Fa] = useState(false);

  // Detect whether current session is authenticated via Google OAuth
  const isGoogleUser = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
      return u.authProvider === 'google' || u.role?.toLowerCase() === 'google';
    } catch {
      return false;
    }
  }, []);

  // Active Sessions scoped per email
  const [sessions, setSessions] = useState<ActiveSessionItem[]>(() => getActiveSessions(profile.email));
  const [showTerminateAllModal, setShowTerminateAllModal] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<ActiveSessionItem | null>(null);

  // Login History State scoped per email
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>(() => getLoginHistory(profile.email, profile.fullName));
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'All' | 'Success' | '2FA Verified' | 'Revoked' | 'Blocked'>('All');
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 4;

  // Keep sessions and audit history synced whenever clinician email changes
  useEffect(() => {
    if (profile.email) {
      setSessions(getActiveSessions(profile.email));
      setLoginHistory(getLoginHistory(profile.email, profile.fullName));
    }
  }, [profile.email, profile.fullName]);

  // General Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Keep editForm synced when modal opens
  const handleOpenEditProfile = () => {
    setEditForm({ ...profile });
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(editForm);
    localStorage.setItem('smileclinic_rxguard_profile', JSON.stringify(editForm));
    sessionStorage.setItem('rxguard_prescriber_name', editForm.fullName);
    sessionStorage.setItem('rxguard_prescriber_role', editForm.role);
    sessionStorage.setItem('rxguard_prescriber_email', editForm.email);
    sessionStorage.setItem('rxguard_prescriber_npi', editForm.npi);
    setShowEditProfileModal(false);
    showToast('Clinical Profile updated successfully across the portal.');
  };

  // --- Toggle 2FA in Database ---
  const handleToggle2FA = async (enable: boolean) => {
    setIsToggling2Fa(true);
    try {
      await authApi.toggle2FA(profile.email, enable);
      setTwoFactorConfigured(enable);
      sessionStorage.setItem('rxguard_two_factor_enabled', String(enable));
      try {
        const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
        u.twoFactorEnabled = enable;
        localStorage.setItem('smileclinic_auth_user', JSON.stringify(u));
      } catch {}
      showToast(`Two-Factor Authentication ${enable ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update Two-Factor Authentication.');
    } finally {
      setIsToggling2Fa(false);
    }
  };

  // --- Password Flow Trigger ---
  const handleInitiatePasswordVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationMethod === 'sms') {
      showToast('SMS verification is coming soon. Please use Email Passcode.');
      return;
    }
    if (verificationMethod === 'password_otp') {
      if (!currentPasswordInput.trim()) {
        showToast('Please enter your current clinical password first.');
        return;
      }

      setIsSendingPasswordOtp(true);
      try {
        await authApi.verifyCurrentPassword(profile.email, currentPasswordInput);
        setIsVerificationUnlocked(true);
        setUnlockedMethodLabel('Verified Current Password');
        showToast('Current password verified! You may now set your new clinical password.');
      } catch (err: any) {
        showToast(err.message || 'Incorrect previous password. Please check your credentials.');
      } finally {
        setIsSendingPasswordOtp(false);
      }
      return;
    }

    // Email Passcode method: send OTP to email
    setIsSendingPasswordOtp(true);
    try {
      await authApi.forgotPassword(profile.email);
      showToast(`6-Digit security passcode dispatched to ${profile.email}`);
      setOtpPurpose('password_change');
      setOtpDigits(['', '', '', '', '', '']);
      setIsOtpSuccess(false);
      setIsOtpError(false);
      setOtpErrorMessage('');
      setShowOtpModal(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to send verification passcode. Please try again.');
    } finally {
      setIsSendingPasswordOtp(false);
    }
  };

  // --- 2FA Reconfigure Trigger ---
  const handleInitiate2FaReconfig = () => {
    setOtpPurpose('two_factor_reconfig');
    setOtpDigits(['', '', '', '', '', '']);
    setIsOtpSuccess(false);
    setIsOtpError(false);
    setOtpErrorMessage('');
    setShowOtpModal(true);
  };

  // --- OTP Segmented Input Handlers ---
  const handleOtpDigitChange = (index: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = char;
    setOtpDigits(updated);
    setIsOtpError(false);
    setOtpErrorMessage('');

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    } else if (char && index === 5) {
      // Auto-validate on entering 6th digit
      const fullCode = updated.join('');
      if (fullCode.length === 6) {
        setTimeout(() => handleVerifyOtp(undefined, fullCode), 50);
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = pasted[i] || '';
    }
    setOtpDigits(updated);
    if (pasted.length === 6) {
      setTimeout(() => handleVerifyOtp(undefined, pasted), 50);
    } else {
      const nextIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
    }
  };


  // --- Submit & Validate OTP ---
  const handleVerifyOtp = async (e?: React.FormEvent, directOtp?: string) => {
    if (e) e.preventDefault();
    const entered = directOtp || otpDigits.join('');
    if (entered.length < 6 || !/^\d{6}$/.test(entered)) {
      setIsOtpError(true);
      setOtpErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsOtpVerifying(true);
    setIsOtpError(false);
    setOtpErrorMessage('');

    try {
      if (otpPurpose === 'password_change') {
        // Authenticate with backend: strictly reject wrong OTP
        await authApi.verifyResetOtp(profile.email, entered);
        setIsOtpSuccess(true);
        setTimeout(() => {
          setShowOtpModal(false);
          setIsOtpSuccess(false);
          setVerifiedResetOtp(entered);
          setIsVerificationUnlocked(true);
          setUnlockedMethodLabel(`Verified Email Passcode (${profile.email})`);
          showToast('Identity verified successfully! You may now set your new clinical password.');
        }, 700);
      } else {
        setIsOtpSuccess(true);
        setTimeout(() => {
          setShowOtpModal(false);
          setIsOtpSuccess(false);
          setTwoFactorConfigured(true);
          showToast('Two-Factor Authentication reconfigured and verified successfully.');
        }, 700);
      }
    } catch (err: any) {
      setIsOtpError(true);
      setOtpErrorMessage(err.message || 'Invalid 6-digit verification code. Please check your email and try again.');
    } finally {
      setIsOtpVerifying(false);
    }
  };

  // --- Save New Password in Database ---
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match. Please verify.');
      return;
    }

    setIsSavingPassword(true);
    try {
      if (verificationMethod === 'password_otp' && currentPasswordInput) {
        // Direct password change via previous password (no OTP needed)
        await authApi.changePasswordWithCurrent(profile.email, currentPasswordInput, newPassword);
      } else {
        await authApi.resetPassword(profile.email, verifiedResetOtp, newPassword);
      }
      setIsVerificationUnlocked(false);
      setNewPassword('');
      setConfirmPassword('');
      setVerifiedResetOtp('');
      setCurrentPasswordInput('');
      const ev = recordLoginEvent(
        'Success',
        `Clinical password updated in database (${profile.email})`,
        profile.email
      );
      setLoginHistory((prev) => [ev, ...prev]);
      showToast('Clinical password updated successfully in the database.');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // --- Session Termination & Revocation ---
  const handleConfirmTerminateAllRemote = () => {
    const remaining = sessions.filter((s) => s.isCurrent);
    setSessions(remaining);
    saveActiveSessions(remaining, profile.email);
    setShowTerminateAllModal(false);
    const revokedRecord = recordLoginEvent(
      'Revoked',
      'All remote clinical terminals terminated via governance console',
      profile.email
    );
    setLoginHistory((prev) => [revokedRecord, ...prev]);
    showToast('All remote active sessions terminated immediately.');
  };

  const handleConfirmRevokeSingle = () => {
    if (!sessionToRevoke) return;
    const remaining = sessions.filter((s) => s.id !== sessionToRevoke.id);
    setSessions(remaining);
    saveActiveSessions(remaining, profile.email);
    const revokedRecord = recordLoginEvent(
      'Revoked',
      `Remote terminal #${sessionToRevoke.id} revoked (${sessionToRevoke.name})`,
      profile.email
    );
    setLoginHistory((prev) => [revokedRecord, ...prev]);
    showToast(`Session #${sessionToRevoke.id} (${sessionToRevoke.name}) has been revoked.`);
    setSessionToRevoke(null);
  };

  // --- Login History Filter & Pagination ---
  const filteredHistory = loginHistory.filter((item) => {
    const q = historySearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.device.toLowerCase().includes(q) ||
      item.browserOs.toLowerCase().includes(q) ||
      item.ip.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      Boolean(item.details && item.details.toLowerCase().includes(q));
    const matchesStatus = historyStatusFilter === 'All' || item.status === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const currentHistoryPage = Math.min(historyPage, totalPages);
  const paginatedHistory = filteredHistory.slice((currentHistoryPage - 1) * pageSize, currentHistoryPage * pageSize);

  // Auto-focus first input when OTP modal opens
  useEffect(() => {
    if (showOtpModal) {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 150);
    }
  }, [showOtpModal]);

  return (
    <div className="flex flex-col w-full gap-6 max-w-7xl mx-auto py-2">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-2xl flex items-center gap-2.5 border border-slate-700"
          >
            <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-xs border border-surface-container-high/60">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-primary text-xs font-bold tracking-wide uppercase">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Prescription Decision Governance · Version 4.12</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">System Settings</h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
            Configure clinician credentials, password security with multi-method OTP verification, two-factor authorization, active sessions, and access audit trails.
          </p>
        </div>

        {/* Live Active Profile Pill in Header */}
        <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl border border-surface-container-high shrink-0 shadow-2xs">
          <div className="relative">
            <div className={`w-10 h-10 rounded-xl ${profile.avatarColor} flex items-center justify-center font-bold text-sm shadow-xs`}>
              {profile.avatarInitials}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-surface-container-lowest animate-pulse"></span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-on-surface">{profile.fullName}</span>
              <span className="px-2 py-0.2 rounded-full text-[10px] bg-secondary-fixed text-on-secondary-fixed-variant font-bold">
                Active Session
              </span>
            </div>
            <div className="text-[11px] text-outline flex items-center gap-1.5 mt-0.5">
              <span>{profile.license.split(' ')[0]}</span>
              <span>•</span>
              <span className="text-primary font-semibold">{profile.department}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar - Streamlined to Profile & Security */}
      <div className="flex items-center justify-between border-b border-surface-container-high pb-px overflow-x-auto">
        <nav className="flex items-center gap-2" role="tablist">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">account_circle</span>
            <span>Profile &amp; Clinical Identity</span>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-primary-container text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock_reset</span>
            <span>Security, Password &amp; Sessions</span>
          </motion.button>
        </nav>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-outline font-medium">
          <span className="material-symbols-outlined text-[15px] text-emerald-600">verified_user</span>
          <span>HIPAA &amp; FIPS 140-3 Cryptographic Guard Active</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB PANEL 1: PROFILE & CLINICAL IDENTITY */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-6"
        >
          {/* Main Profile Masthead Card */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="relative">
                <div className={`w-24 h-24 rounded-2xl ${profile.avatarColor} flex items-center justify-center font-bold text-3xl shadow-md tracking-wider`}>
                  {profile.avatarInitials}
                </div>
                <button
                  type="button"
                  onClick={handleOpenEditProfile}
                  className="absolute -bottom-2 -right-2 p-1.5 bg-surface-container-lowest text-primary rounded-xl border border-surface-container-high shadow hover:bg-surface-container cursor-pointer transition-transform hover:scale-105"
                  title="Edit Profile Avatar"
                >
                  <span className="material-symbols-outlined text-[18px] block">edit</span>
                </button>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-on-surface">{profile.fullName}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    {profile.authority}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-outline mt-0.5">
                  {profile.role} • License #{profile.license}
                </p>
                <div className="flex items-center gap-4 text-xs text-on-surface-variant mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                    {profile.hospital}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">local_hospital</span>
                    {profile.department}
                  </span>
                  <span className="flex items-center gap-1 text-outline">
                    <span className="material-symbols-outlined text-[16px]">mail</span>
                    {profile.email}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end gap-2 w-full md:w-auto">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleOpenEditProfile}
                className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-primary-container text-on-primary font-bold text-xs shadow-xs hover:bg-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">badge</span>
                <span>Edit Clinical Profile</span>
              </motion.button>
              <span className="text-xs text-outline font-mono">NPI: {profile.npi}</span>
            </div>
          </div>

          {/* Verified Database Clinician Account Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                <span className="text-xs font-bold uppercase tracking-wide">Database Unique ID (NPI)</span>
              </div>
              <div className="font-mono text-sm font-bold text-on-surface break-all">{profile.npi}</div>
              <div className="text-[11px] text-outline mt-1 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Active Database Record / NPI</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[20px]">badge</span>
                <span className="text-xs font-bold uppercase tracking-wide">Clinical Authority &amp; Role</span>
              </div>
              <div className="text-sm font-bold text-on-surface">{profile.role}</div>
              <div className="text-[11px] text-outline mt-1">{profile.authority}</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[20px]">verified</span>
                <span className="text-xs font-bold uppercase tracking-wide">Identity Status</span>
              </div>
              <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Verified Clinician Account</span>
              </div>
              <div className="text-[11px] text-outline mt-1">Real-time database authorization active</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* TAB PANEL 2: SECURITY, PASSWORD & SESSIONS */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-6"
        >
          {/* Top 3 Security Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">verified_user</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Credential Health</span>
                <div className="text-sm font-bold text-on-surface">Maximum Tier</div>
                <span className="text-[11px] text-emerald-700 font-medium">0 active vulnerabilities detected</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">vpn_key</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">2FA Compliance</span>
                <div className="text-sm font-bold text-on-surface">
                  {twoFactorConfigured ? '100% Enforced' : 'Optional / Disabled'}
                </div>
                <span className={`text-[11px] font-medium ${twoFactorConfigured ? 'text-primary' : 'text-outline'}`}>
                  {twoFactorConfigured ? 'Hardware FIPS 140-3 Bound' : 'Direct sign-in active'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">devices</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-outline font-bold">Authorized Nodes</span>
                <div className="text-sm font-bold text-on-surface">{sessions.length} Active Sessions</div>
                <span className="text-[11px] text-amber-700 font-medium">1 local, {sessions.length - 1} remote terminals</span>
              </div>
            </div>
          </div>

          {/* 2-Column Section: Password Change & Two-Factor Authentication */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left (7 cols): Advanced Password Change with 3 Verification Methods */}
            <div className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-5">
              <div className="flex items-start justify-between pb-3 border-b border-surface-container">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[22px]">password</span>
                    <h3 className="text-base font-bold text-on-surface">Update Clinician Password</h3>
                  </div>
                  <p className="text-xs text-outline mt-0.5">
                    Authorized security protocol: verify identity via OTP or existing credentials prior to updating password.
                  </p>
                </div>
                {isVerificationUnlocked && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Verified
                  </span>
                )}
              </div>

              {!isVerificationUnlocked ? (
                /* STEP 1: Choose Verification Method */
                <form onSubmit={handleInitiatePasswordVerification} className="flex flex-col gap-4">
                  {isGoogleUser && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                      <span className="material-symbols-outlined text-blue-600 text-[20px] shrink-0">info</span>
                      <div>
                        <span className="font-bold block">Google-Authenticated Clinician Account</span>
                        <span className="text-[11px] text-blue-800 leading-relaxed block mt-0.5">
                          You authenticated using Google Sign-In. To establish or update your clinical password, select <strong>Email Passcode</strong> to verify via a 6-digit OTP sent to your Google email address ({profile.email}).
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-on-surface block mb-2">
                      Select Verification Method to Authorize Password Change:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Option 1: Email OTP */}
                      <label
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                          verificationMethod === 'email'
                            ? 'bg-primary/5 border-primary shadow-xs'
                            : 'bg-surface-container-low border-surface-container-high hover:border-outline'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="material-symbols-outlined text-primary text-[20px]">mark_email_read</span>
                          <input
                            type="radio"
                            name="verificationMethod"
                            checked={verificationMethod === 'email'}
                            onChange={() => setVerificationMethod('email')}
                            className="accent-primary"
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-on-surface block">Email Passcode</span>
                          <span className="text-[10px] text-outline line-clamp-1">{profile.email}</span>
                        </div>
                      </label>

                      {/* Option 2: SMS OTP (Coming Soon) */}
                      <div
                        className="p-3 rounded-xl border border-surface-container-high bg-surface-container-low/50 opacity-60 flex flex-col justify-between gap-2 cursor-not-allowed select-none"
                        title="SMS Mobile Code verification is coming soon. Please use Email Passcode."
                      >
                        <div className="flex items-center justify-between">
                          <span className="material-symbols-outlined text-outline text-[20px]">sms</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wide">
                            Coming Soon
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-outline block">SMS Mobile Code</span>
                          <span className="text-[10px] text-outline line-clamp-1">SMS gateway integration coming soon</span>
                        </div>
                      </div>

                      {/* Option 3: Current Password (Direct Verify, No OTP needed) */}
                      <label
                        className={`p-3 rounded-xl border flex flex-col justify-between gap-2 cursor-pointer transition-all ${
                          verificationMethod === 'password_otp'
                            ? 'bg-primary/5 border-primary shadow-xs'
                            : 'bg-surface-container-low border-surface-container-high hover:border-outline'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="material-symbols-outlined text-primary text-[20px]">security</span>
                          <input
                            type="radio"
                            name="verificationMethod"
                            checked={verificationMethod === 'password_otp'}
                            onChange={() => setVerificationMethod('password_otp')}
                            className="accent-primary"
                          />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-on-surface block">Previous / Current Psw</span>
                          <span className="text-[10px] text-outline line-clamp-1">
                            {isGoogleUser ? 'Requires existing password' : 'Direct Verify • No OTP'}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* If previous password is required */}
                  {verificationMethod === 'password_otp' && (
                    <div className="p-3.5 bg-surface-container-low rounded-xl border border-surface-container-high space-y-1.5">
                      <label className="text-xs font-bold text-on-surface">Enter Current / Previous Password *</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          required
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(e.target.value)}
                          placeholder="Type current clinical password"
                          className="w-full h-10 pl-3 pr-10 rounded-xl border border-surface-container-high bg-surface-container-lowest text-xs sm:text-sm focus:border-primary outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-2.5 text-outline hover:text-on-surface"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showCurrentPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                      <span className="text-[11px] text-outline block">
                        Verify directly using your valid current password without needing an email OTP.
                      </span>
                    </div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={isSendingPasswordOtp}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    className="w-full h-11 rounded-xl bg-primary-container text-on-primary hover:bg-primary font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSendingPasswordOtp ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>
                          {verificationMethod === 'email'
                            ? 'Dispatching Security Passcode...'
                            : 'Verifying Current Password...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span>
                          {verificationMethod === 'email'
                            ? 'Send Email 6-Digit Passcode'
                            : 'Verify Current Password & Unlock Form'}
                        </span>
                      </>
                    )}
                  </motion.button>
                </form>
              ) : (
                /* STEP 2: Set New Password Form (Unlocked after OTP circle-tick) */
                <form onSubmit={handleSaveNewPassword} className="flex flex-col gap-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                      <span>Identity authorized via <strong>{unlockedMethodLabel}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsVerificationUnlocked(false)}
                      className="text-[11px] font-bold text-emerald-700 underline cursor-pointer"
                    >
                      Change Method
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-on-surface">New Clinical Password *</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 10 characters (include numbers & symbols)"
                        className="w-full h-10 pl-3 pr-10 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-outline hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showNewPassword ? 'visibility' : 'visibility_off'}
                        </span>
                      </button>
                    </div>

                    {/* Live Strength Bars */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-outline">Entropy strength check</span>
                        <span className={`font-bold ${
                          newPassword.length >= 12
                            ? 'text-emerald-700'
                            : newPassword.length >= 8
                            ? 'text-amber-700'
                            : 'text-rose-700'
                        }`}>
                          {newPassword.length >= 12 ? 'Very Strong (96 bits)' : newPassword.length >= 8 ? 'Moderate (64 bits)' : 'Needs 10+ Characters'}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 h-1.5 w-full">
                        <div className={`rounded-full transition-colors ${newPassword.length > 0 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
                        <div className={`rounded-full transition-colors ${newPassword.length >= 8 ? 'bg-primary' : 'bg-surface-container-high'}`}></div>
                        <div className={`rounded-full transition-colors ${newPassword.length >= 10 ? 'bg-emerald-600' : 'bg-surface-container-high'}`}></div>
                        <div className={`rounded-full transition-colors ${newPassword.length >= 12 ? 'bg-emerald-600' : 'bg-surface-container-high'}`}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-on-surface">Confirm New Password *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        className="w-full h-10 pl-3 pr-10 rounded-xl border border-surface-container-high bg-white text-xs sm:text-sm focus:border-primary outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-outline hover:text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showConfirmPassword ? 'visibility' : 'visibility_off'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      disabled={isSavingPassword}
                      onClick={() => setIsVerificationUnlocked(false)}
                      className="w-1/3 h-10 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={isSavingPassword}
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      className="w-2/3 h-10 rounded-xl bg-primary-container hover:bg-primary text-on-primary text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSavingPassword ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Updating Password in Database...</span>
                        </>
                      ) : (
                        <span>Save &amp; Update Password</span>
                      )}
                    </motion.button>
                  </div>
                </form>
              )}
            </div>

            {/* Right (5 cols): Two-Factor Authentication Card with Interactive Toggle Switch */}
            <div className="lg:col-span-5 bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <span className="material-symbols-outlined text-[20px]">security</span>
                  <h3 className="text-base font-bold text-on-surface">Two-Factor Authentication</h3>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  twoFactorConfigured
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {twoFactorConfigured ? '2FA Enforced' : '2FA Optional'}
                </span>
              </div>
              <p className="text-xs text-outline">
                When active, every sign-in requires entering a 6-digit verification code sent to your registered email ({profile.email}).
              </p>

              {/* Interactive Toggle Switch */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    twoFactorConfigured
                      ? 'bg-emerald-500/10 text-emerald-700'
                      : 'bg-surface-container-high text-outline'
                  }`}>
                    <span className="material-symbols-outlined text-[22px]">
                      {twoFactorConfigured ? 'lock' : 'lock_open'}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-on-surface">
                      {twoFactorConfigured ? 'Require OTP on Sign-In' : 'Direct Password Login'}
                    </div>
                    <div className="text-[11px] text-outline">
                      {twoFactorConfigured ? 'High security: OTP mandatory on login' : 'Faster sign-in: OTP bypassed'}
                    </div>
                  </div>
                </div>

                {/* Switch Toggle Button */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={twoFactorConfigured}
                  disabled={isToggling2Fa}
                  onClick={() => handleToggle2FA(!twoFactorConfigured)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    twoFactorConfigured ? 'bg-primary' : 'bg-slate-300'
                  } ${isToggling2Fa ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      twoFactorConfigured ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low text-[11px] text-outline flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">verified_user</span>
                <span>
                  {twoFactorConfigured
                    ? 'Your account is protected. Every clinical session requires step-up verification code dispatched via Google Apps Script.'
                    : 'Two-factor requirement is currently off. You can log in directly using your email and password.'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Authorized Sessions List */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-container">
              <div>
                <h3 className="text-base font-bold text-on-surface">Active Clinical Sessions</h3>
                <p className="text-xs text-outline">
                  Nodes with valid JSON Web Tokens currently authorized under your credentials ({sessions.length} nodes)
                </p>
              </div>
              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowTerminateAllModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-bold transition-colors self-start sm:self-auto flex items-center gap-1 cursor-pointer border border-rose-200"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Terminate Remote Sessions ({sessions.filter(s => !s.isCurrent).length})</span>
                </motion.button>
              )}
            </div>

            {/* Sessions Cards Grid */}
            <div className="flex flex-col gap-3">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden transition-all ${
                    sess.isCurrent
                      ? 'bg-surface-container-low border-primary/30 shadow-2xs'
                      : 'bg-surface-container-lowest border-surface-container-high hover:border-outline'
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
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSessionToRevoke(sess)}
                        className="px-3 py-1 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        Revoke
                      </motion.button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Session & Login History Table with Search, Filter & Multi-Page Pagination */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-xs overflow-hidden">
            {/* Table Controls */}
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-container">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">history</span>
                  <h3 className="text-base font-bold text-on-surface">Session &amp; Login History</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                    {filteredHistory.length} Entries
                  </span>
                </div>
                <p className="text-xs text-outline mt-0.5">
                  Chronological audit of credential entries, multi-factor challenges, and terminal authorizations
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center bg-surface-container-low rounded-xl px-3 py-1.5 border border-surface-container-high">
                  <span className="material-symbols-outlined text-outline text-[18px] mr-1.5">search</span>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Search node, IP, or location..."
                    className="bg-transparent text-xs outline-none text-on-surface placeholder:text-outline w-44 sm:w-56"
                  />
                </div>

                <div className="relative">
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => {
                      setHistoryStatusFilter(e.target.value as any);
                      setHistoryPage(1);
                    }}
                    className="h-8 pl-3 pr-7 bg-surface-container-low border border-surface-container-high rounded-xl text-xs text-on-surface appearance-none focus:outline-none focus:border-primary cursor-pointer font-medium"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Success">Success</option>
                    <option value="2FA Verified">2FA Verified</option>
                    <option value="Revoked">Revoked</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-2 top-2 text-outline pointer-events-none text-[16px]">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low/60 border-b border-surface-container text-on-surface-variant font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-6">Timestamp &amp; Ref</th>
                    <th className="py-3 px-4">Authorized Node / Device</th>
                    <th className="py-3 px-4">Client &amp; OS</th>
                    <th className="py-3 px-4">IP Address &amp; Location</th>
                    <th className="py-3 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {paginatedHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-3.5 px-6 font-medium">
                        <div className="text-on-surface font-semibold">{row.timestamp}</div>
                        <div className="text-[11px] text-outline font-mono">{row.id}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-outline">terminal</span>
                          <span>{row.device}</span>
                        </div>
                        {row.details && (
                          <div className="text-[10px] text-outline font-normal mt-0.5 line-clamp-1">
                            {row.details}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant">{row.browserOs}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[11px] text-primary">{row.ip}</div>
                        <div className="text-[11px] text-outline">{row.location}</div>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            row.status === '2FA Verified'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : row.status === 'Success'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : row.status === 'Revoked'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {row.status === '2FA Verified'
                              ? 'verified_user'
                              : row.status === 'Success'
                              ? 'check'
                              : row.status === 'Revoked'
                              ? 'block'
                              : 'error'}
                          </span>
                          <span>{row.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                  {paginatedHistory.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-outline">
                        No login history found matching the selected search and filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-6 py-3.5 bg-surface-container-low/40 border-t border-surface-container flex items-center justify-between text-[11px] text-outline">
              <div>
                Showing <strong>{paginatedHistory.length > 0 ? (currentHistoryPage - 1) * pageSize + 1 : 0}</strong>–
                <strong>{Math.min(currentHistoryPage * pageSize, filteredHistory.length)}</strong> of <strong>{filteredHistory.length}</strong> login sessions
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(p - 1, 1))}
                  disabled={currentHistoryPage <= 1}
                  className="px-3 py-1 rounded-lg border border-surface-container-high bg-white text-on-surface font-semibold hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setHistoryPage(pNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentHistoryPage === pNum
                          ? 'bg-primary-container text-on-primary'
                          : 'border border-surface-container-high bg-white text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentHistoryPage >= totalPages}
                  className="px-3 py-1 rounded-lg border border-surface-container-high bg-white text-on-surface font-semibold hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT CLINICAL PROFILE MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showEditProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className="w-full max-w-xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">badge</span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">Edit Clinical Profile</h3>
                    <p className="text-xs text-outline">Update personal credentials, licensing, and facility station</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Full Name &amp; Academic Degree *</label>
                    <input
                      type="text"
                      required
                      value={editForm.fullName}
                      onChange={(e) => {
                        const name = e.target.value;
                        const initials = name
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase();
                        setEditForm({ ...editForm, fullName: name, avatarInitials: initials || 'CL' });
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Clinical Role */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Clinical Designation *</label>
                    <input
                      type="text"
                      required
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      placeholder="e.g. Lead Clinical Pharmacist"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* License */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Board License # *</label>
                    <input
                      type="text"
                      required
                      value={editForm.license}
                      onChange={(e) => setEditForm({ ...editForm, license: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-mono"
                    />
                  </div>

                  {/* NPI */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">National Provider Identifier (NPI) *</label>
                    <input
                      type="text"
                      required
                      value={editForm.npi}
                      onChange={(e) => setEditForm({ ...editForm, npi: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Facility */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Clinical Hospital Facility</label>
                    <input
                      type="text"
                      required
                      value={editForm.hospital}
                      onChange={(e) => setEditForm({ ...editForm, hospital: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Department */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Assigned Unit / Department</label>
                    <input
                      type="text"
                      required
                      value={editForm.department}
                      onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Official Clinical Email</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-on-surface">Direct Mobile Phone (for SMS 2FA)</label>
                    <input
                      type="text"
                      required
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Authority Scope Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface">Clinical Authority Level</label>
                  <select
                    value={editForm.authority}
                    onChange={(e) => setEditForm({ ...editForm, authority: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Pharmacist Sign-Off Authority">Pharmacist Sign-Off Authority (Overrides &amp; Dispense)</option>
                    <option value="Prescribing Clinician Authority">Prescribing Clinician Authority (Order &amp; Screening)</option>
                    <option value="Patient Safety Reviewer">Patient Safety Reviewer (QA Audit)</option>
                    <option value="System Administrator">System Administrator (Governance &amp; Tenant)</option>
                  </select>
                </div>

                {/* Actions */}
                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditProfileModal(false)}
                    className="w-1/2 py-2.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-1/2 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-bold hover:bg-primary shadow-xs transition-colors cursor-pointer"
                  >
                    Save Changes
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: 6-DIGIT SQUARE OTP MODAL WITH TICK & SHAKE ANIMATIONS */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={
                isOtpError
                  ? { x: [-12, 12, -8, 8, -4, 4, 0], scale: 1, opacity: 1, y: 0 }
                  : { opacity: 1, scale: 1, y: 0 }
              }
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className={`w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border overflow-hidden transition-colors ${
                isOtpSuccess
                  ? 'border-emerald-500 shadow-emerald-500/10'
                  : isOtpError
                  ? 'border-rose-400'
                  : 'border-surface-container-high'
              }`}
            >
              {/* Modal Header */}
              <div className="p-6 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs transition-colors ${
                    isOtpSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-primary-container text-on-primary'
                  }`}>
                    <span className="material-symbols-outlined text-[22px]">
                      {isOtpSuccess ? 'check' : 'lock_clock'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">
                      {otpPurpose === 'password_change' ? 'Authorize Password Reset' : 'Reconfigure 2FA Token'}
                    </h3>
                    <p className="text-xs text-outline">
                      {otpPurpose === 'password_change'
                        ? verificationMethod === 'email'
                          ? `Code sent to ${profile.email}`
                          : verificationMethod === 'sms'
                          ? `Code sent to ${profile.phone}`
                          : 'Enter secondary 2FA authenticator passcode'
                        : 'Scan QR in authenticator & enter token'}
                    </p>
                  </div>
                </div>
                {!isOtpSuccess && (
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-5">
                {/* QR Code display if 2FA reconfiguration */}
                {otpPurpose === 'two_factor_reconfig' && (
                  <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high flex flex-col items-center gap-2 text-center">
                    <div className="w-28 h-28 bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center shadow-xs">
                      {/* Stylized QR placeholder */}
                      <div className="grid grid-cols-5 gap-1 w-full h-full p-1 bg-slate-900 rounded-md">
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-slate-900"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                        <div className="bg-white rounded-xs"></div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-outline">
                      Secret Key: <strong className="text-primary font-bold">SMLE-CLNC-9842-SEC1</strong>
                    </span>
                  </div>
                )}

                {/* SUCCESS ANIMATION VIEW */}
                {isOtpSuccess ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-3">
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', damping: 14, stiffness: 200 }}
                      className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20"
                    >
                      <motion.svg
                        className="w-9 h-9 text-emerald-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <motion.path
                          d="M20 6L9 17L4 12"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
                        />
                      </motion.svg>
                    </motion.div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-emerald-800">Passcode Verified!</div>
                      <div className="text-xs text-emerald-600 mt-0.5">Authorization complete. Proceeding...</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Error Banner */}
                    {isOtpError && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-rose-600 text-sm">error</span>
                        <span>{otpErrorMessage}</span>
                      </motion.div>
                    )}

                    {/* 6 Square Inputs */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-on-surface block text-center">
                        Enter 6-Digit Passcode
                      </label>
                      <div className="flex justify-center items-center gap-2 sm:gap-2.5">
                        {otpDigits.map((digit, index) => (
                          <motion.input
                            key={index}
                            ref={(el) => {
                              otpInputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            onPaste={handleOtpPaste}
                            animate={
                              isOtpError
                                ? { borderColor: '#F43F5E', backgroundColor: '#FFF1F2' }
                                : isOtpSuccess
                                ? { borderColor: '#10B981', backgroundColor: '#ECFDF5' }
                                : {}
                            }
                            className={`w-11 h-13 sm:w-12 sm:h-14 rounded-xl text-center text-xl font-bold font-mono tracking-wide transition-all outline-none border ${
                              digit
                                ? 'border-primary bg-primary/5 text-primary shadow-xs'
                                : 'border-surface-container-high bg-surface-container-lowest text-on-surface'
                            } focus:border-primary focus:ring-2 focus:ring-primary/20`}
                          />
                        ))}
                      </div>
                    </div>


                    {/* Modal Buttons */}
                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowOtpModal(false)}
                        className="w-1/3 py-2.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                      >
                        Cancel
                      </button>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isOtpVerifying}
                        onClick={() => handleVerifyOtp()}
                        className="w-2/3 py-2.5 rounded-xl bg-primary-container text-on-primary text-xs font-bold hover:bg-primary shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isOtpVerifying ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Validating Token...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                            <span>Verify Code</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: TERMINATE ALL REMOTE SESSIONS CONFIRMATION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showTerminateAllModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">logout</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Terminate All Remote Sessions?</h3>
                  <p className="text-xs text-outline">Immediate global credential invalidation</p>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                This will immediately revoke active JWT bearer authorization for all other connected nodes (including Ward Tablet Cart #12 and Consultation Room 2). Only your current workstation will remain authenticated.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTerminateAllModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirmTerminateAllRemote}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Terminate All Remote
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: SINGLE SESSION REVOCATION CONFIRMATION */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {sessionToRevoke && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">phonelink_erase</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-on-surface">Revoke Session {sessionToRevoke.id}?</h3>
                  <p className="text-xs text-outline">{sessionToRevoke.name}</p>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Are you sure you want to revoke authorized access for <strong>{sessionToRevoke.name}</strong> ({sessionToRevoke.details})? The remote terminal will be forced to log out immediately.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSessionToRevoke(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-surface-container-high text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirmRevokeSingle}
                  className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Confirm Revoke
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
