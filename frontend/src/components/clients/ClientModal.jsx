import React, { useState } from 'react';
import api from '../../utils/api';
import { X, Building2, User, Calendar, Settings } from 'lucide-react';

const INDUSTRIES = ['Healthcare', 'Finance', 'Legal', 'Manufacturing', 'Retail', 'Education', 'Government', 'Other'];
const ORG_SIZES = ['1–10', '11–50', '51–200', '201–500', '501–1000', '1000+'];
const ENGAGEMENT_TYPES = [
  { value: 'vciso_only', label: 'vCISO Only' },
  { value: 'vciso_assessments', label: 'vCISO + Assessments' },
  { value: 'assessments_only', label: 'Assessments Only' },
];
const IG_LEVELS = [
  { value: 'IG1', label: 'IG1 — Basic Cyber Hygiene' },
  { value: 'IG2', label: 'IG2 — Intermediate' },
  { value: 'IG3', label: 'IG3 — Advanced' },
];
const CHECKIN_CADENCES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];
const ASSESSMENT_CADENCES = [
  { key: 'vuln', label: 'Vulnerability Scan' },
  { key: 'cis', label: 'CIS v8 Assessment' },
  { key: 'nist', label: 'NIST CSF 2.0' },
  { key: 'pentest', label: 'Penetration Test' },
  { key: 'phishing', label: 'Phishing Assessment' },
];

const FREQ_OPTIONS = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

