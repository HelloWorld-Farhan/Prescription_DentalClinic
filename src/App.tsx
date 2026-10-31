import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MotionConfig, AnimatePresence, motion } from 'framer-motion';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import { initAutoSync, pullFromCloud, purgeAllClinicalLocalStorage } from './services/cloudSyncService';
import { lazyRetry } from './utils/lazyRetry';

// Resilient lazy-load clinical route pages with auto-recovery on new deployments
const Login = lazyRetry(() => import('./pages/Login'), 'Login');
const Signup = lazyRetry(() => import('./pages/Signup'), 'Signup');
const ForgotPassword = lazyRetry(() => import('./pages/ForgotPassword'), 'ForgotPassword');
const Dashboard = lazyRetry(() => import('./pages/Dashboard'), 'Dashboard');
const NewCheck = lazyRetry(() => import('./pages/NewCheck'), 'NewCheck');
const Alerts = lazyRetry(() => import('./pages/Alerts'), 'Alerts');
const AuditLog = lazyRetry(() => import('./pages/AuditLog'), 'AuditLog');
const RulesAdmin = lazyRetry(() => import('./pages/RulesAdmin'), 'RulesAdmin');
const Settings = lazyRetry(() => import('./pages/Settings'), 'Settings');
const Report = lazyRetry(() => import('./pages/Report'), 'Report');
const PrivacyPolicy = lazyRetry(() => import('./pages/PrivacyPolicy'), 'PrivacyPolicy');
const TermsOfService = lazyRetry(() => import('./pages/TermsOfService'), 'TermsOfService');
const PatientRights = lazyRetry(() => import('./pages/PatientRights'), 'PatientRights');
const Support = lazyRetry(() => import('./pages/Support'), 'Support');

function RouteSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto p-4 lg:p-8 space-y-6 animate-fadeIn">
      <div className="h-8 w-64 bg-surface-container rounded-xl skeleton-shimmer" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-surface-container-low rounded-2xl border border-surface-container-high skeleton-shimmer" />
        ))}
      </div>
      <div className="h-64 bg-surface-container-low rounded-2xl border border-surface-container-high skeleton-shimmer" />
    </div>
  );
}

function TopLoadingBar() {
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 90);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          style={{ originX: 0 }}
          className="fixed top-0 left-0 right-0 h-[2px] bg-primary z-[9999] pointer-events-none"
        />
      )}
    </AnimatePresence>
  );
}

function AppRoutes() {
  return (
    <>
      <TopLoadingBar />
      <ScrollToTop />
      <Suspense fallback={<RouteSkeleton />}>
        <Routes>
          {/* Entry / Landing Route */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Fullscreen Printable Report */}
          <Route path="/report" element={<Report />} />

          <Route path="/report/:id" element={<Report />} />

          {/* Legal & Support */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/patient-rights" element={<PatientRights />} />
          <Route path="/support" element={<Support />} />

          {/* Legacy redirects */}
          <Route path="/dashboard/support" element={<Navigate to="/support" replace />} />
          <Route path="/dashboard/privacy-policy" element={<Navigate to="/privacy-policy" replace />} />
          <Route path="/dashboard/terms-of-service" element={<Navigate to="/terms-of-service" replace />} />
          <Route path="/dashboard/patient-rights" element={<Navigate to="/patient-rights" replace />} />

          {/* Authenticated Layout Routes */}
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/check" element={<NewCheck />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/audit-log" element={<AuditLog />} />
            <Route path="/rules" element={<RulesAdmin />} />
            <Route path="/settings" element={<Settings />} />

            {/* Subroutes under /dashboard/ */}
            <Route path="/dashboard/check" element={<NewCheck />} />
            <Route path="/dashboard/alerts" element={<Alerts />} />
            <Route path="/dashboard/audit-log" element={<AuditLog />} />
            <Route path="/dashboard/rules" element={<RulesAdmin />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/report" element={<Report />} />

            <Route path="/dashboard/report/:id" element={<Report />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  useEffect(() => {
    purgeAllClinicalLocalStorage();
    pullFromCloud().catch(() => {});

    const handleRecheck = () => {
      pullFromCloud().catch(() => {});
    };
    window.addEventListener('focus', handleRecheck);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleRecheck();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const cleanup = initAutoSync();
    return () => {
      cleanup?.();
      window.removeEventListener('focus', handleRecheck);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </MotionConfig>
  );
}
