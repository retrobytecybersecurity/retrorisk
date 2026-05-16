import React, { useState } from 'react';
import api from '../../utils/api';
import { X, ArrowRight } from 'lucide-react';

const SOURCES    = ['CIS','NIST','Pen Test','Vuln Scan','Phishing'];
const PRIORITIES = ['Critical','High','Medium','Low','Informational'];
const EFFORTS    = ['Low','Medium','High'];

export default function PromoteModal({ clientId, clientName, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title:           '',
    source:          'CIS',
    sourceReference: '',
    priority:        'High',
    effort:          '',
    dueDate:         '',
    notes:           '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  function update(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit() {
    if (!form.title) { setError('Title is required'); return; }
    setLoading(true); setError('');
    try {
      await api.post(`/clients/${clientId}/roadmap/promote`, form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to promote');
    } finally {
      setLoading(false);
    }
  }

  // Placeholder labels by source
  const refPlaceholders = {
    CIS:       'e.g. CIS Control 3.1 — Encrypt Data on End-User Devices',
    NIST:      'e.g. PR.DS-01 — Data at rest protection',
    'Pen Test':'e.g. Unauthenticated RCE on VPN Gateway',
    'Vuln Scan':'e.g. SSL Version 2 and 3 Protocol Detection',
    Phishing:  'e.g. High click rate — Credential Harvest campaign',
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '540px' }}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Promote Finding to Roadmap</h2>
            <p style={styles.subtitle}>{clientName}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div style={styles.flowIndicator}>
          <span style={styles.flowSource}>{form.source}</span>
          <ArrowRight size={16} color="var(--text-muted)" />
          <span style={styles.flowDest}>Remediation Roadmap</span>
        </div>

        <div className="form-group">
          <label className="label">Source Framework *</label>
          <div style={styles.sourceGrid}>
            {SOURCES.map(s => (
              <button key={s} type="button"
                style={{ ...styles.sourceBtn, ...(form.source === s ? styles.sourceBtnActive : {}) }}
                onClick={() => update('source', s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="label">Finding / Control Reference</label>
          <input className="input" value={form.sourceReference}
            onChange={e => update('sourceReference', e.target.value)}
            placeholder={refPlaceholders[form.source] || ''} />
        </div>

        <div className="form-group">
          <label className="label">Roadmap Item Title *</label>
          <input className="input" value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="What remediation action is required..." />
        </div>

        <div style={styles.row}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Priority *</label>
            <select className="input" value={form.priority} onChange={e => update('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Effort Estimate</label>
            <select className="input" value={form.effort} onChange={e => update('effort', e.target.value)}>
              <option value="">Not set</option>
              {EFFORTS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Due Date</label>
            <input className="input" type="date" value={form.dueDate}
              onChange={e => update('dueDate', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="label">Notes (visible to client)</label>
          <textarea className="input" rows={2} value={form.notes}
            onChange={e => update('notes', e.target.value)}
            placeholder="Remediation guidance or context..."
            style={{ resize: 'vertical' }} />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Promoting...' : 'Add to Roadmap'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', letterSpacing: '0.03em' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' },
  flowIndicator: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: 'var(--navy-800)', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-subtle)' },
  flowSource: { fontSize: '13px', fontWeight: '700', color: 'var(--blue-primary)', background: 'rgba(75,110,245,0.1)', padding: '2px 10px', borderRadius: '6px' },
  flowDest: { fontSize: '13px', fontWeight: '700', color: 'var(--health-green)', background: 'rgba(59,255,138,0.1)', padding: '2px 10px', borderRadius: '6px' },
  sourceGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  sourceBtn: { padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.15s ease' },
  sourceBtnActive: { background: 'rgba(75,110,245,0.15)', color: 'var(--blue-light)', borderColor: 'var(--border-accent)' },
  row: { display: 'flex', gap: '12px' },
  error: { padding: '10px 14px', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: '8px', color: 'var(--critical)', fontSize: '13px', marginBottom: '16px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' },
};
