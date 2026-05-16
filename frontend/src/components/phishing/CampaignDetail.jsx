import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { CheckCircle, Circle, AlertTriangle } from 'lucide-react';

const STATUS_CONFIG = {
  'Submitted Data': { color: 'var(--critical)',      label: 'Submitted Data',  priority: 1 },
  'Clicked Link':   { color: 'var(--high)',           label: 'Clicked Link',    priority: 2 },
  'Email Opened':   { color: 'var(--medium)',         label: 'Email Opened',    priority: 3 },
  'Email Reported': { color: 'var(--health-green)',  label: 'Reported',        priority: 4 },
  'Email Sent':     { color: 'var(--text-muted)',     label: 'No Action',       priority: 5 },
};

const FILTERS = ['All','Submitted Data','Clicked Link','Email Opened','Email Reported','Email Sent'];

export default function CampaignDetail({ campaign, onUpdate }) {
  const [targets, setTargets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('All');
  const [updating, setUpdating] = useState(new Set());

  useEffect(() => {
    load();
  }, [campaign.id]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/phishing/campaigns/${campaign.id}/targets`);
      setTargets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function toggleTraining(targetId, currentState) {
    setUpdating(prev => new Set(prev).add(targetId));
    try {
      await api.patch(`/phishing/targets/${targetId}/training`, {
        trainingCompleted: !currentState,
      });
      setTargets(prev => prev.map(t =>
        t.id === targetId
          ? { ...t, trainingCompleted: !currentState, trainingCompletedAt: !currentState ? new Date().toISOString() : null }
          : t
      ));
    } catch (err) { console.error(err); }
    finally { setUpdating(prev => { const n = new Set(prev); n.delete(targetId); return n; }); }
  }

  const filtered = filter === 'All' ? targets : targets.filter(t => t.status === filter);

  const counts = FILTERS.slice(1).reduce((acc, f) => {
    acc[f] = targets.filter(t => t.status === f).length;
    return acc;
  }, {});

  const flaggedCount    = targets.filter(t => t.flaggedForTraining).length;
  const completedCount  = targets.filter(t => t.trainingCompleted).length;
  const repeatCount     = targets.filter(t => t.isRepeatOffender).length;

  return (
    <div className="card" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.campaignName}>{campaign.name}</div>
          <div style={styles.campaignMeta}>
            {campaign.phishing_type} •{' '}
            {new Date(campaign.campaign_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} •{' '}
            {campaign.emails_sent} targets
          </div>
        </div>
        {/* Training summary */}
        <div style={styles.trainingSummary}>
          <div style={styles.trainingItem}>
            <AlertTriangle size={14} color="var(--medium)" />
            <span style={{ color: 'var(--medium)', fontWeight: '600' }}>{flaggedCount}</span>
            <span style={{ color: 'var(--text-muted)' }}>need training</span>
          </div>
          <div style={styles.trainingItem}>
            <CheckCircle size={14} color="var(--health-green)" />
            <span style={{ color: 'var(--health-green)', fontWeight: '600' }}>{completedCount}</span>
            <span style={{ color: 'var(--text-muted)' }}>completed</span>
          </div>
          {repeatCount > 0 && (
            <div style={styles.trainingItem}>
              <AlertTriangle size={14} color="var(--critical)" />
              <span style={{ color: 'var(--critical)', fontWeight: '600' }}>{repeatCount}</span>
              <span style={{ color: 'var(--text-muted)' }}>repeat offenders</span>
            </div>
          )}
        </div>
      </div>

      {/* Pretext if set */}
      {campaign.pretext && (
        <div style={styles.pretextBar}>
          <span style={styles.pretextLabel}>Lure:</span>
          <span style={styles.pretextText}>{campaign.pretext}</span>
        </div>
      )}

      {/* Status filter */}
      <div style={styles.filterRow}>
        <FilterBtn label="All" count={targets.length} active={filter === 'All'} onClick={() => setFilter('All')} />
        {FILTERS.slice(1).map(f => counts[f] > 0 && (
          <FilterBtn key={f} label={STATUS_CONFIG[f]?.label || f} count={counts[f]}
            active={filter === f} onClick={() => setFilter(f)}
            color={STATUS_CONFIG[f]?.color} />
        ))}
      </div>

      <div style={styles.divider} />

      {/* Target list */}
      {loading ? (
        <div style={{ padding: '20px' }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '48px', marginBottom: '8px', borderRadius: '6px' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>No targets for this filter</div>
      ) : (
        <>
          {/* Table header */}
          <div style={styles.tableHeader}>
            <span style={{ flex: 2 }}>Name</span>
            <span style={{ flex: 2 }}>Email</span>
            <span style={{ flex: 1 }}>Position</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ width: '120px', textAlign: 'center' }}>Training</span>
          </div>
          <div>
            {filtered.map(target => {
              const sc = STATUS_CONFIG[target.status] || STATUS_CONFIG['Email Sent'];
              const needsTraining = target.flaggedForTraining;
              const isUpdating = updating.has(target.id);

              return (
                <div key={target.id} style={{
                  ...styles.targetRow,
                  ...(target.isRepeatOffender ? styles.repeatRow : {}),
                }}>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={styles.targetName}>
                      {target.firstName} {target.lastName}
                      {target.isRepeatOffender && (
                        <span style={styles.repeatBadge} title="Repeat offender — clicked in prior campaign">↩</span>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 2, minWidth: 0 }}>
                    <div style={styles.targetEmail}>{target.email}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={styles.targetPos}>{target.position || '—'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <StatusBadge status={target.status} config={sc} reported={target.reported} />
                  </div>
                  <div style={{ width: '120px', display: 'flex', justifyContent: 'center' }}>
                    {needsTraining ? (
                      <button
                        style={styles.trainingBtn}
                        onClick={() => toggleTraining(target.id, target.trainingCompleted)}
                        disabled={isUpdating}
                        title={target.trainingCompleted ? 'Mark incomplete' : 'Mark training complete'}
                      >
                        {target.trainingCompleted ? (
                          <CheckCircle size={16} color="var(--health-green)" />
                        ) : (
                          <Circle size={16} color="var(--medium)" />
                        )}
                        <span style={{ fontSize: '11px', color: target.trainingCompleted ? 'var(--health-green)' : 'var(--medium)' }}>
                          {target.trainingCompleted ? 'Done' : 'Pending'}
                        </span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status, config, reported }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '100px',
      background: `${config.color}18`, color: config.color,
      border: `1px solid ${config.color}35`, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {reported && status !== 'Email Reported' ? 'Reported' : config.label}
    </span>
  );
}

function FilterBtn({ label, count, active, onClick, color }) {
  const c = color || 'var(--blue-primary)';
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 12px', borderRadius: '100px',
      border: `1px solid ${active ? c : 'var(--border-subtle)'}`,
      background: active ? `${c}18` : 'transparent',
      color: active ? c : 'var(--text-secondary)',
      cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s ease',
    }}>
      {label}
      <span style={{ background: active ? c : 'var(--navy-600)', color: active ? 'white' : 'var(--text-muted)', borderRadius: '100px', padding: '0 5px', fontSize: '10px' }}>
        {count}
      </span>
    </button>
  );
}

const styles = {
  container: { overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', gap: '16px' },
  campaignName: { fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: '700', marginBottom: '4px' },
  campaignMeta: { fontSize: '12px', color: 'var(--text-muted)' },
  trainingSummary: { display: 'flex', gap: '16px', flexShrink: 0 },
  trainingItem: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' },
  pretextBar: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px', background: 'rgba(75,110,245,0.05)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' },
  pretextLabel: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', flexShrink: 0 },
  pretextText: { fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' },
  filterRow: { display: 'flex', gap: '6px', padding: '12px 24px', flexWrap: 'wrap' },
  divider: { height: '1px', background: 'var(--border-subtle)' },
  tableHeader: {
    display: 'flex', alignItems: 'center', padding: '8px 24px',
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-muted)',
  },
  targetRow: {
    display: 'flex', alignItems: 'center', padding: '12px 24px',
    borderBottom: '1px solid var(--border-subtle)', gap: '8px',
    transition: 'background 0.15s ease',
  },
  repeatRow: { background: 'rgba(255,59,92,0.03)' },
  targetName: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' },
  targetEmail: { fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  targetPos: { fontSize: '12px', color: 'var(--text-muted)' },
  repeatBadge: { fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,59,92,0.15)', color: 'var(--critical)', border: '1px solid rgba(255,59,92,0.3)' },
  trainingBtn: { display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', transition: 'background 0.15s ease' },
  empty: { padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' },
};