export default function ClientModal({ onClose, onSuccess, initialData }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    organizationName: initialData?.organizationName || '',
    industry: initialData?.industry || '',
    organizationSize: initialData?.organizationSize || '',
    engagementType: initialData?.engagementType || '',
    cisIgLevel: initialData?.cisIgLevel || '',
    primaryContactName: initialData?.primaryContactName || '',
    primaryContactEmail: initialData?.primaryContactEmail || '',
    primaryContactPhone: initialData?.primaryContactPhone || '',
    address: initialData?.address || '',
    contractStartDate: initialData?.contractStartDate || '',
    contractRenewalDate: initialData?.contractRenewalDate || '',
    checkinCadence: initialData?.checkinCadence || 'monthly',
    assessmentCadences: initialData?.assessmentCadences || {},
    notes: initialData?.notes || '',
  });

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateCadence(key, value) {
    setForm(prev => ({
      ...prev,
      assessmentCadences: { ...prev.assessmentCadences, [key]: value }
    }));
  }

  function canProceed() {
    if (step === 1) return form.organizationName && form.industry && form.organizationSize && form.engagementType;
    if (step === 2) return form.primaryContactName && form.primaryContactEmail;
    return true;
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      if (initialData?.id) {
        await api.put(`/clients/${initialData.id}`, form);
      } else {
        await api.post('/clients', form);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save client');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>{initialData ? 'Edit Client' : 'Add New Client'}</h2>
            <p style={styles.subtitle}>Step {step} of 3</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        {/* Step indicators */}
        <div style={styles.steps}>
          {['Organization', 'Contact', 'Cadence'].map((label, i) => (
            <div key={i} style={styles.step}>
              <div style={{
                ...styles.stepDot,
                background: i + 1 <= step ? 'var(--gradient-brand)' : 'var(--navy-600)',
                boxShadow: i + 1 === step ? '0 0 12px rgba(75,110,245,0.5)' : 'none'
              }}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <span style={{
                ...styles.stepLabel,
                color: i + 1 <= step ? 'var(--text-primary)' : 'var(--text-muted)'
              }}>{label}</span>
              {i < 2 && <div style={styles.stepLine} />}
            </div>
          ))}
        </div>

        <div className="divider" />

        {/* Step 1: Organization */}
        {step === 1 && (
          <div className="animate-fade-in">
            <SectionHeader icon={<Building2 size={16} />} label="Organization Details" />

            <div className="form-group">
              <label className="label">Organization Name *</label>
              <input className="input" value={form.organizationName}
                onChange={e => update('organizationName', e.target.value)}
                placeholder="Acme Corporation" />
            </div>

            <div style={styles.row}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Industry *</label>
                <select className="input" value={form.industry} onChange={e => update('industry', e.target.value)}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Organization Size *</label>
                <select className="input" value={form.organizationSize} onChange={e => update('organizationSize', e.target.value)}>
                  <option value="">Select size</option>
                  {ORG_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Engagement Type *</label>
              <div style={styles.engagementOptions}>
                {ENGAGEMENT_TYPES.map(et => (
                  <button
                    key={et.value}
                    type="button"
                    style={{
                      ...styles.engagementBtn,
                      ...(form.engagementType === et.value ? styles.engagementBtnActive : {})
                    }}
                    onClick={() => update('engagementType', et.value)}
                  >
                    {et.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.row}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">CIS IG Level</label>
                <select className="input" value={form.cisIgLevel} onChange={e => update('cisIgLevel', e.target.value)}>
                  <option value="">Select IG level</option>
                  {IG_LEVELS.map(ig => <option key={ig.value} value={ig.value}>{ig.label}</option>)}
                </select>
              </div>
            </div>

            <div style={styles.row}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Contract Start Date</label>
                <input className="input" type="date" value={form.contractStartDate}
                  onChange={e => update('contractStartDate', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Contract Renewal Date</label>
                <input className="input" type="date" value={form.contractRenewalDate}
                  onChange={e => update('contractRenewalDate', e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Contact */}
        {step === 2 && (
          <div className="animate-fade-in">
            <SectionHeader icon={<User size={16} />} label="Primary Contact" />

            <div className="form-group">
              <label className="label">Contact Name *</label>
              <input className="input" value={form.primaryContactName}
                onChange={e => update('primaryContactName', e.target.value)}
                placeholder="Jane Smith" />
            </div>

            <div style={styles.row}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Email Address *</label>
                <input className="input" type="email" value={form.primaryContactEmail}
                  onChange={e => update('primaryContactEmail', e.target.value)}
                  placeholder="jane@company.com" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Phone Number</label>
                <input className="input" type="tel" value={form.primaryContactPhone}
                  onChange={e => update('primaryContactPhone', e.target.value)}
                  placeholder="+1 (555) 000-0000" />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Address (Optional)</label>
              <input className="input" value={form.address}
                onChange={e => update('address', e.target.value)}
                placeholder="123 Main St, City, State, ZIP" />
            </div>

            <div className="form-group">
              <label className="label">Internal Notes</label>
              <textarea className="input" value={form.notes}
                onChange={e => update('notes', e.target.value)}
                placeholder="Internal context about this client, engagement details, etc."
                rows={4} style={{ resize: 'vertical' }} />
            </div>
          </div>
        )}

        {/* Step 3: Cadence */}
        {step === 3 && (
          <div className="animate-fade-in">
            <SectionHeader icon={<Calendar size={16} />} label="Check-in & Assessment Schedule" />

            <div className="form-group">
              <label className="label">Check-in Cadence</label>
              <div style={styles.engagementOptions}>
                {CHECKIN_CADENCES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    style={{
                      ...styles.engagementBtn,
                      ...(form.checkinCadence === c.value ? styles.engagementBtnActive : {})
                    }}
                    onClick={() => update('checkinCadence', c.value)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider" />
            <SectionHeader icon={<Settings size={16} />} label="Assessment Cadences" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ASSESSMENT_CADENCES.map(({ key, label }) => (
                <div key={key} style={styles.cadenceRow}>
                  <span style={styles.cadenceLabel}>{label}</span>
                  <select
                    className="input"
                    style={{ width: '160px' }}
                    value={form.assessmentCadences[key] || ''}
                    onChange={e => updateCadence(key, e.target.value)}
                  >
                    <option value="">Not scheduled</option>
                    {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {/* Actions */}
        <div style={styles.actions}>
          {step > 1 && (
            <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {step < 3 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
            >
              Continue
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Saving...' : initialData ? 'Save Changes' : 'Add Client'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
      <span style={{ color: 'var(--blue-primary)' }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', letterSpacing: '0.03em' }}>
        {label}
      </span>
    </div>
  );
}

const styles = {
  modal: { maxWidth: '680px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', letterSpacing: '0.03em' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: '4px', borderRadius: '6px'
  },
  steps: { display: 'flex', alignItems: 'center', gap: '0' },
  step: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1 },
  stepDot: {
    width: '28px', height: '28px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0,
  },
  stepLabel: { fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' },
  stepLine: { flex: 1, height: '1px', background: 'var(--border-subtle)', margin: '0 4px' },
  row: { display: 'flex', gap: '16px' },
  engagementOptions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  engagementBtn: {
    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)',
    background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
    fontSize: '13px', fontWeight: '500', transition: 'all 0.15s ease',
  },
  engagementBtnActive: {
    background: 'rgba(75,110,245,0.15)', color: 'var(--blue-light)',
    borderColor: 'var(--border-accent)',
  },
  cadenceRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px', border: '1px solid var(--border-subtle)',
  },
  cadenceLabel: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' },
  error: {
    padding: '10px 14px', background: 'rgba(255,59,92,0.1)',
    border: '1px solid rgba(255,59,92,0.3)', borderRadius: '8px',
    color: 'var(--critical)', fontSize: '13px', marginTop: '16px',
  },
  actions: { display: 'flex', gap: '8px', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' },
};
