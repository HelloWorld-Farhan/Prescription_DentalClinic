import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  pageTransitionVariants,
  modalVariants,
  buttonTapTransition,
  EASE
} from '../lib/motion';
import ErrorBoundary from './ErrorBoundary';
import FirstTimeOnboardingModal from './FirstTimeOnboardingModal';
import { authApi, UserProfile } from '../services/authApi';
import { PrescriptionStorage } from '../services/prescriptionService';
import { SafetyCheckRecord } from '../types';

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  category: string;
  icon: string;
  unread: boolean;
  bgClass: string;
  textClass: string;
}

interface SearchResultItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  path: string;
  type: 'record' | 'action';
  badge?: string;
  badgeStyle?: string;
  subtitle?: string;
}

const SYSTEM_ACTIONS: SearchResultItem[] = [
  { id: 'act-check', name: 'Start New Safety Check', category: 'Prescription Screening', icon: 'add_circle', path: '/check', type: 'action', badge: 'Action', subtitle: 'Launch multi-modal patient safety check' },
  { id: 'act-alerts', name: 'View Active Contraindication Alerts', category: 'Safety Alerts Queue', icon: 'warning', path: '/alerts', type: 'action', badge: 'Alerts', subtitle: 'Review active red-flag overrides & reviews' },
  { id: 'act-audit', name: 'Inspect HIPAA Audit Trail', category: 'Compliance Ledger', icon: 'verified', path: '/audit-log', type: 'action', badge: 'Compliance', subtitle: 'Cryptographically signed audit logs' },
  { id: 'act-rules', name: 'Search Dental Rules & Interactions', category: 'Knowledgebase', icon: 'database', path: '/rules', type: 'action', badge: 'Database', subtitle: 'Deterministic interaction decision matrix' },
  { id: 'act-settings', name: 'Clinician Settings & Security', category: 'Account Settings', icon: 'settings', path: '/settings', type: 'action', badge: 'Settings', subtitle: 'Credentials, sessions & access controls' },
];

