import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import ActivatePage from './pages/ActivatePage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import VulnerabilityPage from './pages/VulnerabilityPage';
import PentestPage from './pages/PentestPage';
import PhishingPage from './pages/PhishingPage';
import CISPage from './pages/CISPage';
import NISTPage from './pages/NISTPage';
import RoadmapPage from './pages/RoadmapPage';
import PortalRoadmapPage from './pages/PortalRoadmapPage';
import PortalOverviewPage from './pages/PortalOverviewPage';
import PortalCISPage from './pages/PortalCISPage';
import PortalNISTPage from './pages/PortalNISTPage';
import ClientDetailPage from './components/clients/ClientDetailPage';
import './styles/globals.css';

// Protected layout wrapper
function AdminLayout() {
  const { user } = useAuth();
  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />;
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--navy-900)' }}>
        <Outlet />
      </main>
    </div>
  );
}

function ClientLayout() {
  const { user } = useAuth();
  if (!user || user.role !== 'client') return <Navigate to="/login" replace />;
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--navy-900)' }}>
        <Outlet />
      </main>
    </div>
  );
}

function AuthRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/dashboard' : '/portal'} replace />;
}

// Placeholder for modules not yet built
function ComingSoon({ module }) {
  return (
    <div style={{ padding: '32px', textAlign: 'center', marginTop: '80px' }}>
      <div style={{
        display: 'inline-flex', padding: '16px', borderRadius: '16px',
        background: 'rgba(75,110,245,0.1)', marginBottom: '20px'
      }}>
        <span style={{ fontSize: '32px' }}>🚧</span>
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: '8px' }}>
        {module} — Coming in Stage {getStage(module)}
      </h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        This module is being built. Stage 1 is Auth, Dashboard, and Client Management.
      </p>
    </div>
  );
}

function getStage(module) {
  const stages = {
    'Vulnerability': 2, 'Penetration Test': 3, 'Phishing': 4,
    'CIS v8': 5, 'NIST CSF 2.0': 6, 'Remediation Roadmap': 7
  };
  return stages[module] || 'TBD';
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/" element={<AuthRedirect />} />

          {/* Admin routes */}
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/assessments/vulnerability" element={<VulnerabilityPage />} />
            <Route path="/assessments/pentest" element={<PentestPage />} />
            <Route path="/assessments/phishing" element={<PhishingPage />} />
            <Route path="/assessments/cis" element={<CISPage />} />
            <Route path="/assessments/nist" element={<NISTPage />} />
            <Route path="/roadmap" element={<RoadmapPage />} />
          </Route>

          {/* Client portal routes */}
          <Route element={<ClientLayout />}>
            <Route path="/portal" element={<PortalOverviewPage />} />
            <Route path="/portal/vulnerability" element={<ComingSoon module="Vulnerability" />} />
            <Route path="/portal/pentest" element={<ComingSoon module="Penetration Test" />} />
            <Route path="/portal/phishing" element={<ComingSoon module="Phishing" />} />
            <Route path="/portal/cis" element={<PortalCISPage />} />
            <Route path="/portal/nist" element={<PortalNISTPage />} />
            <Route path="/portal/roadmap" element={<PortalRoadmapPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
