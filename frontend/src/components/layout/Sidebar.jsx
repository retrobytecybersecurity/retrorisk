import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard, Users, Shield, FileSearch,
  Target, Mail, Map, LogOut, ChevronRight
} from 'lucide-react';

const adminNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { divider: true, label: 'Assessments' },
  { to: '/assessments/vulnerability', icon: FileSearch, label: 'Vulnerability' },
  { to: '/assessments/pentest', icon: Target, label: 'Penetration Test' },
  { to: '/assessments/phishing', icon: Mail, label: 'Phishing' },
  { to: '/assessments/cis', icon: Shield, label: 'CIS v8' },
  { to: '/assessments/nist', icon: Shield, label: 'NIST CSF 2.0' },
  { divider: true, label: 'Management' },
  { to: '/roadmap', icon: Map, label: 'Remediation Roadmap' },
];

const clientNav = [
  { to: '/portal', icon: LayoutDashboard, label: 'Overview' },
  { to: '/portal/vulnerability', icon: FileSearch, label: 'Vulnerabilities' },
  { to: '/portal/pentest', icon: Target, label: 'Pen Test Results' },
  { to: '/portal/phishing', icon: Mail, label: 'Phishing Results' },
  { divider: true, label: 'Assessments' },
  { to: '/portal/cis', icon: Shield, label: 'CIS v8' },
  { to: '/portal/nist', icon: Shield, label: 'NIST CSF 2.0' },
  { divider: true, label: 'Management' },
  { to: '/portal/roadmap', icon: Map, label: 'Remediation Roadmap' },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const navItems = isAdmin ? adminNav : clientNav;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoArea}>
        <div style={styles.logoIcon}>
          <Shield size={20} color="white" />
        </div>
        <div style={styles.logoText}>
          <span style={styles.logoRetro}>RETRO</span>
          <span style={styles.logoRisk}>RISK</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={styles.nav}>
        {navItems.map((item, i) => {
          if (item.divider) {
            return (
              <div key={i} style={styles.dividerGroup}>
                <span style={styles.dividerLabel}>{item.label}</span>
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/portal'}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {})
              })}
            >
              {({ isActive }) => (
                <>
                  <div style={{ ...styles.navIcon, ...(isActive ? styles.navIconActive : {}) }}>
                    <Icon size={16} />
                  </div>
                  <span style={styles.navLabel}>{item.label}</span>
                  {isActive && <ChevronRight size={12} style={styles.navChevron} />}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User area */}
      <div style={styles.userArea}>
        <div style={styles.userInfo}>
          <div style={styles.userAvatar}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div style={styles.userDetails}>
            <div style={styles.username}>{user?.username}</div>
            <div style={styles.userRole}>{isAdmin ? 'Administrator' : 'Client Portal'}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn} title="Sign out">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: { width: '240px', minWidth: '240px', height: '100vh', background: 'var(--navy-950)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0 },
  logoArea: { display: 'flex', alignItems: 'center', gap: '12px', padding: '24px 20px 20px', borderBottom: '1px solid var(--border-subtle)' },
  logoIcon: { width: '36px', height: '36px', borderRadius: '10px', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(75,110,245,0.4)', flexShrink: 0 },
  logoText: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', letterSpacing: '0.08em' },
  logoRetro: { color: 'var(--text-primary)' },
  logoRisk: { background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  nav: { flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '2px' },
  dividerGroup: { padding: '16px 8px 6px' },
  dividerLabel: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', transition: 'all 0.15s ease', position: 'relative' },
  navItemActive: { background: 'rgba(75,110,245,0.12)', color: 'var(--text-primary)', borderLeft: '2px solid var(--blue-primary)' },
  navIcon: { width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', flexShrink: 0, transition: 'all 0.15s ease' },
  navIconActive: { background: 'var(--gradient-brand)', boxShadow: '0 2px 8px rgba(75,110,245,0.4)', color: 'white' },
  navLabel: { flex: 1 },
  navChevron: { color: 'var(--blue-primary)', flexShrink: 0 },
  userArea: { padding: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 },
  userAvatar: { width: '32px', height: '32px', borderRadius: '8px', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 },
  userDetails: { minWidth: 0 },
  username: { fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '11px', color: 'var(--text-muted)' },
  logoutBtn: { width: '30px', height: '30px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease', flexShrink: 0 },
};
