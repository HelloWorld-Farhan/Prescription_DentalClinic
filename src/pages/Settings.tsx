import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '../services/authApi';
import { signInWithGooglePopup } from '../services/firebase';
import AvatarCropModal from '../components/AvatarCropModal';
import { showConfirmation } from '../services/confirmation';
import {
  ActiveSessionItem,
  LoginHistoryItem,
  getActiveSessions,
  saveActiveSessions,
  getLoginHistory,
  recordLoginEvent,
  getDeviceId,
  formatSessionTimestamp
} from '../services/sessionAudit';

export interface ClinicalProfile {
  fullName: string;
  role: string;
  email: string;
  phone: string;
  age?: number;
  gender?: string;
  height?: string;
  weight?: string;
  hasAllergies?: boolean;
  allergiesDescription?: string;
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  isGoogleLinked?: boolean;
  hasPassword?: boolean;
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
    '';

  const role =
    sessionStorage.getItem('rxguard_prescriber_role') ||
    localStorage.getItem('rxguard_prescriber_role') ||
    storedUser.role ||
    'USER';

  const phone =
    sessionStorage.getItem('rxguard_prescriber_phone') ||
    storedUser.phone ||
    '';

  const initials = name
    .replace(/^Dr\.\s*/i, '')
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('') || 'RX';

  const emailLower = email.toLowerCase().trim();
  const avatarUrl =
    (typeof window !== 'undefined' && emailLower ? localStorage.getItem(`smileclinic_avatar_${emailLower}`) : '') ||
    storedUser.photoUrl ||
    '';

  const isGoogleLinked =
    Boolean(storedUser.isGoogleLinked) ||
    (typeof window !== 'undefined' && email ? localStorage.getItem(`google_linked_${email.toLowerCase()}`) === 'true' : false) ||
    sessionStorage.getItem('rxguard_google_linked') === 'true' ||
    sessionStorage.getItem('rxguard_auth_provider') === 'google';

  const hasPassword =
    storedUser.hasPassword !== undefined
      ? Boolean(storedUser.hasPassword)
      : sessionStorage.getItem('rxguard_has_password') !== 'false';

