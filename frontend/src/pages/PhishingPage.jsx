import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Mail, Plus, TrendingUp, TrendingDown, Minus, ChevronRight, Trash2, Users } from 'lucide-react';
import ImportCampaignModal from '../../components/phishing/ImportCampaignModal';
import CampaignDetail from '../../components/phishing/CampaignDetail';
import RepeatOffenders from '../../components/phishing/RepeatOffenders';

const TYPE_COLORS = {
  'Credential Harvest': 'var(--critical)',
  'Malware Attachment': 'var(--high)',
  'Link Click':         'var(--medium)',
  'Vishing':            'var(--blue-primary)',
  'SMS Smishing':       'var(--purple-primary)',
};

const TREND_CONFIG = {
  improving: { icon: <TrendingUp size={16} />,  color: 'var(--health-green)', label: 'Improving' },
  declining: { icon: <TrendingDown size={16} />, color: 'var(--critical)',     label: 'Declining' },
  neutral:   { icon: <Minus size={16} />,        color: 'var(--medium)',       label: 'Neutral' },
  first:     { icon: <Mail size={16} />,         color: 'var(--blue-primary)', label: 'First Campaign' },
};

export default function PhishingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get('client');

  const [clients, setClients]         = useState([]);
  const [selectedClient, setSelected] = useState(null);
  const [campaigns, setCampaigns]     = useState([]);
  const [trendData, setTrendData]     = useState([]);
  const [activeCampaign, setActive]   = useState(null);
  const [showImport, setShowImport]   = useState(false);
  const [showOffenders, setShowOffenders] = useState(false);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    api.get('/clients').then(r => {
      setClients(r.data);
      if (clientId) {
        const found = r.data.find(c => c.id === clientId);
        if (found) selectClient(found);
      }
    });
  }, []);

  async function selectClient(client) {
    setSelected(client);
    setSearchParams({ client: client.id });
    setActive(null);
    setShowOffenders(false);
    setLoading(true);
    try {
      const [camRes, trendRes] = await Promise.all([
        api.get(`/clients/${client.id}/phishing/campaigns`),
        api.get(`/clients/${client.id}/phishing/trend`),
      ]);
      setCampaigns(camRes.data);
      setTrendData(formatTrend(trendRes.data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function formatTrend(raw) {
    return raw.map(c => ({
      name: new Date(c.campaign_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      'Click Rate':      parseFloat(c.click_rate),
      'Submission Rate': parseFloat(c.submission_rate),
      'Report Rate':     parseFloat(c.report_rate),
    }));
  }

  async function refresh() {
    if (!selectedClient) return;
    const [camRes, trendRes] = await Promise.all([
      api.get(`/clients/${selectedClient.id}/phishing/campaigns`),
      api.get(`/clients/${selectedClient.id}/phishing/trend`),
    ]);
    setCampaigns(camRes.data);
    setTrendData(formatTrend(trendRes.data));
  }

  async function handleDelete(campaignId, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this campaign and all target data?')) return;
    await api.delete(`/phishing/campaigns/${campaignId}`);
    await refresh();
    if (activeCampaign?.id === campaignId) setActive(null);
  }

  // Latest campaign for dashboard trend arrow
  const latest = campaigns[0];
  const trendConf = latest ? (TREND_CONFIG[latest.trend_direction] || TREND_CONFIG.neutral) : null;

  return (
    <div style={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="section-title">Phishing Assessments</h1>
          <p style={styles.subtitle}>GoPhish CSV import • Behavioral metrics • Training workflow</p>
        </div>
        {selectedClient && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {campaigns.length > 0 && (
              <button className="btn btn-secondary" onClick={() => { setShowOffenders(!showOffenders); setActive(null); }}>
                <Users size={15} />
                {showOffenders ? 'Hide' : 'Repeat Offenders'}
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setShowImport(true)}>
              <Plus size={15} />
              Import Campaign
            </button>
          </div>
        )}
      </div>

      <div style={styles.layout}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          {/* Client selector */}
          <div className="card" style={styles.sideCard}>
            <div style={styles.sideHeader}>
              <Mail size={15} color="var(--blue-primary)" />
              <span style={styles.sideTitle}>Select Client</span>
            </div>
            <div style={styles.clientList}>
              {clients.map(c => (
                <button
                  key={c.id}
                  style={{ ...styles.clientBtn, ...(selectedClient?.id === c.id ? styles.clientBtnActive : {}) }}
                  onClick={() => selectClient(c)}
                >
                  <span style={styles.clientBtnName}>{c.organizationName}</span>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          </div>

          {/* Campaign history */}
          {selectedClient && campaigns.length > 0 && (
            <div className="card" style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <Mail size={15} color="var(--purple-primary)" />
                <span style={styles.sideTitle}>Campaigns</span>
              </div>
              <div style={{ padding: '8px' }}>
                {campaigns.map(c => {
                  const tc = TREND_CONFIG[c.trend_direction] || TREND_CONFIG.neutral;
                  return (
                    <div
                      key={c.id}
                      style={{ ...styles.campItem, ...(activeCampaign?.id === c.id ? styles.campItemActive : {}) }}
                      onClick={() => { setActive(c); setShowOffenders(false); }}
                    >
                      <div style={styles.campTop}>
                        <span style={{ ...styles.campType, color: TYPE_COLORS[c.phishing_type] || 'var(--blue-primary)' }}>
                          {c.phishing_type}
                        </span>
                        <button style={styles.deleteBtn} onClick={e => handleDelete(c.id, e)} title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div style={styles.campName}>{c.name}</div>
                      <div style={styles.campDate}>{new Date(c.campaign_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div style={styles.campMetrics}>
                        <span style={styles.campMetric}>
                          Click: <strong style={{ color: parseFloat(c.click_rate) > 20 ? 'var(--critical)' : 'var(--text-primary)' }}>{c.click_rate}%</strong>
                        </span>
                        <span style={{ ...styles.trendPill, color: tc.color, background: `${tc.color}15` }}>
                          {tc.icon} {tc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={styles.main}>
          {!selectedClient ? (
            <EmptyState icon={<Mail size={40} />} message="Select a client to view phishing assessments" />
          ) : loading ? (
            <LoadingSkeleton />
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={<Mail size={40} />}
              message="No phishing campaigns imported yet"
              action={<button className="btn btn-primary" onClick={() => setShowImport(true)}><Plus size={15} /> Import First Campaign</button>}
            />
          ) : showOffenders ? (
            <RepeatOffenders clientId={selectedClient.id} />
          ) : (
            <>
              {/* Latest campaign summary cards */}
              {latest && (
                <div style={styles.metricsGrid}>
                  <MetricCard label="Click Rate"      value={`${latest.click_rate}%`}      sub={`${latest.clicked} of ${latest.emails_sent}`} color={parseFloat(latest.click_rate) > 20 ? 'var(--critical)' : 'var(--health-green)'} />
                  <MetricCard label="Submission Rate" value={`${latest.submission_rate}%`} sub={`${latest.submitted} submitted data`}          color={parseFloat(latest.submission_rate) > 10 ? 'var(--critical)' : 'var(--medium)'} />
                  <MetricCard label="Report Rate"     value={`${latest.report_rate}%`}     sub={`${latest.reported} reported it`}              color="var(--health-green)" />
                  <MetricCard label="Open Rate"       value={`${latest.open_rate}%`}       sub={`${latest.opened} opened`}                     color="var(--blue-primary)" />
                  <div className="card" style={{ ...styles.trendArrowCard, borderColor: `${trendConf?.color}30` }}>
                    <div style={{ color: trendConf?.color, marginBottom: '8px' }}>{trendConf?.icon}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', color: trendConf?.color }}>{trendConf?.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>vs prior campaign</div>
                  </div>
                </div>
              )}

              {/* Trend graph */}
              {trendData.length > 1 && (
                <div className="card" style={styles.trendCard}>
                  <div style={styles.trendHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={16} color="var(--blue-primary)" />
                      <span style={styles.sideTitle}>Campaign Trends</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{trendData.length} campaigns</span>
                  </div>
                  <div style={{ padding: '0 20px 20px' }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={trendData} margin={{ top: 8, right: 24, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ background: 'var(--navy-800)', border: '1px solid var(--border-accent)', borderRadius: '8px' }}
                          labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                          formatter={(v) => `${v}%`}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                        <Line type="monotone" dataKey="Click Rate"      stroke="var(--critical)"      strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="Submission Rate" stroke="var(--high)"          strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="Report Rate"     stroke="var(--health-green)"  strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Campaign detail */}
              {activeCampaign ? (
                <CampaignDetail campaign={activeCampaign} onUpdate={refresh} />
              ) : (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Mail size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <div>Select a campaign to view target details and manage training</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showImport && selectedClient && (
        <ImportCampaignModal
          clientId={selectedClient.id}
          clientName={selectedClient.organizationName}
          onClose={() => setShowImport(false)}
          onSuccess={async () => { setShowImport(false); await refresh(); }}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="card" style={styles.metricCard}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '700', color, lineHeight: 1, marginBottom: '6px' }}>{value}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

function EmptyState({ icon, message, action }) {
  return (
    <div style={{ padding: '80px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      <div style={{ opacity: 0.3, color: 'var(--text-muted)' }}>{icon}</div>
      <div style={{ color: 'var(--text-muted)' }}>{message}</div>
      {action}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
        {[1,2,3,4,5].map(i => <div key={i} className="card skeleton" style={{ height: '90px' }} />)}
      </div>
      <div className="card skeleton" style={{ height: '260px' }} />
      <div className="card skeleton" style={{ height: '400px' }} />
    </div>
  );
}

const styles = {
  page: { padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  layout: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '16px' },
  main: { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 },
  sideCard: { overflow: 'hidden' },
  sideHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' },
  sideTitle: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', letterSpacing: '0.03em' },
  clientList: { padding: '8px' },
  clientBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px', borderRadius: '6px', background: 'transparent',
    border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'left',
  },
  clientBtnActive: { background: 'rgba(75,110,245,0.12)', color: 'var(--text-primary)' },
  clientBtnName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  campItem: { padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent', marginBottom: '4px', transition: 'all 0.15s ease' },
  campItemActive: { background: 'rgba(75,110,245,0.1)', borderColor: 'var(--border-accent)' },
  campTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' },
  campType: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' },
  campName: { fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  campDate: { fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' },
  campMetrics: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  campMetric: { fontSize: '11px', color: 'var(--text-muted)' },
  trendPill: { display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '100px' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.6, padding: '2px', display: 'flex', alignItems: 'center' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' },
  metricCard: { padding: '20px' },
  trendArrowCard: { padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid', textAlign: 'center' },
  trendCard: { overflow: 'hidden' },
  trendHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' },
};
