import React, { useState, useRef } from 'react';
import api from '../../utils/api';
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const PHISHING_TYPES = ['Credential Harvest','Malware Attachment','Link Click','Vishing','SMS Smishing'];

export default function ImportCampaignModal({ clientId, clientName, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name:         '',
    campaignDate: new Date().toISOString().split('T')[0],
    phishingType: '',
    pretext:      '',
    testingFirm:  '',
    emailsSent:   '',
  });
  const [csvFile, setCsvFile]   = useState(null);
  const [csvText, setCsvText]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);
  const fileRef = useRef();

  function update(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setError('Please select a .csv file'); return; }
    setCsvFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target.result);
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!form.name)         { setError('Campaign name is required'); return; }
    if (!form.phishingType) { setError('Select a phishing type'); return; }
    if (!form.campaignDate) { setError('Campaign date is required'); return; }
    if (!csvText)           { setError('Select a GoPhish CSV export'); return; }

    setLoading(true); setError('');
    try {
      const res = await api.post(`/clients/${clientId}/phishing/import`, {
        ...form,
        emailsSent: form.emailsSent ? parseInt(form.emailsSent) : undefined,
        csvData: csvText,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  const TREND_LABELS = {
    improving: { label: 'Improving vs prior', color: 'var(--health-green)' },
    declining: { label: 'Declining vs prior', color: 'var(--critical)' },
    neutral:   { label: 'Neutral vs prior',   color: 'var(--medium)' },
    first:     { label: 'First campaign',      color: 'var(--blue-primary)' },
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Import GoPhish Campaign</h2>
            <p style={styles.subtitle}>{clientName}</p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
        </div>

        {result ? (
          <div style={styles.successState}>
            <div style={styles.successIcon}><CheckCircle size={36} color="var(--health-green)" /></div>
            <h3 style={styles.successTitle}>Campaign Imported</h3>
            <p style={styles.successMsg}>{form.name}</p>

            <div style={styles.metricsGrid}>
              <MetricPill label="Targets" value={result.targetCount} color="var(--blue-primary)" />
              <MetricPill label="Click Rate" value={`${result.metrics.click_rate}%`} color="var(--critical)" />
              <MetricPill label="Submit Rate" value={`${result.metrics.submission_rate}%`} color="var(--high)" />
              <MetricPill label="Report Rate" value={`${result.metrics.report_rate}%`} color="var(--health-green)" />
            </div>

            {result.trendDirection && (
              <div style={{ ...styles.trendBadge, color: TREND_LABELS[result.trendDirection]?.color }}>
                {TREND_LABELS[result.trendDirection]?.label}
              </div>
            )}

            <button className="btn btn-primary" onClick={onSuccess} style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}>
              View Campaign
            </button>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="label">Campaign Name *</label>
              <input className="input" value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="e.g. Q2 2025 Credential Harvest Simulation" />
            </div>

            <div style={styles.row}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Campaign Date *</label>
                <input className="input" type="date" value={form.campaignDate}
                  onChange={e => update('campaignDate', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="label">Emails Sent</label>
                <input className="input" type="number" value={form.emailsSent}
                  onChange={e => update('emailsSent', e.target.value)}
                  placeholder="Auto from CSV if blank" />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Phishing Type *</label>
              <div style={styles.typeGrid}>
                {PHISHING_TYPES.map(t => (
                  <button key={t} type="button"
                    style={{ ...styles.typeBtn, ...(form.phishingType === t ? styles.typeBtnActive : {}) }}
                    onClick={() => update('phishingType', t)}
                  >{t}</button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="label">Pretext / Lure Description</label>
              <input className="input" value={form.pretext}
                onChange={e => update('pretext', e.target.value)}
                placeholder="e.g. IT password reset notification" />
            </div>

            <div className="form-group">
              <label className="label">Testing Firm</label>
              <input className="input" value={form.testingFirm}
                onChange={e => update('testingFirm', e.target.value)}
                placeholder="Retrobyte Cybersecurity or third party" />
            </div>

            <div className="form-group">
              <label className="label">GoPhish Results CSV *</label>
              <div
                style={{ ...styles.dropZone, ...(csvFile ? styles.dropZoneFilled : {}) }}
                onClick={() => fileRef.current.click()}
              >
                {csvFile ? (
                  <>
                    <FileText size={22} color="var(--blue-primary)" />
                    <div style={styles.fileName}>{csvFile.name}</div>
                    <div style={styles.fileSize}>{(csvFile.size / 1024).toFixed(1)} KB • {csvText.split('\n').length - 1} records</div>
                  </>
                ) : (
                  <>
                    <Upload size={22} color="var(--text-muted)" />
                    <div style={styles.dropText}>Click to select GoPhish CSV export</div>
                    <div style={styles.dropSub}>Campaign results → Export CSV</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>
            </div>

            {error && (
              <div style={styles.error}><AlertCircle size={14} />{error}</div>
            )}

            <div style={styles.actions}>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport}
                disabled={loading || !csvText || !form.name || !form.phishingType}>
                {loading ? 'Importing...' : 'Import Campaign'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricPill({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', letterSpacing: '0.03em' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' },
  row: { display: 'flex', gap: '16px' },
  typeGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  typeBtn: { padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.15s ease' },
  typeBtnActive: { background: 'rgba(75,110,245,0.15)', color: 'var(--blue-light)', borderColor: 'var(--border-accent)' },
  dropZone: { border: '2px dashed var(--border-subtle)', borderRadius: '10px', padding: '28px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  dropZoneFilled: { borderColor: 'var(--blue-primary)', background: 'rgba(75,110,245,0.06)' },
  dropText: { fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' },
  dropSub: { fontSize: '12px', color: 'var(--text-muted)' },
  fileName: { fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' },
  fileSize: { fontSize: '11px', color: 'var(--text-muted)' },
  error: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', borderRadius: '8px', color: 'var(--critical)', fontSize: '13px', marginBottom: '16px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' },
  successState: { textAlign: 'center', padding: '8px 0' },
  successIcon: { width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(59,255,138,0.1)', border: '1px solid rgba(59,255,138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
  successTitle: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', marginBottom: '6px' },
  successMsg: { color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' },
  metricsGrid: { display: 'flex', justifyContent: 'center', gap: '28px', flexWrap: 'wrap' },
  trendBadge: { marginTop: '16px', fontSize: '13px', fontWeight: '600' },
};
