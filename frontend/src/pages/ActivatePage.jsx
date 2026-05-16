import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Shield, Lock, CheckCircle, AlertCircle } from 'lucide-react';

export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordsMatch = password === confirm;
  const passwordValid = password.length >= 12;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!passwordsMatch || !passwordValid) return;

    setLoading(true);
    setError('');
    try {
      await api.post('/auth/activate', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Activation failed. Link may be expired or already used.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <ActivateContainer>
        <div style={styles.errorState}>
          <AlertCircle size={40} color="var(--critical)" />
          <h2 style={styles.stateTitle}>Invalid Link</h2>
          <p style={styles.stateMsg}>This activation link is missing or malformed.</p>
        </div>
      </ActivateContainer>
    );
  }

  if (success) {
    return (
      <ActivateContainer>
        <div style={styles.successState}>
          <div style={styles.successIcon}>
            <CheckCircle size={40} color="var(--health-green)" />
          </div>
          <h2 style={styles.stateTitle}>Account Activated</h2>
          <p style={styles.stateMsg}>Your password has been set. Redirecting to login...</p>
        </div>
      </ActivateContainer>
    );
  }

  return (
    <ActivateContainer>
      <h2 style={styles.title}>Set Your Password</h2>
      <p style={styles.subtitle}>Create a strong password to activate your RetroRisk portal access.</p>

      <form onSubmit={handleSubmit} style={{ marginTop: '28px' }}>
        <div className="form-group">
          <label className="label">New Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} color="var(--text-muted)" style={styles.inputIcon} />
            <input
              className="input"
              style={{ paddingLeft: '36px' }}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 12 characters"
            />
          </div>
          {password && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: passwordValid ? 'var(--health-green)' : 'var(--critical)' }}>
              {passwordValid ? '✓ Password meets requirements' : '✗ Must be at least 12 characters'}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="label">Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} color="var(--text-muted)" style={styles.inputIcon} />
            <input
              className="input"
              style={{ paddingLeft: '36px' }}
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
            />
          </div>
          {confirm && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: passwordsMatch ? 'var(--health-green)' : 'var(--critical)' }}>
              {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
            </div>
          )}
        </div>

        {error && (
          <div style={styles.errorBox}>
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
          disabled={loading || !passwordValid || !passwordsMatch}
        >
          {loading ? 'Activating...' : 'Activate Account'}
        </button>
      </form>
    </ActivateContainer>
  );
}

function ActivateContainer({ children }) {
  return (
    <div style={styles.container} className="dot-grid">
      <div style={styles.glowLeft} />
      <div style={styles.wrapper}>
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}><Shield size={24} color="white" /></div>
          <span style={styles.logoText}>
            <span style={{ color: 'var(--text-primary)' }}>RETRO</span>
            <span className="gradient-text">RISK</span>
          </span>
        </div>
        <div className="card" style={styles.card}>
          <div style={styles.cardAccent} />
          <div style={{ padding: '32px' }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', background: 'var(--navy-950)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  glowLeft: {
    position: 'absolute', left: '-20%', top: '20%',
    width: '600px', height: '600px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(75,110,245,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  wrapper: { width: '100%', maxWidth: '440px', padding: '24px', animation: 'fadeIn 0.5s ease' },
  logoArea: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '32px' },
  logoIcon: {
    width: '44px', height: '44px', borderRadius: '12px',
    background: 'var(--gradient-brand)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 24px rgba(75,110,245,0.4)',
  },
  logoText: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '700', letterSpacing: '0.08em' },
  card: { overflow: 'hidden' },
  cardAccent: { height: '3px', background: 'var(--gradient-brand)' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', letterSpacing: '0.03em' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', lineHeight: 1.6 },
  inputIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', background: 'rgba(255,59,92,0.1)',
    border: '1px solid rgba(255,59,92,0.3)', borderRadius: '8px',
    color: 'var(--critical)', fontSize: '13px', marginBottom: '16px',
  },
  successState: { textAlign: 'center', padding: '16px 0' },
  errorState: { textAlign: 'center', padding: '16px 0' },
  successIcon: {
    width: '72px', height: '72px', borderRadius: '50%',
    background: 'rgba(59,255,138,0.1)', border: '1px solid rgba(59,255,138,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  stateTitle: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '8px' },
  stateMsg: { color: 'var(--text-secondary)', fontSize: '14px' },
};
