import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function RepeatOffenders({ clientId }) {
  const [offenders, setOffenders] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get(`/clients/${clientId}/phishing/repeat-offenders`)
      .then(r => setOffenders(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className="card skeleton" style={{ height: '300px' }} />;

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} color="var(--critical)" />
          <span style={styles.title}>Repeat Offenders</span>
        </div>
        <span style={styles.subtitle}>Users who failed phishing simulations across multiple campaigns</span>
      </div>

      {offenders.length === 0 ? (
        <div style={styles.empty}>
          <CheckCircle size={32} color="var(--health-green)" style={{ marginBottom: '12px' }} />
          <div style={{ color: 'var(--text-muted)' }}>No repeat offenders detected across campaigns</div>
        </div>
      ) : (
        <>
          <div style={styles.tableHeader}>
            <span style={{ flex: 2 }}>Name</span>
            <span style={{ flex: 2 }}>Email</span>
            <span style={{ flex: 1 }}>Position</span>
            <span style={{ width: '80px', textAlign: 'center' }}>Failures</span>
            <span style={{ width: '100px', textAlign: 'center' }}>Training</span>
            <span style={{ flex: 1 }}>Last Failure</span>
          </div>
          {offenders.map((o, i) => (
            <div key={i} style={styles.row}>
              <div style={{ flex: 2 }}>
                <div style={styles.name}>{o.firstName} {o.lastName}</div>
              </div>
              <div style={{ flex: 2 }}>
                <div style={styles.email}>{o.email}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.pos}>{o.position || '—'}</div>
              </div>
              <div style={{ width: '80px', textAlign: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700',
                  color: o.failCount >= 3 ? 'var(--critical)' : 'var(--high)',
                }}>{o.failCount}</span>
              </div>
              <div style={{ width: '100px', display: 'flex', justifyContent: 'center' }}>
                {o.allTrainingCompleted ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--health-green)' }}>
                    <CheckCircle size={13} /> Complete
                  </span>
                ) : o.anyTrainingCompleted ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--medium)' }}>
                    <AlertTriangle size={13} /> Partial
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--critical)' }}>
                    <XCircle size={13} /> None
                  </span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.date}>
                  {new Date(o.lastFailDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const styles = {
  header: { padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)' },
  title: { fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700' },
  subtitle: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' },
  tableHeader: {
    display: 'flex', alignItems: 'center', padding: '8px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-muted)',
  },
  row: { display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', gap: '8px' },
  name: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' },
  email: { fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pos: { fontSize: '12px', color: 'var(--text-muted)' },
  date: { fontSize: '12px', color: 'var(--text-muted)' },
  empty: { padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
};
