import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Shield, Lock, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAdmin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError('');

    try {
      const user = await login(username.trim(), password);
      if (user.role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/portal');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container} className="dot-grid">
      {/* Ambient glow effects */}
      <div style={styles.glowLeft} />
      <div style={styles.glowRight} />

      {/* Scanline effect */}
      <div style={styles.scanline} />

      <div style={styles.wrapper}>
        {/* Logo area */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>
            <Shield size={32} color="white" />
          </div>
          <div>
            <div style={styles.logoWordmark}>
              <span style={styles.logoRetro}>RETRO</span>
              <span style={styles.logoRisk}>RISK</span>
            </div>
            <div style={styles.logoSub}>by Retrobyte Cybersecurity</div>
          </div>
        </div>

        {/* Login card */}
        <div style={styles.card} className="card">
          {/* Card top accent */}
          <div style={styles.cardAccent} />

          <div style={styles.cardHeader}>
            <h1 style={styles.cardTitle}>Secure Access</h1>
            <p style={styles.cardSubtitle}>GRC Management Platform</p>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div className="form-group">
              <label className="label">Username</label>
              <div style={styles.inputWrapper}>
                <User size={15} color="var(--text-muted)" style={styles.inputIcon} />
                <input
                  className="input"
                  style={styles.inputWithIcon}
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Password</label>
              <div style={styles.inputWrapper}>
                <Lock size={15} color="var(--text-muted)" style={styles.inputIcon} />
                <input
                  className="input"
                  style={styles.inputWithIcon}
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={styles.submitBtn}
              disabled={loading || !username.trim() || !password}
            >
              {loading ? (
                <>
                  <span style={styles.spinner} />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock size={15} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Security notice */}
          <div style={styles.securityNotice}>
            <div style={styles.securityDot} />
            <span>End-to-end encrypted • AES-256 at rest</span>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          © {new Date().getFullYear()} Retrobyte Cybersecurity. All rights reserved.
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--navy-950)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowLeft: {
    position: 'absolute',
    left: '-20%',
    top: '20%',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(75,110,245,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  glowRight: {
    position: 'absolute',
    right: '-15%',
    bottom: '10%',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(155,75,245,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  scanline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'linear-gradient(90deg, transparent, rgba(75,110,245,0.3), transparent)',
    animation: 'scanline 8s linear infinite',
    pointerEvents: 'none',
  },
  wrapper: {
    width: '100%',
    maxWidth: '420px',
    padding: '24px',
    position: 'relative',
    zIndex: 1,
    animation: 'fadeIn 0.5s ease',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '40px',
    justifyContent: 'center',
  },
  logoIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'var(--gradient-brand)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 32px rgba(75,110,245,0.4)',
  },
  logoWordmark: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    lineHeight: 1,
  },
  logoRetro: {
    color: 'var(--text-primary)',
  },
  logoRisk: {
    background: 'var(--gradient-brand)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  logoSub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginTop: '2px',
  },
  card: {
    padding: '0',
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccent: {
    height: '3px',
    background: 'var(--gradient-brand)',
    width: '100%',
  },
  cardHeader: {
    padding: '32px 32px 0',
    marginBottom: '28px',
  },
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: '700',
    letterSpacing: '0.04em',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  cardSubtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  form: {
    padding: '0 32px',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  inputWithIcon: {
    paddingLeft: '36px',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(255,59,92,0.1)',
    border: '1px solid rgba(255,59,92,0.3)',
    borderRadius: '8px',
    color: 'var(--critical)',
    fontSize: '13px',
    marginBottom: '16px',
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '13px',
    fontSize: '15px',
    fontWeight: '600',
    letterSpacing: '0.03em',
    marginBottom: '0',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    display: 'inline-block',
  },
  securityNotice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '20px 32px 24px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.03em',
  },
  securityDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--health-green)',
    boxShadow: '0 0 8px var(--health-green)',
  },
  footer: {
    textAlign: 'center',
    marginTop: '32px',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
};
