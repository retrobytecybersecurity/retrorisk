import React, { useState } from 'react';
import api from '../../utils/api';
import { ChevronDown, ChevronUp, Edit2, Trash2, CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';

const PRIORITY_COLORS = {
  Critical:      'var(--critical)',
  High:          'var(--high)',
  Medium:        'var(--medium)',
  Low:           'var(--low)',
  Informational: 'var(--info)',
};

const STATUS_CONFIG = {
  'Open':          { color: 'var(--critical)',     icon: '●' },
  'In Progress':   { color: 'var(--blue-primary)', icon: '▶' },
  'Completed':     { color: 'var(--health-green)', icon: '✓' },
  'Risk Accepted': { color: 'var(--info)',          icon: '⚖' },
};

const PHASE_CONFIG = {
  'Quick Win':  { color: 'var(--health-green)', bg: 'rgba(59,255,138,0.1)' },
  'Short Term': { color: 'var(--medium)',        bg: 'rgba(255,184,59,0.1)' },
  'Long Term':  { color: 'var(--info)',          bg: 'rgba(138,143,181,0.1)' },
};

const STATUS_TRANSITIONS = {
  'Open':        ['In Progress', 'Completed', 'Risk Accepted'],
  'In Progress': ['Open', 'Completed', 'Risk Accepted'],
  'Completed':   ['Open', 'In Progress'],
  'Risk Accepted':['Open'],
};

export default function RoadmapItem({ item, isLast, onEdit, onDelete, onStatusChange, onClearFlag }) {
  const [expanded, setExpanded] = useState(false);
  const [auditTrail, setAuditTrail] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const prColor = PRIORITY_COLORS[item.priority] || 'var(--info)';
  const stConf  = STATUS_CONFIG[item.status]   || STATUS_CONFIG['Open'];
  const phConf  = PHASE_CONFIG[item.phase]     || PHASE_CONFIG['Long Term'];

  const daysUntil = item.due_date
    ? Math.ceil((new Date(item.due_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const isOverdue = daysUntil !== null && daysUntil < 0 && item.status !== 'Completed';

  async function loadAudit() {
    if (auditTrail) return;
    setLoadingAudit(true);
    try {
      const res = await api.get(`/roadmap/${item.id}/audit`);
      setAuditTrail(res.data);
    } catch (err) { console.error(err); }
    finally { setLoadingAudit(false); }
  }

  async function handleExpand() {
    setExpanded(!expanded);
    if (!expanded) loadAudit();
  }

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
      {/* Main row */}
      <div style={styles.row}>
        {/* Priority bar */}
        <div style={{ width: '3px', alignSelf: 'stretch', background: prColor, flexShrink: 0, borderRadius: '2px' }} />

        {/* Content */}
        <div style={styles.content} onClick={handleExpand}>
          <div style={styles.titleRow}>
            <span style={styles.title}>{item.title}</span>
            {item.flagged_for_review && (
              <span style={styles.flagBadge} title={`Client flagged: ${item.flagged_notes || 'No notes'}`}>
                🔔 Ready for Review
              </span>
            )}
          </div>
          <div style={styles.metaRow}>
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} conf={stConf} />
            {item.phase && (
              <span style={{ ...styles.phaseBadge, color: phConf.color, background: phConf.bg }}>
                {item.phase}
              </span>
            )}
            {item.effort && (
              <span style={styles.effortBadge}>⚡ {item.effort}</span>
            )}
            {item.source_reference && (
              <span style={styles.refBadge}>{item.source_reference}</span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div style={styles.rightSide}>
          {/* Due date */}
          {item.due_date && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: isOverdue ? 'var(--critical)' : 'var(--text-muted)' }}>
                {isOverdue ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil}d`}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          )}

          {/* Owner */}
          {item.assigned_owner && (
            <div style={styles.ownerChip} title={`Assigned to: ${item.assigned_owner}`}>
              👤 {item.assigned_owner.split(' ')[0]}
            </div>
          )}

          {/* Status transitions */}
          <div style={styles.actionRow}>
            {(STATUS_TRANSITIONS[item.status] || []).slice(0, 2).map(nextStatus => (
              <button key={nextStatus}
                style={{ ...styles.transitionBtn, color: STATUS_CONFIG[nextStatus]?.color || 'var(--text-muted)' }}
                onClick={e => { e.stopPropagation(); onStatusChange(nextStatus); }}
                title={`Mark as ${nextStatus}`}>
                {STATUS_CONFIG[nextStatus]?.icon}
              </button>
            ))}
            {item.flagged_for_review && (
              <button style={{ ...styles.transitionBtn, color: 'var(--medium)' }}
                onClick={e => { e.stopPropagation(); onClearFlag(); }}
                title="Clear review flag">✓</button>
            )}
            <button style={{ ...styles.transitionBtn, color: 'var(--text-muted)' }}
              onClick={e => { e.stopPropagation(); onEdit(); }}
              title="Edit"><Edit2 size={12} /></button>
            <button style={{ ...styles.transitionBtn, color: 'var(--critical)', opacity: 0.6 }}
              onClick={e => { e.stopPropagation(); onDelete(); }}
              title="Delete"><Trash2 size={12} /></button>
          </div>

          <button style={styles.expandBtn} onClick={handleExpand}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={styles.detail}>
          <div style={styles.detailGrid}>
            {item.notes && (
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Notes</div>
                <div style={styles.detailText}>{item.notes}</div>
              </div>
            )}
            {item.status === 'Risk Accepted' && item.risk_acceptance_reason && (
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Risk Acceptance</div>
                <div style={styles.detailText}>
                  <strong>By:</strong> {item.risk_accepted_by}<br />
                  <strong>Reason:</strong> {item.risk_acceptance_reason}
                  {item.risk_review_date && <><br /><strong>Review:</strong> {new Date(item.risk_review_date).toLocaleDateString()}</>}
                </div>
              </div>
            )}
            {item.flagged_for_review && item.flagged_notes && (
              <div style={{ ...styles.detailSection, background: 'rgba(255,184,59,0.06)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ ...styles.detailLabel, color: 'var(--medium)' }}>🔔 Client Review Notes</div>
                <div style={styles.detailText}>{item.flagged_notes}</div>
              </div>
            )}
          </div>

          {/* Audit trail */}
          <div style={styles.auditSection}>
            <div style={styles.detailLabel}>Change History</div>
            {loadingAudit ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : auditTrail?.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No changes recorded</div>
            ) : (
              <div style={styles.auditList}>
                {(auditTrail || []).map(entry => (
                  <div key={entry.id} style={styles.auditEntry}>
                    <div style={styles.auditDot} />
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {entry.change_type.replace(/_/g, ' ')}
                      </span>
                      {entry.old_value && entry.new_value && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {' '}{entry.old_value} → {entry.new_value}
                        </span>
                      )}
                      {entry.new_value && !entry.old_value && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{' '}{entry.new_value}</span>
                      )}
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {entry.changed_by || 'System'} • {new Date(entry.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }) {
  const c = PRIORITY_COLORS[priority] || 'var(--info)';
  return (
    <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '100px',
      color: c, background: `${c}18`, border: `1px solid ${c}35`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {priority}
    </span>
  );
}

function StatusBadge({ status, conf }) {
  return (
    <span style={{ fontSize: '10px', fontWeight: '600', padding: '1px 8px', borderRadius: '100px',
      color: conf.color, background: `${conf.color}15`, border: `1px solid ${conf.color}30` }}>
      {conf.icon} {status}
    </span>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'stretch', gap: '12px', padding: '14px 16px', minHeight: '60px' },
  content: { flex: 1, minWidth: 0, cursor: 'pointer' },
  titleRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' },
  title: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' },
  metaRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
  phaseBadge: { fontSize: '10px', fontWeight: '600', padding: '1px 8px', borderRadius: '100px' },
  effortBadge: { fontSize: '10px', color: 'var(--text-muted)', background: 'var(--navy-700)', padding: '1px 8px', borderRadius: '100px' },
  refBadge: { fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' },
  flagBadge: { fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '100px', background: 'rgba(255,184,59,0.15)', color: 'var(--medium)', border: '1px solid rgba(255,184,59,0.3)' },
  rightSide: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  ownerChip: { fontSize: '11px', color: 'var(--text-muted)', background: 'var(--navy-700)', padding: '2px 8px', borderRadius: '100px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  actionRow: { display: 'flex', gap: '2px' },
  transitionBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', fontSize: '13px', display: 'flex', alignItems: 'center', transition: 'background 0.15s ease' },
  expandBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' },
  detail: { padding: '12px 16px 16px 31px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '14px' },
  detailGrid: { display: 'flex', flexDirection: 'column', gap: '12px' },
  detailSection: {},
  detailLabel: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' },
  detailText: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 },
  auditSection: { borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' },
  auditList: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' },
  auditEntry: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  auditDot: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-accent)', flexShrink: 0, marginTop: '4px' },
};
