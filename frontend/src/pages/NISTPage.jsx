import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { Shield, Plus, TrendingUp, ChevronRight, CheckCircle, Clock, Trash2 } from 'lucide-react';
import NISTAssessmentView from '../../components/nist/NISTAssessmentView';

const FUNCTION_COLORS = {
  GV: '#9b4bf5', ID: '#4b6ef5', PR: '#00c2ff',
  DE: '#ffb83b', RS: '#ff7b3b', RC: '#3bff8a'
};

const TIER_LABELS = {
  0: 'Not Assessed',
  1: 'Tier 1 — Partial',
  2: 'Tier 2 — Risk Informed',
  3: 'Tier 3 — Repeatable',
  4: 'Tier 4 — Adaptive',
};

function TierGauge({ value, max = 4, size = 80 }) {
  const pct = (value / max) * 100;
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  const color = value >= 3 ? 'var(--health-green)' : value >= 2 ? 'var(--medium)' : value >= 1 ? 'var(--high)' : 'var(--text-muted)';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--navy-600)" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size/2} y={size/2 + 1} textAnchor="middle"
        style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, fill: color }}>
        {value.toFixed(1)}
      </text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle"
        style={{ fontSize: '9px', fill: 'var(--text-muted)' }}>/ 4.0</text>
    </svg>
  );
}

