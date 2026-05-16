import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Plus, Search, ChevronRight, Building2 } from 'lucide-react';
import ClientModal from '../components/clients/ClientModal';

const HEALTH_LABELS = { red: 'At Risk', amber: 'Needs Attention', green: 'On Track' };
const ENGAGEMENT_LABELS = {
  vciso_only: 'vCISO Only',
  vciso_assessments: 'vCISO + Assessments',
  assessments_only: 'Assessments Only'
};

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchClients(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      clients.filter(c =>
        c.organizationName.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.primaryContactName?.toLowerCase().includes(q)
      )
    );
  }, [search, clients]);

  async function fetchClients() {
    try {
      const res = await api.get('/clients');
      setClients(res.data);
      setFiltered(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleClientCreated() {
    setShowModal(false);
    fetchClients();
  }

  return (
    <div style={styles.page} className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">Clients</h1>
          <p style={styles.subtitle}>{clients.length} active engagement{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} />
          Add Client
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrapper}>
        <Search size={15} color="var(--text-muted)" style={styles.searchIcon} />
        <input
          className="input"
          style={styles.searchInput}
          placeholder="Search clients, industry, contact..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Client list */}
      <div className="card" style={styles.tableCard}>
        {loading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            <Building2 size={40} color="var(--text-muted)" style={{ marginBottom: 12 }} />
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {search ? 'No clients match your search' : 'No clients yet. Add your first client.'}
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Industry</th>
                <th>Engagement</th>
                <th>Last Assessment</th>
                <th>Health</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => (
                <tr
                  key={client.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <td>
                    <div style={styles.clientName}>{client.organizationName}</div>
                    <div style={styles.clientContact}>{client.primaryContactName}</div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{client.industry}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {ENGAGEMENT_LABELS[client.engagementType] || client.engagementType}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {getLastAssessment(client)}
                  </td>
                  <td>
                    <HealthBadge status={client.healthStatus} />
                  </td>
                  <td>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ClientModal
          onClose={() => setShowModal(false)}
          onSuccess={handleClientCreated}
        />
      )}
    </div>
  );
}

function HealthBadge({ status }) {
  const s = status || 'green';
  return (
    <span className={`badge badge-${s}`}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: `var(--health-${s})`,
        display: 'inline-block',
        marginRight: '5px',
        boxShadow: `0 0 6px var(--health-${s})`
      }} />
      {HEALTH_LABELS[s]}
    </span>
  );
}

function getLastAssessment(client) {
  const dates = [
    client.lastVulnScan,
    client.lastCisAssessment,
    client.lastNistAssessment,
    client.lastPentest,
    client.lastPhishing
  ].filter(Boolean).map(d => new Date(d));

  if (dates.length === 0) return 'Never';
  const latest = new Date(Math.max(...dates));
  return latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '20px' }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
          <div className="skeleton" style={{ height: 16, flex: 2 }} />
          <div className="skeleton" style={{ height: 16, flex: 1 }} />
          <div className="skeleton" style={{ height: 16, flex: 1 }} />
          <div className="skeleton" style={{ height: 16, width: 80 }} />
        </div>
      ))}
    </div>
  );
}

const styles = {
  page: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  searchWrapper: { position: 'relative', marginBottom: '20px' },
  searchIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' },
  searchInput: { paddingLeft: '40px' },
  tableCard: { overflow: 'hidden' },
  clientName: { fontWeight: '500', marginBottom: '2px' },
  clientContact: { fontSize: '11px', color: 'var(--text-muted)' },
  empty: {
    padding: '64px 32px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
};