const initialNotifications: NotificationItem[] = [];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamic clinic logo
  const [clinicLogo, setClinicLogo] = useState<string>(() => {
    return localStorage.getItem('dental_clinic_logo') || '';
  });

  let storedUser: any = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('smileclinic_auth_user');
      if (raw) storedUser = JSON.parse(raw);
      if (storedUser && !storedUser.phone) {
        storedUser.phone = sessionStorage.getItem('rxguard_prescriber_phone') || localStorage.getItem('rxguard_prescriber_phone') || '';
      }
    } catch {
      storedUser = {};
    }
  }

  const [currentUser, setCurrentUser] = useState<any>(storedUser);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const email = (storedUser?.email || '').toLowerCase();
    if (!email) return false;
    const isDoneLocal = localStorage.getItem(`profile_completed_${email}`) === 'true';
    const isDoneServer = Boolean(storedUser?.profileCompleted);
    return !isDoneLocal && !isDoneServer;
  });

  const handleOnboardingComplete = (updated: UserProfile) => {
    setCurrentUser(updated);
    setShowOnboarding(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`profile_completed_${updated.email.toLowerCase()}`, 'true');
      localStorage.setItem('smileclinic_auth_user', JSON.stringify(updated));
    }
  };

  useEffect(() => {
    const email = (currentUser?.email || storedUser?.email || '').toLowerCase();
    if (!email) {
      setShowOnboarding(false);
      return;
    }

    // 1. Immediate local cache check
    const isDoneLocal = localStorage.getItem(`profile_completed_${email}`) === 'true';
    const isDoneServer = Boolean(currentUser?.profileCompleted || storedUser?.profileCompleted);
    if (isDoneLocal || isDoneServer) {
      setShowOnboarding(false);
    }

    // 2. Query backend database to guarantee cross-device synchronization
    let isCancelled = false;
    const syncProfileStatus = async () => {
      try {
        const res = await authApi.getProfileStatus(email);
        if (isCancelled) return;
        if (res && res.profileCompleted) {
          setShowOnboarding(false);
          localStorage.setItem(`profile_completed_${email}`, 'true');
          if (res.user) {
            setCurrentUser(res.user);
            localStorage.setItem('smileclinic_auth_user', JSON.stringify(res.user));
          }
        }
      } catch {
        // Resilience: network timeout keeps existing state
      }
    };

    syncProfileStatus();

    // 3. Re-verify when window or browser tab gains focus (e.g. submitted on phone and switched back to laptop)
    const handleFocus = () => {
      syncProfileStatus();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isCancelled = true;
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser?.email]);

  const prescriberName =
    currentUser?.fullName ||
    sessionStorage.getItem('rxguard_prescriber_name') ||
    localStorage.getItem('rxguard_prescriber_name') ||
    storedUser.fullName ||
    'Authorized Clinician';
  const prescriberRole =
    sessionStorage.getItem('rxguard_prescriber_role') ||
    localStorage.getItem('rxguard_prescriber_role') ||
    storedUser.role ||
    'Clinical Prescriber';

  const rawNpi =
    sessionStorage.getItem('rxguard_prescriber_npi') ||
    localStorage.getItem('rxguard_prescriber_npi') ||
    storedUser.id ||
    '1982740928';
  const prescriberNpi =
    rawNpi && rawNpi !== 'NPI Verified' && rawNpi !== 'NPI-PENDING'
      ? rawNpi
      : '1982740928';

  const rawId =
    sessionStorage.getItem('rxguard_prescriber_id') ||
    storedUser.id ||
    '1982740928';
  const prescriberUniqueId =
    rawId.length > 16 ? `UID-${rawId.slice(0, 8).toUpperCase()}` : (rawId.startsWith('UID-') ? rawId : `UID-${rawId}`);

  const prescriberInitials = prescriberName
    .replace(/^Dr\.\s*/i, '')
    .trim()
    .split(/\s+/)
    .map((w: string) => w[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('') || 'RX';

  // Close drawers/menus and scroll to top on navigation
  useEffect(() => {
    setSidebarOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleLogoUpdate = () => {
      setClinicLogo(localStorage.getItem('dental_clinic_logo') || '');
    };
    window.addEventListener('clinic_logo_updated', handleLogoUpdate);
    return () => window.removeEventListener('clinic_logo_updated', handleLogoUpdate);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard Shortcuts (Cmd/Ctrl + K and Escape)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setSidebarOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const isAuth =
      sessionStorage.getItem('rxguard_authenticated') === 'true' ||
      localStorage.getItem('rxguard_authenticated') === 'true';
    if (!isAuth) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'grid_view' },
    { name: 'New Safety Check', path: '/check', icon: 'add_circle' },
    { name: 'Alerts Queue', path: '/alerts', icon: 'warning' },
    { name: 'Audit Log', path: '/audit-log', icon: 'verified' },
    { name: 'Rules & Data', path: '/rules', icon: 'database' },
  ];

  const getPageInfo = (pathname: string) => {
    if (pathname.startsWith('/check') || pathname.startsWith('/dashboard/check')) {
      return { title: 'Prescription Safety Check', icon: 'add_circle' };
    }
    if (pathname.startsWith('/alerts') || pathname.startsWith('/dashboard/alerts')) {
      return { title: 'Alerts & Overrides Queue', icon: 'warning' };
    }
    if (pathname.startsWith('/audit-log') || pathname.startsWith('/dashboard/audit-log')) {
      return { title: 'HIPAA Notarized Audit Trail', icon: 'verified' };
    }
    if (pathname.startsWith('/rules') || pathname.startsWith('/dashboard/rules')) {
      return { title: 'Rules & Interaction Database', icon: 'database' };
    }
    if (pathname.startsWith('/settings') || pathname.startsWith('/dashboard/settings')) {
      return { title: 'Clinician Settings & Security', icon: 'settings' };
    }
    return { title: 'Clinical Safety Dashboard', icon: 'grid_view' };
  };

  const pageInfo = getPageInfo(location.pathname);

  const [realChecks, setRealChecks] = useState<SafetyCheckRecord[]>(() => {
    try {
      return PrescriptionStorage.getChecks();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (isSearchOpen) {
      setRealChecks(PrescriptionStorage.getChecks());
    }
  }, [isSearchOpen]);

  const filteredSearchItems: SearchResultItem[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return realChecks.slice(0, 5).map(check => ({
        id: check.id,
        name: `${check.patientName} (${check.mrn})`,
        category: `Safety Check #${check.id}`,
        icon: 'assignment',
        path: `/report/${check.id}`,
        type: 'record' as const,
        badge: check.overallStatus || (check.alerts.length > 0 ? 'Flagged' : 'Cleared'),
        badgeStyle: check.alerts.length > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800',
        subtitle: check.prescriptions.map(p => p.drugName).join(', ') || 'No medications listed'
      }));
    }

    const matchingChecks: SearchResultItem[] = realChecks
      .filter(check =>
        check.patientName.toLowerCase().includes(q) ||
        check.mrn.toLowerCase().includes(q) ||
        check.id.toLowerCase().includes(q) ||
        check.prescriptions.some(p =>
          p.drugName.toLowerCase().includes(q) ||
          (p.genericName && p.genericName.toLowerCase().includes(q))
        )
      )
      .map(check => ({
        id: check.id,
        name: `${check.patientName} (${check.mrn})`,
        category: `Safety Check #${check.id}`,
        icon: 'assignment',
        path: `/report/${check.id}`,
        type: 'record' as const,
        badge: check.overallStatus || (check.alerts.length > 0 ? 'Flagged' : 'Cleared'),
        badgeStyle: check.alerts.length > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800',
        subtitle: check.prescriptions.map(p => p.drugName).join(', ') || 'No medications listed'
      }));

    const matchingActions: SearchResultItem[] = SYSTEM_ACTIONS.filter(act =>
      act.name.toLowerCase().includes(q) ||
      act.category.toLowerCase().includes(q) ||
      (act.subtitle && act.subtitle.toLowerCase().includes(q))
    );

    return [...matchingChecks, ...matchingActions];
  }, [searchQuery, realChecks]);

  const handleLogout = () => {
    sessionStorage.removeItem('rxguard_authenticated');
    localStorage.removeItem('rxguard_authenticated');
    navigate('/login');
  };

  // Shared Sidebar Content (Used for both Desktop fixed and Mobile drawer)
  const renderSidebarContent = (isMobile: boolean = false) => (
    <div className="flex flex-col justify-between h-full">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="px-4 sm:px-5 pt-5 pb-4 flex items-center justify-between border-b border-surface-container-low gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              {clinicLogo ? (
                <img src={clinicLogo} alt="Clinic Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="material-symbols-outlined text-[24px] text-primary">dentistry</span>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-base sm:text-lg font-bold tracking-tight text-primary block leading-tight truncate">Smile Clinic</span>
              <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider block truncate">Prescription Portal</span>
            </div>
          </div>
          {isMobile && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={buttonTapTransition}
              onClick={() => setSidebarOpen(false)}
              onPointerDown={(e) => {
                e.stopPropagation();
                setSidebarOpen(false);
              }}
              className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high active:bg-surface-container-highest flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors duration-150 cursor-pointer shrink-0 shadow-2xs"
              aria-label="Close navigation menu"
              title="Close menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </motion.button>
          )}
        </div>

        {/* Navigation Clinical Search Bar */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(true);
              if (isMobile) setSidebarOpen(false);
            }}
            className="w-full h-9 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-xs text-outline flex items-center justify-between transition-colors duration-150 cursor-pointer group shadow-2xs"
            title="Search clinical records or actions (⌘K)"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[17px] text-outline group-hover:text-primary transition-colors duration-150">
                search
              </span>
              <span className="truncate font-medium text-outline group-hover:text-on-surface">
                {searchQuery.trim() ? searchQuery : 'Search records...'}
              </span>
            </div>
            <kbd className="text-[10px] bg-surface-container-high text-outline px-1.5 py-0.5 rounded border border-surface-container-highest font-mono shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Navigation Links with Shared layoutId Pill */}
        <nav className="p-3 space-y-1 mt-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setSidebarOpen(false);
                }}
                className={`relative w-full flex items-center px-4 py-3 rounded-xl transition-colors duration-150 text-xs font-semibold select-none cursor-pointer ${
                  isActive
                    ? 'text-white'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId={isMobile ? "activeMobileSidebarItem" : "activeSidebarItem"}
                    className="absolute inset-0 bg-primary rounded-xl shadow-xs"
                    transition={{ duration: 0.25, ease: EASE }}
                  />
                )}
                <span className={`material-symbols-outlined mr-3 text-[20px] relative z-10 ${isActive ? 'text-white' : 'text-on-surface-variant'}`}>
                  {item.icon}
                </span>
                <span className="relative z-10">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer - Clinician Card & Logout */}
      <div className="p-4 space-y-3 border-t border-surface-container-high">
        <div className="p-2.5 bg-surface-container-lowest rounded-xl border border-surface-container-high flex items-center gap-2.5 shadow-2xs">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs ring-1 ring-primary/20">
            {prescriberInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-on-surface truncate">{prescriberName}</div>
            <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active Prescriber
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={buttonTapTransition}
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-error hover:bg-error-container/40 transition-colors duration-150 font-semibold text-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Lock / Log Out
        </motion.button>
      </div>
    </div>
  );

  return (
    <div className="bg-background min-h-screen text-on-surface font-sans flex flex-col overflow-x-hidden w-full max-w-full">
      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden cursor-pointer touch-none"
              onClick={() => setSidebarOpen(false)}
              onPointerDown={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              key="mobile-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: EASE }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: -320, right: 0 }}
              dragElastic={{ left: 0.05, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -40 || info.velocity.x < -200) {
                  setSidebarOpen(false);
                }
              }}
              className="fixed left-0 top-0 bottom-0 w-72 sm:w-80 max-w-[85vw] bg-surface-container-lowest z-50 flex flex-col justify-between border-r border-surface-container-high shadow-2xl lg:hidden touch-pan-y"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Fixed Left Sidebar (Persistent, never re-animates on route change) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-surface-container-lowest z-30 flex-col justify-between border-r border-surface-container-high shadow-none">
        {renderSidebarContent(false)}
      </aside>

      {/* Top Header & Main Outlet Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/90 backdrop-blur-md shadow-xs z-30 flex items-center justify-between px-3 sm:px-6 lg:px-8 border-b border-surface-container-high gap-2 sm:gap-4">
          {/* Left: Mobile Menu + Active Module Context */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={buttonTapTransition}
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="lg:hidden p-2 text-on-surface hover:bg-surface-container rounded-xl cursor-pointer shrink-0 transition-colors duration-150"
              aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <span className="material-symbols-outlined text-2xl">
                {sidebarOpen ? 'close' : 'menu'}
              </span>
            </motion.button>

            {/* Title & Status */}
            <div className="hidden sm:flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-2xs">
                <span className="material-symbols-outlined text-[19px]">
                  {pageInfo.icon}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-on-surface block leading-tight truncate">
                  {pageInfo.title}
                </span>
                <span className="text-[10px] text-outline flex items-center gap-1.5 font-medium leading-none mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Prescription AI v1.0 • Active
                </span>
              </div>
            </div>
          </div>

          {/* Center: Prescription AI Status Badge */}
          <div className="flex items-center justify-center min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface-variant shadow-2xs">
              <span className="material-symbols-outlined text-[16px] sm:text-[18px] text-primary">psychology</span>
              <span className="font-bold text-on-surface tracking-tight text-xs sm:text-sm hidden xs:inline">Prescription AI</span>
              <span className="xs:hidden font-bold text-on-surface text-[11px]">AI</span>
              <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[9px] sm:text-[10px] font-bold">
                v1.0
              </span>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" title="Prescription AI Online"></span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Quick Search Button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              transition={buttonTapTransition}
              onClick={() => setIsSearchOpen(true)}
              className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors duration-150 cursor-pointer flex items-center justify-center shadow-2xs"
              title="Search clinical records or actions (⌘K)"
              aria-label="Search records"
            >
              <span className="material-symbols-outlined text-[19px] sm:text-[20px] text-outline hover:text-primary">search</span>
            </motion.button>

            {/* Quick Action Button: New Check */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              transition={buttonTapTransition}
              onClick={() => navigate('/check')}
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-hover transition-colors duration-150 flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
              title="Start New Prescription Safety Check"
            >
              <span className="material-symbols-outlined text-[17px] sm:text-[18px] shrink-0">add_circle</span>
              <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">New Check</span>
            </motion.button>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notifDropdownRef}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={buttonTapTransition}
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileOpen(false);
                }}
                className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors duration-150 relative cursor-pointer"
                title="Notifications"
                aria-label="Clinical notifications"
              >
                <span className="material-symbols-outlined text-[20px] block">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-2xs">
                    {unreadCount}
                  </span>
                )}
              </motion.button>

              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <div
                      className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 sm:hidden"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: EASE }}
                      className="fixed top-16 left-3 right-3 max-w-sm mx-auto sm:absolute sm:top-12 sm:left-auto sm:right-0 sm:w-96 bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden z-50"
                    >
                      <div className="p-4 border-b border-surface-container-low flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-on-surface">Clinical Notifications</h4>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">done_all</span>
                            Mark read
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-surface-container-low max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-xs text-on-surface-variant flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[28px] text-outline">notifications_paused</span>
                            <span className="font-medium">No pending clinical notifications</span>
                            <span className="text-[11px] text-outline">All screening events are up to date</span>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div key={n.id} className="p-3.5 hover:bg-surface-container-low transition-colors flex items-start gap-3">
                              <div className={`p-2 rounded-xl shrink-0 ${n.bgClass} ${n.textClass}`}>
                                <span className="material-symbols-outlined text-[18px]">{n.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-xs text-on-surface">{n.title}</h5>
                                <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">{n.desc}</p>
                                <span className="text-[10px] text-outline mt-1 block">{n.time}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={buttonTapTransition}
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-xl hover:bg-surface-container-high transition-colors duration-150 cursor-pointer"
                aria-label="Clinician profile options"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {prescriberInitials}
                </div>
                <span className="material-symbols-outlined text-[18px] text-outline hidden sm:block">arrow_drop_down</span>
              </motion.button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 sm:hidden"
                      onClick={() => setProfileOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: EASE }}
                      className="fixed top-16 right-3 left-auto w-64 max-w-[calc(100vw-24px)] sm:absolute sm:top-12 sm:right-0 bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high p-2 z-50 space-y-1"
                    >
                      <div className="p-3 border-b border-surface-container-low bg-surface-container-low/30 rounded-t-xl space-y-1.5">
                        <div className="font-bold text-xs text-on-surface">
                          {prescriberName}
                        </div>
                        <div className="text-[10px] text-outline uppercase tracking-wider font-semibold">
                          {prescriberRole}
                        </div>
                        <div className="pt-1 flex flex-col gap-1">
                          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 w-fit">
                            <span className="material-symbols-outlined text-[13px] text-emerald-600">verified</span>
                            <span>NPI: {prescriberNpi} • Verified</span>
                          </div>
                          <div className="text-[10px] text-outline font-mono flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px] text-outline">badge</span>
                            <span>Unique ID: <span className="text-on-surface font-semibold">{prescriberUniqueId}</span></span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/settings');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors duration-150 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px] text-outline">settings</span>
                        Portal Settings
                      </button>

                      <Link
                        to="/support"
                        onClick={() => setProfileOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors duration-150"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">support_agent</span>
                        Support &amp; Helpdesk
                      </Link>

                      <Link
                        to="/patient-rights"
                        onClick={() => setProfileOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors duration-150"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">assignment_turned_in</span>
                        Patient Rights
                      </Link>

                      <div className="border-t border-surface-container-low pt-1">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          transition={buttonTapTransition}
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-error hover:bg-error-container/30 transition-colors duration-150 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">logout</span>
                          Lock Session
                        </motion.button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content Route with Page Transition */}
        <main className="flex-1 p-4 lg:p-8 mt-16 max-w-7xl w-full mx-auto min-h-[calc(100vh-140px)]">
          <ErrorBoundary fallbackTitle="Unable to load this clinical safety view">
            <AnimatePresence initial={false}>
              <motion.div
                key={location.pathname}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={pageTransitionVariants}
                className="w-full transform-gpu will-change-transform"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </main>

        {/* Standard Legal Footer */}
        <footer className="w-full bg-surface-container-low py-4 border-t border-surface-container-high px-4 sm:px-6 lg:px-8 mt-auto z-20">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant text-xs text-center sm:text-left">
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

      {currentUser?.email && (
        <FirstTimeOnboardingModal
          user={currentUser}
          isOpen={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Universal Responsive Clinical Search Command Palette */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4">
            {/* Backdrop */}
            <motion.div
              initial="initial"
              animate="animate"
              exit="exit"
              variants={modalVariants.backdrop}
              onClick={() => setIsSearchOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />

            {/* Modal Dialog Window */}
            <motion.div
              ref={searchContainerRef}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={modalVariants.panel}
              className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden z-10 flex flex-col max-h-[82vh] divide-y divide-surface-container-low"
            >
              {/* Search Bar Input */}
              <div className="p-3 sm:p-3.5 bg-surface-container-low flex items-center gap-2.5">
                <span className="material-symbols-outlined text-outline text-[20px] shrink-0">
                  search
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medications, patients, check IDs, or actions..."
                  className="w-full bg-transparent border-none text-xs sm:text-sm text-on-surface placeholder:text-outline font-medium outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high cursor-pointer transition-colors duration-150"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
                <kbd className="text-[10px] bg-surface-container-high text-outline px-1.5 py-0.5 rounded border border-surface-container-highest font-mono shrink-0 hidden sm:inline">
                  ESC
                </kbd>
              </div>

              {/* Status Header */}
              <div className="px-4 py-2 bg-surface-container-lowest flex items-center justify-between text-[11px] font-bold text-outline border-b border-surface-container-low">
                <span>
                  {searchQuery.trim()
                    ? `Matching Results (${filteredSearchItems.length})`
                    : filteredSearchItems.length > 0
                    ? `Recent Clinical Checks (${filteredSearchItems.length})`
                    : 'Clinical Records & Safety Actions'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[11px] text-outline hover:text-on-surface sm:hidden font-medium cursor-pointer"
                >
                  Close ✕
                </button>
              </div>

              {/* Results List */}
              <div className="overflow-y-auto divide-y divide-surface-container-low/60 flex-1 max-h-[55vh]">
                {filteredSearchItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-outline flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-outline/40">
                      {searchQuery.trim() ? 'search_off' : 'inbox'}
                    </span>
                    <span className="font-bold text-on-surface text-xs">No data</span>
                    <span className="text-[11px] text-outline max-w-xs">
                      {searchQuery.trim()
                        ? `No clinical records or actions matching "${searchQuery}"`
                        : 'No clinical safety checks on record yet. Start a new check to populate records.'}
                    </span>
                  </div>
                ) : (
                  filteredSearchItems.map((item) => (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      transition={buttonTapTransition}
                      onClick={() => {
                        navigate(item.path);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full p-3 text-left hover:bg-surface-container-low flex items-center justify-between gap-3 transition-colors duration-150 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          item.type === 'action'
                            ? 'bg-primary/10 text-primary'
                            : item.badge === 'Flagged' || item.badge === 'High Risk'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-on-surface block truncate">
                            {item.name}
                          </span>
                          <span className="text-[11px] text-outline block truncate">
                            {item.subtitle || item.category}
                          </span>
                        </div>
                      </div>

                      {item.badge && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          item.badgeStyle ||
                          (item.badge === 'Flagged' || item.badge === 'High Risk'
                            ? 'bg-rose-100 text-rose-800'
                            : item.badge === 'Action'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-emerald-100 text-emerald-800')
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </motion.button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 px-4 bg-surface-container-low text-[11px] text-outline flex items-center justify-between border-t border-surface-container-high/60">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-primary">psychology</span>
                  <span>Prescription AI v1.0 • Clinical Safety Guard</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/check');
                    setIsSearchOpen(false);
                  }}
                  className="font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>New Safety Check</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
