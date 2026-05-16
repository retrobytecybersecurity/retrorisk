import React, { useState } from 'react';
import api from '../../utils/api';
import { X } from 'lucide-react';

const SOURCES    = ['CIS','NIST','Pen Test','Vuln Scan','Phishing','Manual'];
const PRIORITIES = ['Critical','High','Medium','Low','Informational'];
const STATUSES   = ['Open','In Progress','Completed','Risk Accepted'];
const EFFORTS    = ['Low','Medium','High'];

export default function AddItemModal({ clientId, clientName, item, onClose, onSuccess }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    title:           item?.title           || '',
    source:          item?.source          || 'Manual',
    sourceReference: item?.source_reference|| '',
    priority:        item?.priority        || 'Medium',
    status:          item?.status          || 'Open',
    effort:          item?.effort          || '',
    dueDate:         item?.due_date        || '',
    assignedOwner:   item?.assigned_owner  || '',
    notes:           item?.notes           || '',
    internalNotes:   item?.internal_notes  || '',
    riskAcceptanceReason: item?.risk_acceptance_reason || '',
    riskAcceptedBy:  item?.risk_accepted_by|| '',
    riskReviewDate:  item?.risk_review_date|| '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  function update(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSubmit() {
    if (!form.title) { setError('Title is required'); return; }
    setLoading(true); setError('');
    try {
      if (isEdit) {
        await api.put(`/roadmap/${item.id}`, form);
      } else {
        await api.post(`/clients/${clientId}/roadmap`, form);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{isEdit ? 'Edit Roadmap Item' : 'Add Roadmap Item'}</h2>
            <p style={styles.subtitle}>{clientName}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        <div className="form-group">
          <label className="label">Title *</label>
          <input className="input" value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="What needs to be remediated..." />
        </div>

        <div style={styles.row}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Source *</label>
            <select className="input" value={form.source} onChange={e => update('source', e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Source Reference</label>
            <input className="input" value={form.sourceReference}
              onChange={e => update('sourceReference', e.target.value)}
              placeholder="e.g. CIS 3.1, CVE-2024-xxxx" />
          </div>
        </div>

        <div style={styles.row}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Priority *</label>
            <select className="input" value={form.priority} onChange={e => update('priority', e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => update('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Effort</label>
            <select className="input" value={form.effort} onChange={e => update('effort', e.target.value)}>
              <option value="">Not set</option>
              {EFFORTS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Due Date</label>
            <input className="input" type="date" value={form.dueDate}
              onChange={e => update('dueDate', e.target.value)} />
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Phase auto-assigned: ≤30d = Quick Win, ≤90d = Short Term, 90d+ = Long Term
            </div>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="label">Assigned Owner</label>
            <input className="input" value={form.assignedOwner}
              onChange={e => update('assignedOwner', e.target.value)}
              placeholder="Person responsible at client" />
          </div>
        </div>

        <div className="form-group">
          <label className="label">Notes (visible to client)</label>
          <textarea className="input" rows={2} value={form.notes}
            onChange={e => update('notes', e.target.value)}
            placeholder="Guidance or context for the client..."
            style={{ resize: 'vertical' }} />
        </div>

        <div className="form-group">
          <label className="label">Internal Notes (admin only)</label>
          <textarea className="input" rows={2} value={form.internalNotes}
            onChange={e => update('internalNotes', e.target.value)}
            placeholder="Notes only you can see..."
            style={{ resize: 'vertical' }} />
        </div>

        {form.status === 'Risk Accepted' && (
          <>
            <div className="divider" />
            <div className="form-group">
              <label className="label">Risk Acceptance Reason</label>
              <textarea className="input" rows={2} value={form.riskAcceptanceReason}
                onChange={e => update('riskAcceptanceReason', e.target.value)}
                placeholder="Business justification for accepting this risk..."
                style={{ resize: 'vertical' }} />
            </div>
            <div style={styles.row}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Accepted By</label>
                <input className="input" value={form.riskAcceptedBy}
                  onChange={e => update('riskAcceptedBy', e.target.value)}
                  placeholder="Name and title" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Review Date</label>
                <input className="input" type="date" value={form.riskReviewDate}
                  onChange={e => update('riskReviewDate', e.target.value)} />
              </div>
            </div>
          </>
        )}

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.actions}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', letterSpacing: '0.03em' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' },
  row: { display: 'flex', gap: '16px' },
  error: { padding: '10px 14px', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: '8px', color: 'var(--critical)', fontSize: '13px', marginBottom: '16px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' },
};
