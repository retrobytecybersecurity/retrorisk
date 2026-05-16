import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { ArrowLeft, Download, Plus, UserX, Trash2, Copy, CheckCircle } from 'lucide-react';
import ClientModal from '../clients/ClientModal';

const ENGAGEMENT_LABELS = {
  vciso_only: 'vCISO Only',
  vciso_assessments: 'vCISO + Assessments',
  assessments_only: 'Assessments Only',
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient]       = useState(null);
  const [users, setUsers]         = useState([]);
  const [scans, setScans]         = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [cisAssessments, setCis]  = useState([]);
  const [nistAssessments, setNist]= useState([]);
  const [loading, setLoading]     = useState(true);
  const [showEdit, setShowEdit]   = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [addingUser, setAddingUser]   = useState(false);
  const [linkCopied, setLinkCopied]  = useState(null);
  const [showOffboardConfirm, setShowOffboard] = useState(false);

  useEffect(() => { fetchAll(); }, [id]);

  async function fetchAll() {
    try {
      const [cRes, uRes, sRes, eRes, phRes, cisRes, nistRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/clients/${id}/users`),
        api.get(`/clients/${id}/vuln/scans`),
        api.get(`/clients/${id}/pentest/engagements`),
        api.get(`/clients/${id}/phishing/campaigns`),
        api.get(`/clients/${id}/cis/assessments`),
        api.get(`/clients/${id}/nist/assessments`),
      ]);
      setClient(cRes.data);
      setUsers(uRes.data);
      setScans(sRes.data);
      setEngagements(eRes.data);
      setCampaigns(phRes.data);
      setCis(cisRes.data);
      setNist(nistRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleAddUser() {
    if (!newUsername.trim()) return;
    setAddingUser(true);
    try {
      const res = await api.post('/users/client', { clientId: id, username: newUsername.trim() });
      setNewUsername('');
      await fetchAll();
      // Auto-generate link
      await generateLink(res.data.id);
    } catch (err) { alert(err.response?.data?.error || 'Failed to create user'); }
    finally { setAddingUser(false); }
  }

  async function generateLink(userId) {
    try {
      const res = await api.post('/auth/generate-link', { clientId: id, userId });
      await navigator.clipboard.writeText(res.data.link);
      setLinkCopied(userId);
      setTimeout(() => setLinkCopied(null), 3000);
    } catch (err) { alert('Failed to generate link'); }
  }

  async function deactivateUser(userId) {
    await api.patch(`/users/${userId}/deactivate`);
    await fetchAll();
  }

  async function deleteUser(userId) {
    if (!window.confirm('Delete this user account?')) return;
    await api.delete(`/users/${userId}`);
    await fetchAll();
  }

  async function handleOffboard() {
    await api.post(`/clients/${id}/offboard`);
    navigate('/clients');
  }

  function downloadReport(url, filename) {
    const a = document.createElement('a');
    a.href = `${process.env.REACT_APP_API_URL || '/api'}${url}`;
    a.download = filename;
    // Add auth header via fetch then trigger download
    fetch(a.href, { headers: { Authorization: `Bearer ${localStorage.getItem('retrorisk_token')}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  if (loading) return <div style={{ padding: '32px' }}><div className="skeleton" style={{ height: '400px', borderRadius: '12px' }} /></div>;
  if (!client) return <div style={{ padding: '32px', color: 'var(--text-muted)' }}>Client not found</div>;

  return (
    <div style={styles.page}>
      <button className="btn btn-ghost" onClick={() => navigate('/clients')} style={{ marginBottom: '24px', gap: '6px' }}>
        <ArrowLeft size={15} /> Back to Clients
      </button>

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.orgName}>{client.organizationName}</h1>
          <div style={styles.orgMeta}>
            {client.industry} • {ENGAGEMENT_LABELS[client.engagementType]} • {client.cisIgLevel || 'No IG set'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>Edit</button>
          <button className="btn btn-danger" onClick={() => setShowOffboard(true)}>Offboard</button>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Contact info */}
        <div className="card" style={styles.section}>
          <div style={styles.sectionTitle}>Primary Contact</div>
          <InfoRow label="Name"   value={client.primaryContactName} />
          <InfoRow label="Email"  value={client.primaryContactEmail} />
          <InfoRow label="Phone"  value={client.primaryContactPhone} />
          <InfoRow label="Address" value={client.address} />
        </div>

        {/* Contract */}
        <div className="card" style={styles.section}>
          <div style={styles.sectionTitle}>Engagement</div>
          <InfoRow label="Start"    value={client.contractStartDate   ? new Date(client.contractStartDate).toLocaleDateString()   : null} />
          <InfoRow label="Renewal"  value={client.contractRenewalDate ? new Date(client.contractRenewalDate).toLocaleDateString() : null} />
          <InfoRow label="Check-in" value={client.checkinCadence} />
          <InfoRow label="Status"   value={client.status} />
        </div>
      </div>

      {/* Notes */}
      {client.notes && (
        <div className="card" style={{ ...styles.section, marginTop: '16px' }}>
          <div style={styles.sectionTitle}>Internal Notes</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{client.notes}</div>
        </div>
      )}

      {/* Report Downloads */}
      <div className="card" style={{ ...styles.section, marginTop: '16px' }}>
        <div style={styles.sectionTitle}>📄 Report Downloads</div>
        <div style={styles.reportGrid}>
          {scans.slice(0, 3).map(s => (
            <ReportButton key={s.id} label={`Vuln Scan — ${new Date(s.imported_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
              onClick={() => downloadReport(`/clients/${id}/reports/vuln/${s.id}`, `VulnScan_${client.organizationName}.pdf`)} />
          ))}
          {engagements.slice(0, 3).map(e => (
            <ReportButton key={e.id} label={`Pen Test — ${e.name.slice(0, 30)}`}
              onClick={() => downloadReport(`/clients/${id}/reports/pentest/${e.id}`, `PenTest_${client.organizationName}.pdf`)} />
          ))}
          {campaigns.slice(0, 2).map(c => (
            <ReportButton key={c.id} label={`Phishing — ${new Date(c.campaign_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
              onClick={() => downloadReport(`/clients/${id}/reports/phishing/${c.id}`, `Phishing_${client.organizationName}.pdf`)} />
          ))}
          {cisAssessments.slice(0, 2).map(a => (
            <ReportButton key={a.id} label={`CIS v8 — ${new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
              onClick={() => downloadReport(`/clients/${id}/reports/cis/${a.id}`, `CIS_${client.organizationName}.pdf`)} />
          ))}
          {nistAssessments.slice(0, 2).map(a => (
            <ReportButton key={a.id} label={`NIST CSF 2.0 — ${new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
              onClick={() => downloadReport(`/clients/${id}/reports/nist/${a.id}`, `NIST_${client.organizationName}.pdf`)} />
          ))}
          <ReportButton label="Remediation Roadmap"
            onClick={() => downloadReport(`/clients/${id}/reports/roadmap`, `Roadmap_${client.organizationName}.pdf`)} />
        </div>
      </div>

      {/* User accounts */}
      <div className="card" style={{ ...styles.section, marginTop: '16px' }}>
        <div style={styles.sectionTitle}>Portal User Accounts</div>
        {users.map(u => (
          <div key={u.id} style={styles.userRow}>
            <div style={styles.userInfo}>
              <span style={styles.username2}>{u.username}</span>
              <span style={{ ...styles.userStatus, color: u.is_active ? 'var(--health-green)' : 'var(--text-muted)' }}>
                {u.is_active ? 'Active' : 'Inactive'}
              </span>
              {u.last_login && <span style={styles.lastLogin}>Last login: {new Date(u.last_login).toLocaleDateString()}</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '11px', gap: '4px' }}
                onClick={() => generateLink(u.id)} title="Generate new activation link">
                {linkCopied === u.id ? <><CheckCircle size={12} /> Copied!</> : <><Copy size={12} /> Link</>}
              </button>
              {u.is_active && (
                <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => deactivateUser(u.id)}>
                  <UserX size={12} />
                </button>
              )}
              <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '11px' }}
                onClick={() => deleteUser(u.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {/* Add user */}
        <div style={styles.addUserRow}>
          <input className="input" style={{ flex: 1, fontSize: '13px' }}
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="New username..."
            onKeyDown={e => e.key === 'Enter' && handleAddUser()} />
          <button className="btn btn-primary" style={{ gap: '6px', fontSize: '13px' }}
            onClick={handleAddUser} disabled={addingUser || !newUsername.trim()}>
            <Plus size={14} />{addingUser ? 'Creating...' : 'Add User'}
          </button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
          Activation link auto-copied to clipboard after user creation
        </div>
      </div>

      {/* Offboard confirm */}
      {showOffboardConfirm && (
        <div className="modal-overlay" onClick={() => setShowOffboard(false)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '12px', color: 'var(--critical)' }}>
              Offboard {client.organizationName}?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
              Client portal access will be revoked immediately. Data will be retained for 30 days, then a deletion task will appear on your dashboard.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-ghost" onClick={() => setShowOffboard(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleOffboard}>Confirm Offboard</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <ClientModal
          initialData={client}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', minWidth: '70px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function ReportButton({ label, onClick }) {
  return (
    <button className="btn btn-ghost" style={{ gap: '8px', fontSize: '12px', justifyContent: 'flex-start' }} onClick={onClick}>
      <Download size={13} color="var(--blue-primary)" />
      {label}
    </button>
  );
}

const styles = {
  page: { padding: '32px', maxWidth: '1000px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  orgName: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', marginBottom: '6px' },
  orgMeta: { fontSize: '13px', color: 'var(--text-muted)' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  section: { padding: '20px' },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', letterSpacing: '0.03em', marginBottom: '16px', color: 'var(--blue-primary)' },
  reportGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  userRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px' },
  username2: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' },
  userStatus: { fontSize: '11px', fontWeight: '600' },
  lastLogin: { fontSize: '11px', color: 'var(--text-muted)' },
  addUserRow: { display: 'flex', gap: '10px', marginTop: '16px' },
};
