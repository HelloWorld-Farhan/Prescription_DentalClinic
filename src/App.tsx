import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewCheck from './pages/NewCheck';
import Alerts from './pages/Alerts';
import AuditLog from './pages/AuditLog';
import RulesAdmin from './pages/RulesAdmin';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

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
