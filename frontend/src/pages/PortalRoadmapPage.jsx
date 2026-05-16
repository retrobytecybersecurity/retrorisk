import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Map, CheckCircle, AlertTriangle, Filter } from 'lucide-react';
import RoadmapDonut from '../components/roadmap/RoadmapDonut';

const PRIORITY_COLORS = {
  Critical:'var(--critical)', High:'var(--high)',
  Medium:'var(--medium)', Low:'var(--low)', Informational:'var(--info)',
};
const STATUS_COLORS = {
  'Open':'var(--critical)', 'In Progress':'var(--blue-primary)',
  'Completed':'var(--health-green)', 'Risk Accepted':'var(--info)',
};
const PHASE_CONFIG = {
  'Quick Win': { color:'var(--health-green)', bg:'rgba(59,255,138,0.1)' },
  'Short Term':{ color:'var(--medium)',       bg:'rgba(255,184,59,0.1)' },
  'Long Term': { color:'var(--info)',         bg:'rgba(138,143,181,0.1)' },
};

export default function PortalRoadmapPage() {
  const [items, setItems]     = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterSource,   setFS] = useState('All');
  const [filterPriority, setFP] = useState('All');
  const [filterStatus,   setFSt]= useState('All');

  useEffect(() => { fetchRoadmap(); }, [filterSource, filterPriority, filterStatus]);

  async function fetchRoadmap() {
    try {
      const params = {};
      if (filterSource   !== 'All') params.source   = filterSource;
      if (filterPriority !== 'All') params.priority  = filterPriority;
      if (filterStatus   !== 'All') params.status    = filterStatus;
      const res = await api.get('/portal/roadmap', { params });
      setItems(res.data.items);
      setSummary(res.data.summary);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const sources   = [...new Set(items.map(i => i.source))];
  const priorities= ['All','Critical','High','Medium','Low','Informational'];
  const statuses  = ['All','Open','In Progress','Completed','Risk Accepted'];

  return (
    <div style={styles.page}>
      <div className="page-header">
        <div>
          <h1 className="section-title">Remediation Roadmap</h1>
          <p style={styles.subtitle}>Your prioritized security improvement plan</p>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div style={styles.summaryCard} className="card">
          <RoadmapDonut summary={summary} />
          <div style={styles.summaryStats}>
            <SumStat label="Total Items" value={summary.total} />
            <SumStat label="Open" value={summary.open_total} color="var(--critical)" />
            <SumStat label="Completed" value={summary.completed} color="var(--health-green)" />
          </div>
          <div style={styles.summaryProgress}>
            <div style={styles.pctLabel}>
              {parseInt(summary.total) > 0
                ? Math.round((parseInt(summary.completed) / parseInt(summary.total)) * 100)
                : 0}% Complete
            </div>
            <div style={styles.progressBar}>
              <div style={{
                width: `${parseInt(summary.total) > 0 ? (parseInt(summary.completed) / parseInt(summary.total)) * 100 : 0}%`,
                height: '100%', borderRadius: '3px', background: 'var(--gradient-brand)',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filterRow}>
        <Filter size={14} color="var(--text-muted)" />
        <FilterPill label="All Sources" options={['All',...sources]} value={filterSource} onChange={setFS} />
        <FilterPill label="Priority" options={priorities} value={filterPriority} onChange={setFP} />
        <FilterPill label="Status" options={statuses} value={filterStatus} onChange={setFSt} />
      </div>

      {/* Items */}
      {loading ? (
        <div className="card skeleton" style={{ height: '300px' }} />
      ) : items.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Map size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <div>No roadmap items match your filters</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Table header */}
          <div style={styles.tableHeader}>
            <span style={{ flex: 3 }}>Item</span>
            <span style={{ flex: 1 }}>Priority</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ flex: 1 }}>Phase</span>
            <span style={{ flex: 1 }}>Due Date</span>
            <span style={{ width: '180px' }}>Assigned To</span>
            <span style={{ width: '120px', textAlign: 'center' }}>Actions</span>
          </div>
          {items.map((item, idx) => (
            <PortalItemRow
              key={item.id}
              item={item}
              isLast={idx === items.length - 1}
              onUpdate={fetchRoadmap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PortalItemRow({ item, isLast, onUpdate }) {
  const [owner, setOwner]       = useState(item.assigned_owner || '');
  const [editingOwner, setEdit] = useState(false);
  const [flagNotes, setFlagNotes] = useState('');
  const [showFlag, setShowFlag] = useState(false);
  const [saving, setSaving]     = useState(false);

  const prColor = PRIORITY_COLORS[item.priority] || 'var(--info)';
  const stColor = STATUS_COLORS[item.status]     || 'var(--text-muted)';
  const phConf  = PHASE_CONFIG[item.phase]       || PHASE_CONFIG['Long Term'];

  const daysUntil = item.due_date
    ? Math.ceil((new Date(item.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const isOverdue = daysUntil !== null && daysUntil < 0 && item.status !== 'Completed';

  async function saveOwner() {
    setSaving(true);
    try {
      await api.patch(`/portal/roadmap/${item.id}/owner`, { assignedOwner: owner });
      setEdit(false);
      onUpdate();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function submitFlag() {
    setSaving(true);
    try {
      await api.patch(`/portal/roadmap/${item.id}/flag`, { flaggedNotes: flagNotes });
      setShowFlag(false);
      setFlagNotes('');
      onUpdate();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div style={{ ...styles.itemRow, borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
        <div style={{ flex: 3, minWidth: 0 }}>
          <div style={styles.itemTitle}>{item.title}</div>
          {item.source_reference && (
            <div style={styles.itemRef}>{item.source} — {item.source_reference}</div>
          )}
          {item.notes && <div style={styles.itemNotes}>{item.notes}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: prColor, background: `${prColor}15`, padding: '2px 8px', borderRadius: '100px', border: `1px solid ${prColor}30` }}>
            {item.priority}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: stColor, background: `${stColor}15`, padding: '2px 8px', borderRadius: '100px', border: `1px solid ${stColor}30` }}>
            {item.status}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          {item.phase && (
            <span style={{ fontSize: '10px', fontWeight: '600', color: phConf.color, background: phConf.bg, padding: '2px 8px', borderRadius: '100px' }}>
              {item.phase}
            </span>
          )}
        </div>
        <div style={{ flex: 1, fontSize: '12px', color: isOverdue ? 'var(--critical)' : 'var(--text-muted)' }}>
          {item.due_date
            ? new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—'}
          {isOverdue && <div style={{ fontSize: '10px' }}>{Math.abs(daysUntil)}d overdue</div>}
        </div>
        <div style={{ width: '180px' }}>
          {editingOwner ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              <input style={{ ...styles.ownerInput, flex: 1 }} value={owner}
                onChange={e => setOwner(e.target.value)}
                placeholder="Name..." autoFocus
                onKeyDown={e => e.key === 'Enter' && saveOwner()} />
              <button style={styles.miniBtn} onClick={saveOwner} disabled={saving}>✓</button>
              <button style={styles.miniBtn} onClick={() => { setEdit(false); setOwner(item.assigned_owner || ''); }}>✗</button>
            </div>
          ) : (
            <button style={styles.ownerBtn} onClick={() => setEdit(true)}>
              {owner || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Set owner...</span>}
            </button>
          )}
        </div>
        <div style={{ width: '120px', display: 'flex', justifyContent: 'center', gap: '6px' }}>
          {item.status !== 'Completed' && !item.flagged_for_review && (
            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '11px', gap: '4px' }}
              onClick={() => setShowFlag(true)}
              title="Flag as ready for review">
              🔔 Flag
            </button>
          )}
          {item.flagged_for_review && (
            <span style={{ fontSize: '11px', color: 'var(--medium)', fontWeight: '600' }}>🔔 Flagged</span>
          )}
        </div>
      </div>

      {/* Flag modal inline */}
      {showFlag && (
        <div style={styles.flagRow}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--medium)', marginBottom: '6px' }}>
              🔔 Flag "{item.title}" as ready for review
            </div>
            <textarea style={styles.flagTextarea} rows={2}
              value={flagNotes}
              onChange={e => setFlagNotes(e.target.value)}
              placeholder="Optional: describe what was done to remediate this item..." />
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={submitFlag} disabled={saving}>
              {saving ? 'Flagging...' : 'Submit Flag'}
            </button>
            <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={() => setShowFlag(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function SumStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '700', color: color || 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function FilterPill({ options, value, onChange }) {
  return (
    <select className="input" style={{ width: 'auto', fontSize: '12px', padding: '5px 10px' }}
      value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const styles = {
  page: { padding: '32px', maxWidth: '1200px', margin: '0 auto' },
  subtitle: { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' },
  summaryCard: { display: 'flex', alignItems: 'center', gap: '24px', padding: '20px 24px', marginBottom: '20px' },
  summaryStats: { display: 'flex', gap: '24px', flex: 1 },
  summaryProgress: { minWidth: '160px' },
  pctLabel: { fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700', marginBottom: '8px', background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  progressBar: { height: '6px', borderRadius: '3px', background: 'var(--navy-600)', overflow: 'hidden' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  tableHeader: { display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', gap: '12px' },
  itemRow: { display: 'flex', alignItems: 'flex-start', padding: '16px 20px', gap: '12px', transition: 'background 0.15s ease' },
  itemTitle: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '3px' },
  itemRef: { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' },
  itemNotes: { fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' },
  ownerBtn: { background: 'none', border: '1px dashed var(--border-subtle)', color: 'var(--text-primary)', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', textAlign: 'left', width: '100%', transition: 'all 0.15s ease' },
  ownerInput: { padding: '4px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-accent)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' },
  miniBtn: { background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px', padding: '3px 6px', fontSize: '11px' },
  flagRow: { display: 'flex', gap: '16px', padding: '12px 20px', background: 'rgba(255,184,59,0.06)', borderTop: '1px solid rgba(255,184,59,0.2)', alignItems: 'flex-start' },
  flagTextarea: { width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '12px', outline: 'none', resize: 'none' },
};
