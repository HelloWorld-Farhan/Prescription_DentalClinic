import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewCheck from './pages/NewCheck';
import Alerts from './pages/Alerts';
import AuditLog from './pages/AuditLog';
import RulesAdmin from './pages/RulesAdmin';
import Settings from './pages/Settings';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import PatientRights from './pages/PatientRights';
import Support from './pages/Support';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

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
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="check" element={<NewCheck />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="rules" element={<RulesAdmin />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
