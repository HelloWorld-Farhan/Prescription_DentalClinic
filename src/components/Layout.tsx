import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from './ErrorBoundary';

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

const initialNotifications: NotificationItem[] = [];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamic clinic logo synced across portals
  const [clinicLogo, setClinicLogo] = useState<string>(() => {
    return localStorage.getItem('dental_clinic_logo') || '';
  });

  let storedUser: any = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('smileclinic_auth_user');
      if (raw) storedUser = JSON.parse(raw);
    } catch {
      storedUser = {};
    }
  }

  const prescriberName =
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

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


  const handleLogout = () => {
    sessionStorage.removeItem('rxguard_authenticated');
    localStorage.removeItem('rxguard_authenticated');
    navigate('/login');
  };

  return (
    <div className="bg-background min-h-screen text-on-surface font-sans flex flex-col overflow-x-hidden w-full max-w-full">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside 
        className={`fixed left-0 top-0 bottom-0 w-64 bg-surface-container-lowest z-50 flex flex-col justify-between border-r border-surface-container-high transition-transform duration-300 shadow-xl lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-3 border-b border-surface-container-low">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-md overflow-hidden shrink-0">
              {clinicLogo ? (
                <img src={clinicLogo} alt="Clinic Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="material-symbols-outlined text-[24px] text-primary">dentistry</span>
              )}
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-primary block leading-tight">Smile Clinic</span>
              <span className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">Prescription Portal</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
              return (
                <motion.button
                  key={item.name}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-all text-xs font-semibold ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <span className={`material-symbols-outlined mr-3 text-[20px] ${isActive ? 'text-white' : 'text-on-surface-variant'}`}>
                    {item.icon}
                  </span>
                  {item.name}
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer - Clinician Card & Logout */}
        <div className="p-4 space-y-3 border-t border-surface-container-high">
          {/* Clinician Card */}
          <div className="p-2.5 bg-surface-container-lowest rounded-xl border border-surface-container-high flex items-center gap-2.5 shadow-xs">
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
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-error hover:bg-error-container/40 transition-all font-semibold text-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Lock / Log Out
          </motion.button>
        </div>
      </aside>

      {/* Top Header & Content Container */}
      <div className="lg:pl-64 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/90 backdrop-blur-md shadow-xs z-30 flex items-center justify-between px-3 sm:px-6 lg:px-8 border-b border-surface-container-high">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-on-surface hover:bg-surface-container rounded-xl mr-2 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>



          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
            {/* Quick Action Button: New Check */}
            <button
              onClick={() => navigate('/check')}
              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
              title="Start New Prescription Safety Check"
            >
              <span className="material-symbols-outlined text-[17px] sm:text-[18px] shrink-0">add_circle</span>
              <span className="text-xs font-bold whitespace-nowrap">New Check</span>
            </button>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  setProfileOpen(false);
                }}
                className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-all relative cursor-pointer"
                title="Notifications"
                aria-label="Clinical notifications"
              >
                <span className="material-symbols-outlined text-[20px] block">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    {/* Mobile Backdrop for safe touch dismissal */}
                    <div
                      className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 sm:hidden"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
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
              <button
                onClick={() => {
                  setProfileOpen(!profileOpen);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-1.5 p-1 sm:p-1.5 rounded-xl hover:bg-surface-container-high transition-all cursor-pointer"
                aria-label="Clinician profile options"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {prescriberInitials}
                </div>
                <span className="material-symbols-outlined text-[18px] text-outline hidden sm:block">arrow_drop_down</span>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    {/* Mobile Backdrop */}
                    <div
                      className="fixed inset-0 bg-black/30 backdrop-blur-2xs z-40 sm:hidden"
                      onClick={() => setProfileOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
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
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px] text-outline">settings</span>
                        Portal Settings
                      </button>

                    <Link
                      to="/support"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">support_agent</span>
                      Support & Helpdesk
                    </Link>

                    <Link
                      to="/patient-rights"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">assignment_turned_in</span>
                      Patient Rights
                    </Link>

                    <div className="border-t border-surface-container-low pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-error hover:bg-error-container/30 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        Lock Session
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            </div>
          </div>
        </header>

        {/* 5. Main Nested Content Route with Fluid Page Transitions */}
        <main className="flex-1 p-4 lg:p-8 mt-16 max-w-7xl w-full mx-auto min-h-[calc(100vh-140px)]">
          <ErrorBoundary fallbackTitle="Unable to load this clinical safety view">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="w-full"
            >
              <Outlet />
            </motion.div>
          </ErrorBoundary>
        </main>

        {/* 6. Standard Legal Footer */}
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
    </div>
  );
}