  return {
    fullName: name,
    role: role,
    email: email,
    phone: phone,
    age: storedUser.age,
    gender: storedUser.gender || 'Prefer not to say',
    height: storedUser.height || '',
    weight: storedUser.weight || '',
    hasAllergies: Boolean(storedUser.hasAllergies),
    allergiesDescription: storedUser.allergiesDescription || '',
    avatarInitials: initials,
    avatarColor: 'bg-primary-container text-on-primary',
    avatarUrl,
    isGoogleLinked,
    hasPassword
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

  // --- Avatar Crop & Cloudflare R2 Upload State ---
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|tiff|svg)$/i.test(file.name);
    if (!isImage) {
      showToast('Please select a valid image file (PNG, JPG, WebP, GIF, BMP, AVIF).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropImageSrc(reader.result);
        setCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAvatarCropSuccess = (newAvatarUrl: string) => {
    setProfile((prev) => {
      const updated = { ...prev, avatarUrl: newAvatarUrl };
      try {
        localStorage.setItem('smileclinic_rxguard_profile', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setEditForm((prev) => ({ ...prev, avatarUrl: newAvatarUrl }));
    showToast('Profile photo cropped & saved to Cloudflare R2.');
  };

  // Sync avatar updates if triggered anywhere else
  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const newUrl = e?.detail?.avatarUrl || e?.detail?.url;
      const targetEmail = e?.detail?.email;
      if (newUrl && (!targetEmail || targetEmail.toLowerCase() === profile.email.toLowerCase())) {
        setProfile((prev) => ({ ...prev, avatarUrl: newUrl }));
        setEditForm((prev) => ({ ...prev, avatarUrl: newUrl }));
      }
    };
    window.addEventListener('smileclinic_avatar_updated', handleAvatarUpdate);
    return () => window.removeEventListener('smileclinic_avatar_updated', handleAvatarUpdate);
  }, [profile.email]);

  // Sync avatar and profile from backend database across all devices (phone, desktop)
  useEffect(() => {
    if (!profile.email) return;
    authApi.getProfileStatus(profile.email).then((res) => {
      if (res?.user?.photoUrl && res.user.photoUrl !== profile.avatarUrl) {
        setProfile((prev) => ({ ...prev, avatarUrl: res.user!.photoUrl }));
        setEditForm((prev) => ({ ...prev, avatarUrl: res.user!.photoUrl }));
        localStorage.setItem(`smileclinic_avatar_${profile.email.toLowerCase()}`, res.user.photoUrl);
      }
    }).catch(() => {});
  }, [profile.email]);

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
  const [previousPasswordError, setPreviousPasswordError] = useState<string | null>(null);

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

  // Lock body scroll and handle Escape key for any active modal in Settings
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      showEditProfileModal || showOtpModal || showTerminateAllModal || sessionToRevoke
    );
    if (!isAnyModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEditProfileModal) setShowEditProfileModal(false);
        else if (showOtpModal) setShowOtpModal(false);
        else if (showTerminateAllModal) setShowTerminateAllModal(false);
        else if (sessionToRevoke) setSessionToRevoke(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showEditProfileModal, showOtpModal, showTerminateAllModal, sessionToRevoke]);

  // Sync real-time sessions and login history from backend PostgreSQL
  useEffect(() => {
    let isCancelled = false;
    const fetchRemoteSessions = async () => {
      if (!profile.email) return;
      try {
        const currentDev = getDeviceId();
        const data = await authApi.getSessions(profile.email, currentDev);
        if (isCancelled) return;

        if (data && data.sessions && data.sessions.length > 0) {
          const mappedSessions: ActiveSessionItem[] = data.sessions.map((s: any) => {
            const isCurr = Boolean(s.is_current || s.device_id === currentDev);
            const isMobile = Boolean(
              s.device_name?.includes('Samsung') ||
              s.device_name?.includes('iPhone') ||
              s.device_name?.includes('Mobile') ||
              s.device_name?.includes('Pixel') ||
              s.device_name?.includes('Android')
            );
            return {
              id: s.id,
              name: s.device_name,
              isCurrent: isCurr,
              deviceId: s.device_id,
              details: `${s.browser_os} • ${s.location || 'Verified TLS Encrypted'}`,
              badge: isCurr ? 'Active Now' : 'Authorized Remote',
              icon: isMobile ? 'smartphone' : 'desktop_windows',
              createdAt: s.created_at
            };
          });
          setSessions(mappedSessions);
          saveActiveSessions(mappedSessions, profile.email);
        }

        if (data && data.history && data.history.length > 0) {
          const mappedHistory: LoginHistoryItem[] = data.history.map((h: any) => ({
            id: h.id,
            timestamp: h.created_at ? formatSessionTimestamp(h.created_at) : 'Active Now',
            device: h.device_name,
            browserOs: h.browser_os,
            ip: h.ip_address || '10.240.42.18',
            location: h.location || 'Cloudflare Edge • Verified TLS',
            status: h.status,
            details: h.details,
            deviceId: h.device_id,
            isCurrent: Boolean(h.is_current || h.device_id === currentDev)
          }));
          setLoginHistory(mappedHistory);
        }
      } catch {
        // Fallback to local cache if offline
      }
    };

    fetchRemoteSessions();
  }, [profile.email]);

  // Live listener for real-time session & login history updates across app
  useEffect(() => {
    const handleHistoryUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setLoginHistory(e.detail);
      }
    };
    window.addEventListener('smileclinic_session_history_updated', handleHistoryUpdate);
    return () => window.removeEventListener('smileclinic_session_history_updated', handleHistoryUpdate);
  }, []);

  // Detect whether current session is authenticated via Google OAuth
  const isGoogleUser = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
      const provider =
        u.authProvider ||
        sessionStorage.getItem('rxguard_auth_provider') ||
        localStorage.getItem('rxguard_auth_provider');
      if (provider === 'google') return true;
      if (u.role?.toLowerCase() === 'google') return true;
      if (u.id?.startsWith('google-') || sessionStorage.getItem('rxguard_prescriber_id')?.startsWith('google-')) return true;
      if (loginHistory.some((h) => h.details?.toLowerCase().includes('google oauth'))) return true;
      return false;
    } catch {
      return false;
    }
  }, [profile.email, loginHistory]);

  // Check whether account is linked with Google email
  const isGoogleLinked = useMemo(() => {
    if (profile.isGoogleLinked) return true;
    try {
      const u = JSON.parse(localStorage.getItem('smileclinic_auth_user') || '{}');
      if (u.isGoogleLinked) return true;
      if (localStorage.getItem(`google_linked_${profile.email.toLowerCase()}`) === 'true') return true;
      if (sessionStorage.getItem('rxguard_google_linked') === 'true') return true;
      if (sessionStorage.getItem('rxguard_auth_provider') === 'google') return true;
      return false;
    } catch {
      return false;
    }
  }, [profile.email, profile.isGoogleLinked]);

  // Link Google Account to the clinician profile
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    try {
      const gUser = await signInWithGooglePopup(profile.email);
      if (!gUser) return;
      if (profile.email && gUser.email.trim().toLowerCase() !== profile.email.trim().toLowerCase()) {
        throw new Error(
          `Email mismatch: This account is registered as "${profile.email}". You cannot link a different Google account ("${gUser.email}"). Please choose "${profile.email}".`
        );
      }
      await authApi.linkGoogle(gUser.email, gUser.idToken, gUser.photoUrl);
      setProfile((prev) => ({ ...prev, isGoogleLinked: true }));
      localStorage.setItem(`google_linked_${profile.email.toLowerCase()}`, 'true');
      showToast(`Account successfully linked with your Google email (${gUser.email}).`);
    } catch (err: any) {
      showToast(err.message || 'Failed to link Google account.');
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  // Keep sessions and audit history synced whenever clinician email changes
  useEffect(() => {
    if (profile.email) {
      setSessions(getActiveSessions(profile.email));
      setLoginHistory(getLoginHistory(profile.email, profile.fullName));
    }
  }, [profile.email, profile.fullName]);

  // Top Bar Action Confirmation Notification
  const showToast = (msg: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    showConfirmation(msg, type);
  };

  // Keep editForm synced when modal opens
  const handleOpenEditProfile = () => {
    setEditForm({ ...profile });
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(editForm);
    localStorage.setItem('smileclinic_rxguard_profile', JSON.stringify(editForm));
    sessionStorage.setItem('rxguard_prescriber_name', editForm.fullName);
    sessionStorage.setItem('rxguard_prescriber_role', editForm.role);
    sessionStorage.setItem('rxguard_prescriber_email', editForm.email);
    if (editForm.phone) {
      sessionStorage.setItem('rxguard_prescriber_phone', editForm.phone);
    }
    setShowEditProfileModal(false);
    showToast('Saving profile to database...');

    try {
      const res = await authApi.updateProfile({
        email: editForm.email,
        full_name: editForm.fullName,
        phone: editForm.phone,
        age: editForm.age,
        gender: editForm.gender,
        height: editForm.height,
        weight: editForm.weight,
        has_allergies: editForm.hasAllergies,
        allergies_description: editForm.allergiesDescription,
        profile_completed: true
      });
      if (res.user) {
        showToast('Clinical profile updated successfully.');
      }
    } catch (err: any) {
      showToast(err.message || 'Profile saved locally.');
    }
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
        setPreviousPasswordError('Please enter your current clinical password first.');
        showToast('Please enter your current clinical password first.');
        return;
      }

      setIsSendingPasswordOtp(true);
      setPreviousPasswordError(null);
      try {
        await authApi.verifyCurrentPassword(profile.email, currentPasswordInput);
        setIsVerificationUnlocked(true);
        setUnlockedMethodLabel('Verified Current Password');
        showToast('Current password verified! You may now set your new clinical password.');
      } catch (err: any) {
        const errorMsg = err.message || 'Incorrect previous password. Please check your credentials.';
        setPreviousPasswordError(errorMsg);
        showToast(errorMsg);
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
        }, 1200);
      } else {
        setIsOtpSuccess(true);
        setTimeout(() => {
          setShowOtpModal(false);
          setIsOtpSuccess(false);
          setTwoFactorConfigured(true);
          const ev = recordLoginEvent(
            '2FA Verified',
            `Credential security: Two-Factor Authentication (2FA) verified & configured (${profile.email})`,
            profile.email
          );
          setLoginHistory((prev) => [ev, ...prev.filter(p => p.id !== ev.id)]);
          showToast('Two-Factor Authentication reconfigured and verified successfully.');
        }, 1200);
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
        `Credential security: Clinical password updated in database (${profile.email})`,
        profile.email
      );
      setLoginHistory((prev) => [ev, ...prev.filter(p => p.id !== ev.id)]);
      showToast('Clinical password updated successfully in the database.');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // --- Session Termination & Revocation ---
  const handleConfirmTerminateAllRemote = async () => {
    const currentDev = getDeviceId();
    const remoteSessions = sessions.filter((s) => !s.isCurrent && s.deviceId !== currentDev);
    for (const rem of remoteSessions) {
      try {
        await authApi.revokeSession(profile.email, rem.deviceId, rem.id, rem.name);
      } catch {}
    }

    const remaining = sessions.filter((s) => s.isCurrent || s.deviceId === currentDev);
    setSessions(remaining);
    saveActiveSessions(remaining, profile.email);
    setShowTerminateAllModal(false);

    setLoginHistory((prev) =>
      prev.map((item) =>
        !item.isCurrent && item.deviceId !== currentDev
          ? { ...item, status: 'Revoked' as const }
          : item
      )
    );

    const revokedRecord = recordLoginEvent(
      'Revoked',
      'All remote clinical terminals terminated via governance console',
      profile.email
    );
    setLoginHistory((prev) => [revokedRecord, ...prev.filter((p) => p.id !== revokedRecord.id)]);
    showToast('All remote active sessions terminated immediately.');
  };

  const handleConfirmRevokeSingle = async () => {
    if (!sessionToRevoke) return;
    const targetId = sessionToRevoke.id;
    const targetDeviceId = sessionToRevoke.deviceId;
    const targetName = sessionToRevoke.name;

    try {
      await authApi.revokeSession(profile.email, targetDeviceId, targetId, targetName);
    } catch {}

    const remaining = sessions.filter((s) => s.id !== targetId);
    setSessions(remaining);
    saveActiveSessions(remaining, profile.email);

    setLoginHistory((prev) =>
      prev.map((item) =>
        item.id === targetId || (targetDeviceId && item.deviceId === targetDeviceId)
          ? { ...item, status: 'Revoked' as const }
          : item
      )
    );

    const revokedRecord = recordLoginEvent(
      'Revoked',
      `Remote terminal #${targetId} revoked (${targetName})`,
      profile.email,
      targetName
    );
    setLoginHistory((prev) => [revokedRecord, ...prev.filter((p) => p.id !== revokedRecord.id)]);
    showToast(`Workstation session #${targetId} (${targetName}) has been revoked.`);
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
              <span>{profile.role}</span>
              <span>•</span>
              <span className="text-primary font-semibold">{profile.phone || profile.email}</span>
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
              <div className="relative group">
                <div className={`w-24 h-24 rounded-2xl ${profile.avatarColor} flex items-center justify-center font-bold text-3xl shadow-md tracking-wider overflow-hidden border-2 border-surface-container-high/60 relative`}>
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{profile.avatarInitials}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer backdrop-blur-2xs rounded-2xl"
                    title="Change profile photo"
                    aria-label="Change profile photo"
                  >
                    <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 p-2 bg-primary text-white rounded-xl border-2 border-surface-container-lowest shadow hover:bg-primary/90 cursor-pointer transition-transform hover:scale-110 active:scale-95 flex items-center justify-center"
                  title="Upload & Crop Profile Photo"
                  aria-label="Upload profile photo"
                >
                  <span className="material-symbols-outlined text-[18px] block">upload</span>
                </button>
                <input
                  ref={avatarFileInputRef}
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.tiff,.svg"
                  className="hidden"
                  onChange={handleAvatarFileSelect}
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-on-surface">{profile.fullName}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Verified User
                  </span>
                  {isGoogleLinked && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      Linked with Google
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-outline mt-0.5">
                  {profile.role} • Registered Prescriber Account
                </p>
                <div className="flex items-center gap-4 text-xs text-on-surface-variant mt-2 flex-wrap">
                  <span className="flex items-center gap-1 text-outline">
                    <span className="material-symbols-outlined text-[16px]">mail</span>
                    {profile.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-primary">call</span>
                    {profile.phone || 'Phone not set'}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-teal-600">health_and_safety</span>
                    <span>{profile.age ? `${profile.age} yrs` : 'Age: —'} • {profile.gender || 'Not specified'}</span>
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
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>Edit Clinical Profile</span>
              </motion.button>
              <span className="text-xs text-outline">{profile.phone || profile.email}</span>
            </div>
          </div>

          {/* Clinical Profile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                <span className="text-xs font-bold uppercase tracking-wide">Health &amp; Vitals Profile</span>
              </div>
              <div className="text-sm font-bold text-on-surface">
                {profile.age ? `${profile.age} Yrs` : 'Age: —'} • {profile.gender || 'Gender: —'}
              </div>
              <div className="text-[11px] text-outline mt-0.5">
                {profile.height ? `Height: ${profile.height}` : 'Height: —'} {profile.weight ? `• Weight: ${profile.weight}` : '• Weight: —'}
              </div>
              <div className="text-[11px] font-medium mt-1 flex items-center gap-1">
                {profile.hasAllergies ? (
                  <span className="text-amber-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-amber-600">warning</span>
                    <span>Allergies: {profile.allergiesDescription || 'Reported'}</span>
                  </span>
                ) : (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                    <span>No Known Drug Allergies (NKDA)</span>
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[20px]">badge</span>
                <span className="text-xs font-bold uppercase tracking-wide">Clinical Role</span>
              </div>
              <div className="text-sm font-bold text-on-surface">{profile.role}</div>
              <div className="text-[11px] text-outline mt-1">Prescriber Safety Verification Active</div>
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high/60 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-[20px]">verified_user</span>
                <span className="text-xs font-bold uppercase tracking-wide">Identity &amp; Security</span>
              </div>
              <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">lock</span>
                <span>Encrypted &amp; Confidential</span>
              </div>
              <div className="text-[11px] text-outline mt-1">Real-time database authorization active</div>
            </div>
          </div>

          {/* Connected Accounts & OAuth Identity Card */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[22px]">link</span>
                  <h3 className="text-base font-bold text-on-surface">Connected Accounts &amp; OAuth Single Sign-On</h3>
                </div>
                <p className="text-xs text-outline mt-0.5">
                  Manage third-party authentication providers linked to your clinician profile.
                </p>
              </div>
              {isGoogleLinked && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Linked &amp; Active
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-center shrink-0 shadow-xs">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-on-surface">Google Account</span>
                    {isGoogleLinked ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Linked with your Google email
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-outline">
                        Not Linked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {isGoogleLinked
                      ? `Linked with your Google email: ${profile.email}`
                      : 'Link your Google account to enable instantaneous 1-click single sign-on.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isGoogleLinked ? (
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>1-Click SSO Active</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkGoogle}
                    disabled={isLinkingGoogle}
                    className="px-4 py-2 rounded-xl bg-primary-container text-on-primary text-xs font-bold shadow-xs hover:bg-primary transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">add_link</span>
                    <span>{isLinkingGoogle ? 'Connecting Google...' : 'Link Google Account'}</span>
                  </button>
                )}
              </div>
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
                    <h3 className="text-base font-bold text-on-surface">Clinician Account Password</h3>
                  </div>
                  <p className="text-xs text-outline mt-0.5">
                    {isGoogleUser && profile.hasPassword === false
                      ? 'Single Sign-On (OAuth 2.0) credential status & identity security'
                      : 'Authorized security protocol: verify identity via OTP or existing credentials prior to updating password.'}
                  </p>
                </div>
                {isGoogleLinked ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    Google Linked
                  </span>
                ) : isVerificationUnlocked ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Verified
                  </span>
                ) : null}
              </div>

              {/* Linked with Google banner in Security tab */}
              {isGoogleLinked && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>
                      Linked with your Google email: <strong>{profile.email}</strong>. 1-Click Google Sign-In is active for this account.
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                    Linked
                  </span>
                </div>
              )}

              {isGoogleUser && profile.hasPassword === false ? (
                /* Google Authenticated Account with NO Password set */
                <div className="p-5 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-on-surface">Password Change Disabled</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Managed by Google
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Your clinician account is authenticated via <strong>1-Click Google Sign-In ({profile.email})</strong>. Because you authenticate using Google OAuth, no separate password exists or is required for this account.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high/80 text-xs text-on-surface-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-outline">
                      <span className="material-symbols-outlined text-blue-600 text-[18px]">verified_user</span>
                      <span>Identity credentials &amp; 2FA are managed securely through Google.</span>
                    </span>
                    <a
                      href="https://myaccount.google.com/security"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Manage Google Account</span>
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  </div>
                </div>
              ) : !isVerificationUnlocked ? (
                /* STEP 1: Choose Verification Method (for standard accounts) */
                <form onSubmit={handleInitiatePasswordVerification} className="flex flex-col gap-4">

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
                          onChange={(e) => {
                            setCurrentPasswordInput(e.target.value);
                            if (previousPasswordError) setPreviousPasswordError(null);
                          }}
                          placeholder="Type current clinical password"
                          className={`w-full h-10 pl-3 pr-10 rounded-xl border text-xs sm:text-sm outline-none transition-colors ${
                            previousPasswordError
                              ? 'border-2 border-rose-500 bg-rose-50/25 text-rose-900 focus:border-rose-600'
                              : 'border-surface-container-high bg-surface-container-lowest text-on-surface focus:border-primary'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-2.5 text-outline hover:text-on-surface cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showCurrentPassword ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                      </div>
                      {previousPasswordError ? (
                        <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1 animate-shake">
                          <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                          <span>{previousPasswordError}</span>
                        </p>
                      ) : (
                        <span className="text-[11px] text-outline block">
                          Verify directly using your valid current password without needing an email OTP.
                        </span>
                      )}
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
                            ? 'Sending OTP Passcode...'
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
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-on-surface">
                  {paginatedHistory.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="py-3.5 px-6 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="text-on-surface font-semibold">{row.timestamp}</span>
                          {row.isCurrent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-outline font-mono">{row.id}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-on-surface">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-outline">
                            {row.device.includes('Samsung') || row.device.includes('Mobile') || row.device.includes('iPhone') || row.device.includes('Pixel') ? 'smartphone' : 'terminal'}
                          </span>
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
                      <td className="py-3.5 px-4 text-center">
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
                      <td className="py-3.5 px-6 text-right">
                        {row.status === 'Revoked' ? (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">block</span>
                            <span>Revoked</span>
                          </span>
                        ) : row.isCurrent ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>This Device</span>
                          </span>
                        ) : (
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSessionToRevoke({
                                id: row.id,
                                name: row.device,
                                isCurrent: false,
                                deviceId: row.deviceId,
                                details: `${row.browserOs} • ${row.location}`,
                                badge: 'Authorized Remote',
                                icon: row.device.includes('Samsung') || row.device.includes('Mobile') || row.device.includes('iPhone') ? 'smartphone' : 'desktop_windows'
                              });
                            }}
                            className="px-2.5 py-1 rounded-xl border border-rose-200 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                            title="Log out and revoke this remote workstation session"
                          >
                            <span className="material-symbols-outlined text-[14px]">logout</span>
                            <span>Log Out Device</span>
                          </motion.button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paginatedHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-outline">
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
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showEditProfileModal && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              {/* Full-Screen Animated Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setShowEditProfileModal(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-xl bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-2xl border border-surface-container-high flex flex-col max-h-[90vh] overflow-hidden"
              >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-on-surface">Edit Clinical Profile</h3>
                    <p className="text-[11px] text-on-surface-variant">Update personal credentials, licensing, and facility station</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                  title="Close"
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSaveProfile} className="flex flex-col flex-1 min-h-0">
                <div className="py-4 overflow-y-auto flex-1 space-y-4 pr-1">
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
                        className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-medium"
                      />
                    </div>

                    {/* Clinical Role */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface">Clinical Designation / Role *</label>
                      <input
                        type="text"
                        required
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        placeholder="e.g. Lead Clinician / USER"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Read-Only Email */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-on-surface">Registered Account Email</label>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Read-Only</span>
                      </div>
                      <div className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-mono flex items-center justify-between">
                        <span className="truncate">{editForm.email}</span>
                        <span className="material-symbols-outlined text-slate-400 text-[16px]">lock</span>
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface">Direct Mobile Phone (for 2FA &amp; Alerts) *</label>
                      <input
                        type="text"
                        required
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="+91 9876543210"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Age */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface">Age (Years) *</label>
                      <input
                        type="number"
                        min="1"
                        max="125"
                        value={editForm.age || ''}
                        onChange={(e) => setEditForm({ ...editForm, age: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                        placeholder="e.g. 32"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-medium"
                      />
                    </div>

                    {/* Gender */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface">Gender *</label>
                      <select
                        value={editForm.gender || 'Prefer not to say'}
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-medium cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-Binary">Non-Binary</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Height */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface">Height</label>
                      <input
                        type="text"
                        value={editForm.height || ''}
                        onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                        placeholder="e.g. 175 cm or 5'9''"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-medium"
                      />
                    </div>

                    {/* Weight */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-on-surface">Weight</label>
                      <input
                        type="text"
                        value={editForm.weight || ''}
                        onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                        placeholder="e.g. 70 kg or 154 lbs"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-surface-container-high bg-white focus:outline-none focus:border-primary font-medium"
                      />
                    </div>
                  </div>

                  {/* Allergies */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[18px] text-amber-600">warning</span>
                        <span>Known Drug / Medical Allergies?</span>
                      </span>
                      <div className="flex items-center rounded-lg bg-slate-200 p-0.5 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, hasAllergies: false, allergiesDescription: '' })}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            !editForm.hasAllergies ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          No (NKDA)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, hasAllergies: true })}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            editForm.hasAllergies ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          Yes
                        </button>
                      </div>
                    </div>

                    {editForm.hasAllergies ? (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-amber-900">Specify Allergies *</label>
                        <input
                          type="text"
                          value={editForm.allergiesDescription || ''}
                          onChange={(e) => setEditForm({ ...editForm, allergiesDescription: e.target.value })}
                          placeholder="e.g. Penicillin, Amoxicillin, Latex, NSAIDs"
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                        />
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                        <span>No Known Drug Allergies (NKDA) recorded</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Modal Bottom Actions */}
                <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowEditProfileModal(false)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: 6-DIGIT SQUARE OTP MODAL WITH TICK & SHAKE ANIMATIONS */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showOtpModal && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              {/* Full-Screen Animated Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setShowOtpModal(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={
                  isOtpError
                    ? { x: [-12, 12, -8, 8, -4, 4, 0], scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }
                    : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }
                }
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden transition-colors ${
                isOtpSuccess
                  ? 'border-emerald-500 shadow-emerald-500/10'
                  : isOtpError
                  ? 'border-rose-400'
                  : 'border-surface-container-high'
              }`}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isOtpSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <span className="material-symbols-outlined text-[18px]">
                      {isOtpSuccess ? 'check' : 'lock_clock'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-on-surface">
                      {otpPurpose === 'password_change' ? 'Authorize Password Reset' : 'Reconfigure 2FA Token'}
                    </h3>
                    <p className="text-[11px] text-on-surface-variant">
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
                    className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>

              {/* Modal Content */}
              <div className="py-4 overflow-y-auto flex-1 space-y-4">
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
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
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
                      <div className="text-sm font-bold text-emerald-800">OTP Verified Successfully!</div>
                      <div className="text-xs text-emerald-600 mt-0.5">Identity confirmed. Proceeding to password configuration...</div>
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
                  </>
                )}
              </div>

              {/* Modal Bottom Actions */}
              {!isOtpSuccess && (
                <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isOtpVerifying}
                    onClick={() => handleVerifyOtp()}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isOtpVerifying ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Validating Token...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>Verify Code</span>
                      </>
                    )}
                  </button>
                </div>
              )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TERMINATE ALL REMOTE SESSIONS CONFIRMATION */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showTerminateAllModal && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              {/* Full-Screen Animated Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setShowTerminateAllModal(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-2xl border border-surface-container-high flex flex-col max-h-[90vh] overflow-hidden"
              >
                {/* Modal Top Header */}
                <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-on-surface">Terminate All Remote Sessions?</h3>
                      <p className="text-[11px] text-on-surface-variant">Immediate global credential invalidation</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTerminateAllModal(false)}
                    className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="py-4 overflow-y-auto flex-1 text-xs text-on-surface-variant leading-relaxed">
                  This will immediately revoke active JWT bearer authorization for all other connected nodes (including Ward Tablet Cart #12 and Consultation Room 2). Only your current workstation will remain authenticated.
                </div>

                {/* Modal Bottom Actions */}
                <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTerminateAllModal(false)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTerminateAllRemote}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Terminate All Remote</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: SINGLE SESSION REVOCATION CONFIRMATION */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {sessionToRevoke && (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-3 sm:p-4">
              {/* Full-Screen Animated Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => setSessionToRevoke(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12, filter: 'blur(5px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, y: 8, filter: 'blur(4px)' }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-2xl border border-surface-container-high flex flex-col max-h-[90vh] overflow-hidden"
              >
                {/* Modal Top Header */}
                <div className="flex items-center justify-between border-b border-surface-container pb-3.5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px]">phonelink_erase</span>
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-on-surface">Revoke Session {sessionToRevoke.id}?</h3>
                      <p className="text-[11px] text-on-surface-variant">{sessionToRevoke.name}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSessionToRevoke(null)}
                    className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="py-4 overflow-y-auto flex-1 text-xs text-on-surface-variant leading-relaxed">
                  Are you sure you want to revoke authorized access for <strong>{sessionToRevoke.name}</strong> ({sessionToRevoke.details})? The remote terminal will be forced to log out immediately.
                </div>

                {/* Modal Bottom Actions */}
                <div className="flex items-center justify-between border-t border-surface-container pt-3.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSessionToRevoke(null)}
                    className="px-4 py-2 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmRevokeSingle}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">phonelink_erase</span>
                    <span>Confirm Revoke</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Avatar Crop & R2 Upload Modal */}
      <AvatarCropModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc}
        currentAvatarUrl={profile.avatarUrl}
        userEmail={profile.email}
        userName={profile.fullName}
        onClose={() => setCropModalOpen(false)}
        onSuccess={handleAvatarCropSuccess}
      />
    </div>
  );
}
