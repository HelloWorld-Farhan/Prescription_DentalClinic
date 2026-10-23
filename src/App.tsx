import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import NewCheck from './pages/NewCheck';
import Alerts from './pages/Alerts';
import AuditLog from './pages/AuditLog';
import RulesAdmin from './pages/RulesAdmin';
import Settings from './pages/Settings';
import Report from './pages/Report';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import PatientRights from './pages/PatientRights';
import Support from './pages/Support';

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        {/* Entry / Landing Route - Opens Login Screen First */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Dedicated Fullscreen Printable Clinical Report */}
        <Route path="/report" element={<Report />} />

        {/* Informational & Support Routes */}
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/patient-rights" element={<PatientRights />} />
        <Route path="/support" element={<Support />} />

        {/* Legacy Dashboard clean redirects */}
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
          <Route path="/report" element={<Report />} />

          {/* Subroutes under /dashboard/ */}
          <Route path="/dashboard/check" element={<NewCheck />} />
          <Route path="/dashboard/alerts" element={<Alerts />} />
          <Route path="/dashboard/audit-log" element={<AuditLog />} />
          <Route path="/dashboard/rules" element={<RulesAdmin />} />
          <Route path="/dashboard/settings" element={<Settings />} />
          <Route path="/dashboard/report" element={<Report />} />
        </Route>

        {/* Fallback - Redirect to Login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
