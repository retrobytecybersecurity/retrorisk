import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Shield, Plus, TrendingUp, ChevronRight, CheckCircle, Clock, Trash2 } from 'lucide-react';
import CISAssessmentView from '../../components/cis/CISAssessmentView';

const IG_COLORS = { IG1: 'var(--health-green)', IG2: 'var(--blue-primary)', IG3: 'var(--purple-primary)' };

function ScoreRing({ score, size = 80 }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? 'var(--health-green)' : score >= 50 ? 'var(--medium)' : 'var(--critical)';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--navy-600)" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle"
        style={{ fontFamily: 'var(--font-display)', fontSize: size > 60 ? '16px' : '12px', fontWeight: 700, fill: color }}>
        {Math.round(score)}%
      </text>
    </svg>
  );
}

export default function CISPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get('client');

  const [clients, setClients]           = useState([]);
  const [selectedClient, setSelected]   = useState(null);
  const [assessments, setAssessments]   = useState([]);
  const [trendData, setTrendData]       = useState([]);
  const [activeAssessment, setActive]   = useState(null);
  const [loading, setLoading]           = useState(false);
  const [creating, setCreating]         = useState(false);

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
    setLoading(true);
    try {
      const [aRes, tRes] = await Promise.all([
        api.get(`/clients/${client.id}/cis/assessments`),
        api.get(`/clients/${client.id}/cis/trend`),
      ]);
      setAssessments(aRes.data);
      setTrendData(formatTrend(tRes.data));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function formatTrend(raw) {
    return raw.map(a => ({
      name: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      Score: parseFloat(a.overall_score),
    }));
  }

  async function refresh() {
    if (!selectedClient) return;
    const [aRes, tRes] = await Promise.all([
      api.get(`/clients/${selectedClient.id}/cis/assessments`),
      api.get(`/clients/${selectedClient.id}/cis/trend`),
    ]);
    setAssessments(aRes.data);
    setTrendData(formatTrend(tRes.data));
  }

  async function startNewAssessment() {
    if (!selectedClient) return;
    const igLevel = selectedClient.cisIgLevel || 'IG1';
    setCreating(true);
    try {
      const res = await api.post(`/clients/${selectedClient.id}/cis/assessments`, { igLevel });
      await refresh();
      // Open the new assessment immediately
      const detail = await api.get(`/cis/assessments/${res.data.id}`);
      setActive(detail.data);
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  }

  async function openAssessment(assessment) {
    try {
      const res = await api.get(`/cis/assessments/${assessment.id}`);
      setActive(res.data);
    } catch (err) { console.error(err); }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this assessment and all responses?')) return;
    await api.delete(`/cis/assessments/${id}`);
    await refresh();
    if (activeAssessment?.assessment?.id === id) setActive(null);
  }

  if (activeAssessment) {
    return (
      <CISAssessmentView
        assessmentData={activeAssessment}
        clientName={selectedClient?.organizationName}
        onBack={() => { setActive(null); refresh(); }}
        onUpdate={async () => {
          const res = await api.get(`/cis/assessments/${activeAssessment.assessment.id}`);
          setActive(res.data);
          await refresh();
        }}
      />
    );
  }

  return (
    <div style={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="section-title">CIS Controls v8</h1>
          <p style={styles.subtitle}>Guided assessment • IG-scoped safeguards • Maturity scoring</p>
        </div>
        {selectedClient && (
          <button className="btn btn-primary" onClick={startNewAssessment} disabled={creating}>
            <Plus size={15} />
            {creating ? 'Creating...' : 'Start New Assessment'}
          </button>
        )}
      </div>

      <div style={styles.layout}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div className="card" style={styles.sideCard}>
            <div style={styles.sideHeader}>
              <Shield size={15} color="var(--blue-primary)" />
              <span style={styles.sideTitle}>Select Client</span>
            </div>
            <div style={styles.clientList}>
              {clients.map(c => (
                <button key={c.id}
                  style={{ ...styles.clientBtn, ...(selectedClient?.id === c.id ? styles.clientBtnActive : {}) }}
                  onClick={() => selectClient(c)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.clientBtnName}>{c.organizationName}</div>
                    {c.cisIgLevel && <div style={{ fontSize: '10px', color: IG_COLORS[c.cisIgLevel] }}>{c.cisIgLevel}</div>}
                  </div>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          </div>

          {selectedClient && assessments.length > 0 && (
            <div className="card" style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <Clock size={15} color="var(--purple-primary)" />
                <span style={styles.sideTitle}>Assessment History</span>
              </div>
              <div style={{ padding: '8px' }}>
                {assessments.map(a => (
                  <div key={a.id}
                    style={{ ...styles.assessItem, ...(activeAssessment?.assessment?.id === a.id ? styles.assessItemActive : {}) }}
                    onClick={() => openAssessment(a)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.assessName}>{a.name}</div>
                      <div style={styles.assessMeta}>
                        {a.ig_level} • {a.assessed_safeguards}/{a.total_safeguards} assessed
                      </div>
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--navy-600)' }}>
                          <div style={{
                            width: `${a.total_safeguards > 0 ? (a.assessed_safeguards/a.total_safeguards)*100 : 0}%`,
                            height: '100%', borderRadius: '2px', background: 'var(--gradient-brand)',
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: getScoreColor(a.overall_score) }}>
                          {a.overall_score}%
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {a.status === 'completed'
                        ? <CheckCircle size={14} color="var(--health-green)" />
                        : <Clock size={14} color="var(--medium)" />}
                      <button style={styles.deleteBtn} onClick={e => handleDelete(a.id, e)} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={styles.main}>
          {!selectedClient ? (
            <EmptyState icon={<Shield size={40} />} message="Select a client to manage CIS v8 assessments" />
          ) : loading ? (
            <LoadingSkeleton />
          ) : assessments.length === 0 ? (
            <EmptyState
              icon={<Shield size={40} />}
              message={`No assessments yet for ${selectedClient.organizationName}`}
              action={
                <button className="btn btn-primary" onClick={startNewAssessment} disabled={creating}>
                  <Plus size={15} /> {creating ? 'Creating...' : 'Start First Assessment'}
                </button>
              }
            />
          ) : (
            <>
              {/* Score cards for last 3 assessments */}
              <div style={styles.scoreGrid}>
                {assessments.slice(0, 3).map((a, i) => (
                  <div key={a.id} className="card" style={{ ...styles.scoreCard, cursor: 'pointer', opacity: i === 0 ? 1 : 0.7 }}
                    onClick={() => openAssessment(a)}>
                    <div style={styles.scoreCardTop}>
                      <ScoreRing score={parseFloat(a.overall_score)} size={72} />
                      <div style={{ flex: 1 }}>
                        <div style={styles.scoreCardName}>{a.name}</div>
                        <div style={styles.scoreCardMeta}>{a.ig_level} • {a.total_safeguards} safeguards</div>
                        <div style={{ marginTop: '8px' }}>
                          <span style={{ ...styles.statusBadge, ...(a.status === 'completed' ? styles.statusDone : styles.statusProg) }}>
                            {a.status === 'completed' ? '✓ Completed' : '● In Progress'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{ width: `${a.total_safeguards > 0 ? (a.assessed_safeguards/a.total_safeguards)*100 : 0}%`,
                        height: '100%', borderRadius: '2px', background: 'var(--gradient-brand)' }} />
                    </div>
                    <div style={styles.progressLabel}>
                      {a.assessed_safeguards} of {a.total_safeguards} safeguards assessed
                    </div>
                  </div>
                ))}
              </div>

              {/* Trend graph */}
              {trendData.length > 1 && (
                <div className="card" style={styles.trendCard}>
                  <div style={styles.trendHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={16} color="var(--blue-primary)" />
                      <span style={styles.sideTitle}>Maturity Score Trend</span>
                    </div>
                  </div>
                  <div style={{ padding: '0 20px 20px' }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData} margin={{ top: 8, right: 24, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} unit="%" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ background: 'var(--navy-800)', border: '1px solid var(--border-accent)', borderRadius: '8px' }}
                          formatter={v => `${v}%`}
                        />
                        <Line type="monotone" dataKey="Score" stroke="var(--blue-primary)"
                          strokeWidth={2.5} dot={{ r: 4, fill: 'var(--blue-primary)' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Select prompt */}
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Shield size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <div>Select an assessment from the history panel to conduct or review it</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getScoreColor(score) {
  if (score >= 80) return 'var(--health-green)';
  if (score >= 50) return 'var(--medium)';
  return 'var(--critical)';
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
        {[1,2,3].map(i => <div key={i} className="card skeleton" style={{ height: '140px' }} />)}
      </div>
      <div className="card skeleton" style={{ height: '220px' }} />
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
  clientBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'left', gap: '8px' },
  clientBtnActive: { background: 'rgba(75,110,245,0.12)', color: 'var(--text-primary)' },
  clientBtnName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  assessItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent', marginBottom: '4px', transition: 'all 0.15s ease' },
  assessItemActive: { background: 'rgba(75,110,245,0.1)', borderColor: 'var(--border-accent)' },
  assessName: { fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  assessMeta: { fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.6, padding: '2px', display: 'flex' },
  scoreGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' },
  scoreCard: { padding: '20px' },
  scoreCardTop: { display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' },
  scoreCardName: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', marginBottom: '4px', lineHeight: 1.3 },
  scoreCardMeta: { fontSize: '11px', color: 'var(--text-muted)' },
  statusBadge: { fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '100px' },
  statusDone: { background: 'rgba(59,255,138,0.1)', color: 'var(--health-green)', border: '1px solid rgba(59,255,138,0.3)' },
  statusProg: { background: 'rgba(255,184,59,0.1)', color: 'var(--medium)', border: '1px solid rgba(255,184,59,0.3)' },
  progressBar: { height: '4px', borderRadius: '2px', background: 'var(--navy-600)', overflow: 'hidden', marginBottom: '6px' },
  progressLabel: { fontSize: '11px', color: 'var(--text-muted)' },
  trendCard: { overflow: 'hidden' },
  trendHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' },
};