export default function NISTPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get('client');

  const [clients, setClients]         = useState([]);
  const [selectedClient, setSelected] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [trendData, setTrendData]     = useState([]);
  const [activeAssessment, setActive] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [creating, setCreating]       = useState(false);

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
        api.get(`/clients/${client.id}/nist/assessments`),
        api.get(`/clients/${client.id}/nist/trend`),
      ]);
      setAssessments(aRes.data);
      setTrendData(formatTrend(tRes.data));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function formatTrend(raw) {
    return raw.map(a => ({
      name: new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      Current: parseFloat(a.overall_current),
      Target: parseFloat(a.overall_target),
    }));
  }

  async function refresh() {
    if (!selectedClient) return;
    const [aRes, tRes] = await Promise.all([
      api.get(`/clients/${selectedClient.id}/nist/assessments`),
      api.get(`/clients/${selectedClient.id}/nist/trend`),
    ]);
    setAssessments(aRes.data);
    setTrendData(formatTrend(tRes.data));
  }

  async function startNew() {
    if (!selectedClient) return;
    setCreating(true);
    try {
      const res = await api.post(`/clients/${selectedClient.id}/nist/assessments`, {});
      await refresh();
      const detail = await api.get(`/nist/assessments/${res.data.id}`);
      setActive(detail.data);
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  }

  async function openAssessment(a) {
    const res = await api.get(`/nist/assessments/${a.id}`);
    setActive(res.data);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this assessment and all responses?')) return;
    await api.delete(`/nist/assessments/${id}`);
    await refresh();
    if (activeAssessment?.assessment?.id === id) setActive(null);
  }

  // Build radar data from latest assessment
  const latest = assessments[0];
  const radarData = latest && latest.function_scores
    ? Object.entries(typeof latest.function_scores === 'string'
        ? JSON.parse(latest.function_scores) : latest.function_scores)
      .map(([fn, scores]) => ({
        function: fn,
        Current: scores.current || 0,
        Target:  scores.target  || 0,
      }))
    : [];

  if (activeAssessment) {
    return (
      <NISTAssessmentView
        assessmentData={activeAssessment}
        clientName={selectedClient?.organizationName}
        onBack={() => { setActive(null); refresh(); }}
        onUpdate={async () => {
          const res = await api.get(`/nist/assessments/${activeAssessment.assessment.id}`);
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
          <h1 className="section-title">NIST CSF 2.0</h1>
          <p style={styles.subtitle}>Guided assessment • Current vs Target tiers • Gap analysis • 0–4.0 maturity scale</p>
        </div>
        {selectedClient && (
          <button className="btn btn-primary" onClick={startNew} disabled={creating}>
            <Plus size={15} />{creating ? 'Creating...' : 'Start New Assessment'}
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
                  <span style={styles.clientBtnName}>{c.organizationName}</span>
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
                      <div style={styles.assessMeta}>{a.assessed_subcategories}/{a.total_subcategories} assessed</div>
                      <div style={styles.assessScores}>
                        <span style={{ color: 'var(--blue-primary)', fontWeight: 700, fontSize: '11px' }}>
                          Current: {parseFloat(a.overall_current).toFixed(1)}
                        </span>
                        <span style={{ color: 'var(--purple-primary)', fontWeight: 700, fontSize: '11px' }}>
                          Target: {parseFloat(a.overall_target).toFixed(1)}
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
            <EmptyState icon={<Shield size={40} />} message="Select a client to manage NIST CSF 2.0 assessments" />
          ) : loading ? (
            <LoadingSkeleton />
          ) : assessments.length === 0 ? (
            <EmptyState
              icon={<Shield size={40} />}
              message={`No assessments yet for ${selectedClient.organizationName}`}
              action={<button className="btn btn-primary" onClick={startNew} disabled={creating}><Plus size={15} />{creating ? 'Creating...' : 'Start First Assessment'}</button>}
            />
          ) : (
            <>
              {/* Latest assessment score cards */}
              {latest && (
                <div style={styles.scoreRow}>
                  <div className="card" style={styles.overallCard}>
                    <div style={styles.overallTop}>
                      <div>
                        <div style={styles.overallLabel}>Overall Current Maturity</div>
                        <div style={styles.overallSub}>{latest.name}</div>
                      </div>
                      <TierGauge value={parseFloat(latest.overall_current)} size={80} />
                    </div>
                    <div style={styles.gapRow}>
                      <div style={styles.gapItem}>
                        <div style={styles.gapLabel}>Target</div>
                        <div style={{ ...styles.gapValue, color: 'var(--purple-primary)' }}>
                          {parseFloat(latest.overall_target).toFixed(1)}
                        </div>
                      </div>
                      <div style={styles.gapItem}>
                        <div style={styles.gapLabel}>Gap</div>
                        <div style={{ ...styles.gapValue, color: 'var(--medium)' }}>
                          {Math.max(0, parseFloat(latest.overall_target) - parseFloat(latest.overall_current)).toFixed(1)}
                        </div>
                      </div>
                      <div style={styles.gapItem}>
                        <div style={styles.gapLabel}>Assessed</div>
                        <div style={{ ...styles.gapValue, color: 'var(--text-primary)' }}>
                          {latest.assessed_subcategories}/{latest.total_subcategories}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Radar chart */}
                  {radarData.length > 0 && (
                    <div className="card" style={styles.radarCard}>
                      <div style={styles.radarHeader}>
                        <span style={styles.sideTitle}>Function Maturity Profile</span>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                          <PolarGrid stroke="rgba(255,255,255,0.08)" />
                          <PolarAngleAxis dataKey="function"
                            tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 4]}
                            tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickCount={5} />
                          <Radar name="Current" dataKey="Current" stroke="var(--blue-primary)"
                            fill="var(--blue-primary)" fillOpacity={0.2} strokeWidth={2} />
                          <Radar name="Target" dataKey="Target" stroke="var(--purple-primary)"
                            fill="var(--purple-primary)" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 2" />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Function breakdown */}
              {latest && latest.function_scores && (
                <FunctionBreakdown scores={
                  typeof latest.function_scores === 'string'
                    ? JSON.parse(latest.function_scores)
                    : latest.function_scores
                } />
              )}

              {/* Trend graph */}
              {trendData.length > 1 && (
                <div className="card" style={styles.trendCard}>
                  <div style={styles.trendHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={16} color="var(--blue-primary)" />
                      <span style={styles.sideTitle}>Maturity Trend — Current vs Target</span>
                    </div>
                  </div>
                  <div style={{ padding: '0 20px 20px' }}>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={trendData} margin={{ top: 8, right: 24, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} domain={[0, 4]} tickCount={5} />
                        <Tooltip
                          contentStyle={{ background: 'var(--navy-800)', border: '1px solid var(--border-accent)', borderRadius: '8px' }}
                          formatter={v => v.toFixed(2)}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                        <Line type="monotone" dataKey="Current" stroke="var(--blue-primary)" strokeWidth={2.5} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="Target" stroke="var(--purple-primary)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Shield size={28} style={{ marginBottom: '10px', opacity: 0.3 }} />
                <div>Select an assessment from the history panel to conduct or review it</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FunctionBreakdown({ scores }) {
  const FUNCTION_META = {
    GV: { title: 'Govern',   color: '#9b4bf5' },
    ID: { title: 'Identify', color: '#4b6ef5' },
    PR: { title: 'Protect',  color: '#00c2ff' },
    DE: { title: 'Detect',   color: '#ffb83b' },
    RS: { title: 'Respond',  color: '#ff7b3b' },
    RC: { title: 'Recover',  color: '#3bff8a' },
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', letterSpacing: '0.03em' }}>
        Function Breakdown
      </div>
      <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
        {Object.entries(FUNCTION_META).map(([fn, meta]) => {
          const s = scores[fn] || { current: 0, target: 0, assessed: 0, total: 0 };
          const gap = Math.max(0, s.target - s.current);
          const barWidth = (s.current / 4) * 100;
          const targetWidth = (s.target / 4) * 100;
          return (
            <div key={fn} style={{ padding: '14px', background: 'var(--navy-800)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: meta.color, marginRight: '6px' }}>{fn}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{meta.title}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: meta.color }}>
                  {s.current.toFixed(1)}
                </span>
              </div>
              {/* Current bar */}
              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--navy-600)', position: 'relative', marginBottom: '4px' }}>
                <div style={{ width: `${barWidth}%`, height: '100%', borderRadius: '3px', background: meta.color, transition: 'width 0.5s ease' }} />
                {/* Target marker */}
                {s.target > 0 && (
                  <div style={{ position: 'absolute', top: '-3px', left: `${targetWidth}%`, width: '2px', height: '12px', background: 'var(--purple-primary)', borderRadius: '1px', transform: 'translateX(-50%)' }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                <span>Target: <strong style={{ color: 'var(--purple-primary)' }}>{s.target.toFixed(1)}</strong></span>
                {gap > 0 && <span>Gap: <strong style={{ color: 'var(--medium)' }}>{gap.toFixed(1)}</strong></span>}
                <span>{s.assessed}/{s.total}</span>
              </div>
            </div>
          );
        })}
      </div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card skeleton" style={{ height: '160px' }} />
        <div className="card skeleton" style={{ height: '260px' }} />
      </div>
      <div className="card skeleton" style={{ height: '140px' }} />
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
  clientBtnName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  assessItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid transparent', marginBottom: '4px', transition: 'all 0.15s ease' },
  assessItemActive: { background: 'rgba(75,110,245,0.1)', borderColor: 'var(--border-accent)' },
  assessName: { fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' },
  assessMeta: { fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' },
  assessScores: { display: 'flex', gap: '10px' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.6, padding: '2px', display: 'flex' },
  scoreRow: { display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' },
  overallCard: { padding: '20px' },
  overallTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  overallLabel: { fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700', marginBottom: '4px' },
  overallSub: { fontSize: '12px', color: 'var(--text-muted)' },
  gapRow: { display: 'flex', gap: '24px' },
  gapItem: {},
  gapLabel: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' },
  gapValue: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700' },
  radarCard: { overflow: 'hidden' },
  radarHeader: { padding: '14px 20px 8px' },
  trendCard: { overflow: 'hidden' },
  trendHeader: { padding: '16px 20px 12px' },
};
