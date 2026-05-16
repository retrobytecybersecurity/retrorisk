import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { Map, Plus, ChevronRight, Filter, CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';
import RoadmapDonut from '../components/roadmap/RoadmapDonut';
import RoadmapItem from '../components/roadmap/RoadmapItem';
import AddItemModal from '../components/roadmap/AddItemModal';
import PromoteModal from '../components/roadmap/PromoteModal';

const SOURCES   = ['All','CIS','NIST','Pen Test','Vuln Scan','Phishing','Manual'];
const PRIORITIES= ['All','Critical','High','Medium','Low','Informational'];
const STATUSES  = ['All','Open','In Progress','Completed','Risk Accepted'];
const PHASES    = ['All','Quick Win','Short Term','Long Term'];

const PRIORITY_ORDER = { Critical:1, High:2, Medium:3, Low:4, Informational:5 };

const SOURCE_COLORS = {
  CIS: 'var(--blue-primary)', NIST: 'var(--purple-primary)',
  'Pen Test': 'var(--critical)', 'Vuln Scan': 'var(--high)',
  Phishing: 'var(--medium)', Manual: 'var(--text-muted)',
};

export default function RoadmapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get('client');

  const [clients, setClients]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [items, setItems]           = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [editItem, setEditItem]     = useState(null);

  // Filters
  const [filterSource,   setFilterSource]   = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStatus,   setFilterStatus]   = useState('All');
  const [filterPhase,    setFilterPhase]    = useState('All');

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
    setLoading(true);
    try {
      await fetchItems(client.id);
    } finally { setLoading(false); }
  }

  async function fetchItems(cId) {
    const id = cId || selected?.id;
    if (!id) return;
    const [itemsRes, summaryRes] = await Promise.all([
      api.get(`/clients/${id}/roadmap`),
      api.get(`/clients/${id}/roadmap/summary`),
    ]);
    setItems(itemsRes.data);
    setSummary(summaryRes.data);
  }

  async function refresh() { await fetchItems(); }

  // Apply local filters
  const filtered = items.filter(item => {
    if (filterSource   !== 'All' && item.source   !== filterSource)   return false;
    if (filterPriority !== 'All' && item.priority  !== filterPriority) return false;
    if (filterStatus   !== 'All' && item.status    !== filterStatus)   return false;
    if (filterPhase    !== 'All' && item.phase     !== filterPhase)    return false;
    return true;
  });

  // Group by source then priority
  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.source]) grouped[item.source] = [];
    grouped[item.source].push(item);
  }
  for (const src of Object.keys(grouped)) {
    grouped[src].sort((a, b) => (PRIORITY_ORDER[a.priority] || 9) - (PRIORITY_ORDER[b.priority] || 9));
  }

  const sourceOrder = ['CIS','NIST','Pen Test','Vuln Scan','Phishing','Manual'];

  return (
    <div style={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="section-title">Remediation Roadmap</h1>
          <p style={styles.subtitle}>All framework findings in one prioritized action plan</p>
        </div>
        {selected && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setShowPromote(true)}>
              <Map size={15} /> Promote Finding
            </button>
            <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowAdd(true); }}>
              <Plus size={15} /> Add Item
            </button>
          </div>
        )}
      </div>

      <div style={styles.layout}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div className="card" style={styles.sideCard}>
            <div style={styles.sideHeader}>
              <Map size={15} color="var(--blue-primary)" />
              <span style={styles.sideTitle}>Select Client</span>
            </div>
            <div style={styles.clientList}>
              {clients.map(c => (
                <button key={c.id}
                  style={{ ...styles.clientBtn, ...(selected?.id === c.id ? styles.clientBtnActive : {}) }}
                  onClick={() => selectClient(c)}>
                  <span style={styles.clientBtnName}>{c.organizationName}</span>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          {selected && (
            <div className="card" style={styles.sideCard}>
              <div style={styles.sideHeader}>
                <Filter size={15} color="var(--purple-primary)" />
                <span style={styles.sideTitle}>Filters</span>
              </div>
              <div style={styles.filterSection}>
                <FilterGroup label="Source" options={SOURCES} value={filterSource} onChange={setFilterSource} />
                <FilterGroup label="Priority" options={PRIORITIES} value={filterPriority} onChange={setFilterPriority} />
                <FilterGroup label="Status" options={STATUSES} value={filterStatus} onChange={setFilterStatus} />
                <FilterGroup label="Phase" options={PHASES} value={filterPhase} onChange={setFilterPhase} />
                {(filterSource !== 'All' || filterPriority !== 'All' || filterStatus !== 'All' || filterPhase !== 'All') && (
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '12px', marginTop: '8px' }}
                    onClick={() => { setFilterSource('All'); setFilterPriority('All'); setFilterStatus('All'); setFilterPhase('All'); }}>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={styles.main}>
          {!selected ? (
            <EmptyState icon={<Map size={40} />} message="Select a client to view their remediation roadmap" />
          ) : loading ? (
            <LoadingSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Map size={40} />}
              message="No roadmap items yet"
              action={
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => setShowPromote(true)}><Map size={15} /> Promote Finding</button>
                  <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Add Manually</button>
                </div>
              }
            />
          ) : (
            <>
              {/* Summary row */}
              {summary && (
                <div style={styles.summaryRow}>
                  <RoadmapDonut summary={summary} />
                  <div style={styles.summaryStats}>
                    <StatBadge label="Open" value={parseInt(summary.open)} color="var(--critical)" />
                    <StatBadge label="In Progress" value={parseInt(summary.in_progress)} color="var(--blue-primary)" />
                    <StatBadge label="Completed" value={parseInt(summary.completed)} color="var(--health-green)" />
                    <StatBadge label="Risk Accepted" value={parseInt(summary.risk_accepted)} color="var(--info)" />
                    {parseInt(summary.flagged) > 0 && (
                      <StatBadge label="Pending Review" value={parseInt(summary.flagged)} color="var(--medium)" alert />
                    )}
                  </div>
                  <div style={styles.summaryRight}>
                    <div style={styles.completionPct}>
                      {parseInt(summary.total) > 0
                        ? Math.round((parseInt(summary.completed) / parseInt(summary.total)) * 100)
                        : 0}%
                    </div>
                    <div style={styles.completionLabel}>Complete</div>
                    <div style={styles.progressBar}>
                      <div style={{
                        width: `${parseInt(summary.total) > 0 ? (parseInt(summary.completed) / parseInt(summary.total)) * 100 : 0}%`,
                        height: '100%', borderRadius: '3px', background: 'var(--gradient-brand)',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <div style={styles.progressLabel}>{summary.completed} of {summary.total} items</div>
                  </div>
                </div>
              )}

              {/* Items grouped by source */}
              {filtered.length === 0 ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No items match the current filters
                </div>
              ) : (
                sourceOrder.filter(src => grouped[src]?.length > 0).map(src => (
                  <div key={src} style={styles.sourceGroup}>
                    <div style={styles.sourceGroupHeader}>
                      <span style={{ ...styles.sourceTag, color: SOURCE_COLORS[src], background: `${SOURCE_COLORS[src]}15`, border: `1px solid ${SOURCE_COLORS[src]}30` }}>
                        {src}
                      </span>
                      <span style={styles.sourceCount}>{grouped[src].length} item{grouped[src].length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                      {grouped[src].map((item, idx) => (
                        <RoadmapItem
                          key={item.id}
                          item={item}
                          isLast={idx === grouped[src].length - 1}
                          onEdit={() => { setEditItem(item); setShowAdd(true); }}
                          onDelete={async () => {
                            await api.delete(`/roadmap/${item.id}`);
                            await refresh();
                          }}
                          onStatusChange={async (status) => {
                            await api.put(`/roadmap/${item.id}`, { status });
                            await refresh();
                          }}
                          onClearFlag={async () => {
                            await api.patch(`/roadmap/${item.id}/clear-review`);
                            await refresh();
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {showAdd && selected && (
        <AddItemModal
          clientId={selected.id}
          clientName={selected.organizationName}
          item={editItem}
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          onSuccess={async () => { setShowAdd(false); setEditItem(null); await refresh(); }}
        />
      )}

      {showPromote && selected && (
        <PromoteModal
          clientId={selected.id}
          clientName={selected.organizationName}
          onClose={() => setShowPromote(false)}
          onSuccess={async () => { setShowPromote(false); await refresh(); }}
        />
      )}
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
      <select className="input" style={{ fontSize: '12px', padding: '6px 10px' }} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function StatBadge({ label, value, color, alert }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 16px', background: `${color}10`, borderRadius: '10px', border: `1px solid ${color}25`, position: 'relative' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
      {alert && value > 0 && <div style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />}
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
      <div className="card skeleton" style={{ height: '120px' }} />
      <div className="card skeleton" style={{ height: '300px' }} />
    </div>
  );
}

const styles = {
  page: { padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  layout: { display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '16px' },
  main: { display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 },
  sideCard: { overflow: 'hidden' },
  sideHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' },
  sideTitle: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', letterSpacing: '0.03em' },
  clientList: { padding: '8px' },
  clientBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'left' },
  clientBtnActive: { background: 'rgba(75,110,245,0.12)', color: 'var(--text-primary)' },
  clientBtnName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  filterSection: { padding: '12px 16px' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '24px', alignItems: 'center', padding: '20px 24px', background: 'var(--gradient-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px' },
  summaryStats: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  summaryRight: { textAlign: 'center', minWidth: '120px' },
  completionPct: { fontFamily: 'var(--font-display)', fontSize: '40px', fontWeight: '700', background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1 },
  completionLabel: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' },
  progressBar: { height: '6px', borderRadius: '3px', background: 'var(--navy-600)', overflow: 'hidden', marginBottom: '6px' },
  progressLabel: { fontSize: '11px', color: 'var(--text-muted)' },
  sourceGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  sourceGroupHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  sourceTag: { fontSize: '11px', fontWeight: '700', padding: '3px 12px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  sourceCount: { fontSize: '12px', color: 'var(--text-muted)' },
};
