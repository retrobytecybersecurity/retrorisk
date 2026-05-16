import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { ArrowLeft, ChevronRight, ChevronDown, ChevronUp, Save, CheckCircle, Shield } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'Not Assessed',       label: 'Not Assessed',       color: 'var(--text-muted)' },
  { value: 'Compliant',          label: 'Compliant',          color: 'var(--health-green)' },
  { value: 'Partially Compliant',label: 'Partially Compliant',color: 'var(--medium)' },
  { value: 'Non-Compliant',      label: 'Non-Compliant',      color: 'var(--critical)' },
  { value: 'Not Applicable',     label: 'Not Applicable',     color: 'var(--info)' },
];

const RISK_OPTIONS = [
  { value: '',              label: 'None / Not Rated' },
  { value: 'Critical',      label: 'Critical' },
  { value: 'High',          label: 'High' },
  { value: 'Medium',        label: 'Medium' },
  { value: 'Low',           label: 'Low' },
  { value: 'Informational', label: 'Informational' },
];

const RISK_COLORS = {
  Critical: 'var(--critical)', High: 'var(--high)',
  Medium: 'var(--medium)', Low: 'var(--low)',
  Informational: 'var(--info)',
};

function ScoreRing({ score, size = 64, label }) {
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? 'var(--health-green)' : score >= 50 ? 'var(--medium)' : 'var(--critical)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--navy-600)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x={size/2} y={size/2+4} textAnchor="middle"
          style={{ fontFamily:'var(--font-display)', fontSize:'13px', fontWeight:700, fill:color }}>
          {Math.round(score)}%
        </text>
      </svg>
      {label && <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: size + 20 }}>{label}</div>}
    </div>
  );
}

export default function CISAssessmentView({ assessmentData, clientName, onBack, onUpdate }) {
  const { assessment, responses: initialResponses } = assessmentData;
  const [safeguardLib, setSafeguardLib]   = useState(null);
  const [responses, setResponses]         = useState(initialResponses || {});
  const [selectedControl, setControl]     = useState(null);
  const [expandedSg, setExpanded]         = useState(null);
  const [saving, setSaving]               = useState(new Set());
  const [completing, setCompleting]       = useState(false);
  const [dirty, setDirty]                 = useState(new Set());
  const [localEdits, setLocalEdits]       = useState({});

  // Load safeguard library
  useEffect(() => {
    api.get('/cis/safeguards').then(r => {
      setSafeguardLib(r.data);
      // Default to first control
      if (r.data.controls?.length > 0) setControl(r.data.controls[0].id);
    });
  }, []);

  // Get applicable safeguards for this assessment's IG level
  const igNum = parseInt(assessment.ig_level.replace('IG', ''));
  const applicableControls = safeguardLib?.controls?.map(ctrl => ({
    ...ctrl,
    safeguards: ctrl.safeguards.filter(sg => sg.ig <= igNum)
  })).filter(ctrl => ctrl.safeguards.length > 0) || [];

  const activeControl = applicableControls.find(c => c.id === selectedControl);

  // Get response for a safeguard (merge saved + local edits)
  function getResponse(sgId) {
    const saved = responses[sgId] || {};
    const local = localEdits[sgId] || {};
    return { ...saved, ...local };
  }

  function updateLocal(sgId, field, value) {
    setLocalEdits(prev => ({
      ...prev,
      [sgId]: { ...(prev[sgId] || {}), [field]: value }
    }));
    setDirty(prev => new Set(prev).add(sgId));
  }

  async function saveSafeguard(sgId) {
    const response = getResponse(sgId);
    setSaving(prev => new Set(prev).add(sgId));
    try {
      const res = await api.put(
        `/cis/assessments/${assessment.id}/responses/${sgId}`,
        {
          status:             response.status,
          testingProcedures:  response.testing_procedures,
          evidence:           response.evidence,
          testingSteps:       response.testing_steps,
          gapsObservations:   response.gaps_observations,
          riskRating:         response.risk_rating || null,
        }
      );
      // Merge saved state
      setResponses(prev => ({
        ...prev,
        [sgId]: { ...prev[sgId], ...localEdits[sgId] }
      }));
      setLocalEdits(prev => { const n = {...prev}; delete n[sgId]; return n; });
      setDirty(prev => { const n = new Set(prev); n.delete(sgId); return n; });
      // Trigger score refresh in parent
      if (res.data.scores) onUpdate();
    } catch (err) { console.error('Save error:', err); }
    finally { setSaving(prev => { const n = new Set(prev); n.delete(sgId); return n; }); }
  }

  async function handleComplete() {
    if (!window.confirm('Mark this assessment as complete? You can still edit responses afterwards.')) return;
    setCompleting(true);
    try {
      await api.patch(`/cis/assessments/${assessment.id}/complete`);
      onUpdate();
    } catch (err) { console.error(err); }
    finally { setCompleting(false); }
  }

  // Control group completion stats
  function getControlStats(control) {
    const sgs = control.safeguards;
    const assessed = sgs.filter(sg => {
      const r = getResponse(sg.id);
      return r.status && r.status !== 'Not Assessed';
    });
    return { total: sgs.length, assessed: assessed.length };
  }

  // Overall score from latest assessment data
  const overallScore = parseFloat(assessment.overall_score) || 0;
  const controlScores = assessment.control_scores || {};

  if (!safeguardLib) {
    return (
      <div style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
        <div className="skeleton" style={{ width: '200px', height: '20px', borderRadius: '4px' }} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button className="btn btn-ghost" onClick={onBack} style={{ gap: '6px' }}>
          <ArrowLeft size={15} /> Back to Assessments
        </button>
        <div style={styles.topCenter}>
          <div style={styles.assessTitle}>{assessment.name}</div>
          <div style={styles.assessMeta}>{clientName} • {assessment.ig_level} • {assessment.assessed_safeguards}/{assessment.total_safeguards} assessed</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ScoreRing score={overallScore} size={56} />
          {assessment.status !== 'completed' && (
            <button className="btn btn-secondary" onClick={handleComplete} disabled={completing}>
              <CheckCircle size={15} />
              {completing ? 'Completing...' : 'Mark Complete'}
            </button>
          )}
        </div>
      </div>

      <div style={styles.layout}>
        {/* Control group nav */}
        <div style={styles.controlNav}>
          <div style={styles.navHeader}>Control Groups</div>
          {applicableControls.map(ctrl => {
            const stats = getControlStats(ctrl);
            const score = parseFloat(controlScores[ctrl.id]) || 0;
            const isActive = selectedControl === ctrl.id;
            const scoreColor = score >= 80 ? 'var(--health-green)' : score >= 50 ? 'var(--medium)' : score > 0 ? 'var(--critical)' : 'var(--text-muted)';
            return (
              <button key={ctrl.id}
                style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) }}
                onClick={() => setControl(ctrl.id)}>
                <div style={styles.navItemLeft}>
                  <div style={styles.navControlNum}>{ctrl.id}</div>
                  <div style={styles.navControlTitle}>{ctrl.title}</div>
                </div>
                <div style={styles.navItemRight}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: scoreColor }}>{score > 0 ? `${Math.round(score)}%` : ''}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{stats.assessed}/{stats.total}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Safeguard list */}
        <div style={styles.safeguardArea}>
          {activeControl && (
            <>
              <div style={styles.controlHeader}>
                <div>
                  <div style={styles.controlNum}>Control {activeControl.id}</div>
                  <div style={styles.controlTitle}>{activeControl.title}</div>
                </div>
                <ScoreRing score={parseFloat(controlScores[activeControl.id]) || 0} size={56} />
              </div>
              <div style={styles.sgList}>
                {activeControl.safeguards.map(sg => {
                  const resp = getResponse(sg.id);
                  const isSaving = saving.has(sg.id);
                  const isDirty = dirty.has(sg.id);
                  const isExpanded = expandedSg === sg.id;
                  const status = resp.status || 'Not Assessed';
                  const statusConf = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

                  return (
                    <div key={sg.id} style={styles.sgCard}>
                      {/* Safeguard header */}
                      <div style={styles.sgHeader} onClick={() => setExpanded(isExpanded ? null : sg.id)}>
                        <div style={styles.sgLeft}>
                          <div style={styles.sgId}>{sg.id}</div>
                          <div style={styles.sgInfo}>
                            <div style={styles.sgTitle}>{sg.title}</div>
                            <div style={styles.sgTags}>
                              <IgTag ig={sg.ig} />
                              <Tag label={sg.assetType} />
                              <Tag label={sg.securityFunction} />
                              {status !== 'Not Assessed' && (
                                <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '100px',
                                  color: statusConf.color, background: `${statusConf.color}18`, border: `1px solid ${statusConf.color}35` }}>
                                  {status}
                                </span>
                              )}
                              {resp.risk_rating && resp.risk_rating !== 'None' && (
                                <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '100px',
                                  color: RISK_COLORS[resp.risk_rating], background: `${RISK_COLORS[resp.risk_rating]}18`,
                                  border: `1px solid ${RISK_COLORS[resp.risk_rating]}35` }}>
                                  {resp.risk_rating}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {isDirty && (
                            <button className="btn btn-primary"
                              style={{ padding: '5px 12px', fontSize: '12px', gap: '4px' }}
                              onClick={e => { e.stopPropagation(); saveSafeguard(sg.id); }}
                              disabled={isSaving}>
                              <Save size={12} />{isSaving ? 'Saving...' : 'Save'}
                            </button>
                          )}
                          {!isDirty && resp.status && resp.status !== 'Not Assessed' && (
                            <CheckCircle size={15} color="var(--health-green)" />
                          )}
                          {isExpanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                        </div>
                      </div>

                      {/* Expanded form */}
                      {isExpanded && (
                        <div style={styles.sgForm}>
                          {/* Official description */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>CIS Description</div>
                            <div style={styles.descBox}>{sg.description}</div>
                          </div>

                          {/* Testing Procedures */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Testing Procedures</div>
                            <textarea style={styles.textarea} rows={3}
                              value={resp.testing_procedures || ''}
                              onChange={e => updateLocal(sg.id, 'testing_procedures', e.target.value)}
                              placeholder="Your standard methodology for testing this safeguard..." />
                          </div>

                          {/* Status */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Implementation Status *</div>
                            <div style={styles.statusGrid}>
                              {STATUS_OPTIONS.map(opt => (
                                <button key={opt.value} type="button"
                                  style={{ ...styles.statusBtn, ...(status === opt.value ? { borderColor: opt.color, color: opt.color, background: `${opt.color}15` } : {}) }}
                                  onClick={() => updateLocal(sg.id, 'status', opt.value)}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Evidence */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Evidence (Suralink Reference)</div>
                            <input className="input" value={resp.evidence || ''}
                              onChange={e => updateLocal(sg.id, 'evidence', e.target.value)}
                              placeholder="Suralink request title or reference..." />
                          </div>

                          {/* Testing Steps */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Testing Steps</div>
                            <textarea style={styles.textarea} rows={3}
                              value={resp.testing_steps || ''}
                              onChange={e => updateLocal(sg.id, 'testing_steps', e.target.value)}
                              placeholder="What you did and observed during this assessment..." />
                          </div>

                          {/* Gaps / Observations */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Gaps / Observations</div>
                            <textarea style={styles.textarea} rows={3}
                              value={resp.gaps_observations || ''}
                              onChange={e => updateLocal(sg.id, 'gaps_observations', e.target.value)}
                              placeholder="Gaps identified, observations, or client-specific context..." />
                          </div>

                          {/* Risk Rating */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Risk Rating</div>
                            <select className="input" style={{ maxWidth: '220px' }}
                              value={resp.risk_rating || ''}
                              onChange={e => updateLocal(sg.id, 'risk_rating', e.target.value)}>
                              {RISK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>

                          {/* Save button */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                            {isDirty && (
                              <button className="btn btn-ghost"
                                onClick={() => {
                                  setLocalEdits(prev => { const n = {...prev}; delete n[sg.id]; return n; });
                                  setDirty(prev => { const n = new Set(prev); n.delete(sg.id); return n; });
                                }}>
                                Discard
                              </button>
                            )}
                            <button className="btn btn-primary"
                              onClick={() => saveSafeguard(sg.id)}
                              disabled={isSaving}>
                              <Save size={14} />{isSaving ? 'Saving...' : isDirty ? 'Save Changes' : 'Saved'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IgTag({ ig }) {
  const colors = { 1: 'var(--health-green)', 2: 'var(--blue-primary)', 3: 'var(--purple-primary)' };
  return (
    <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '3px',
      color: colors[ig], background: `${colors[ig]}18`, border: `1px solid ${colors[ig]}35` }}>
      IG{ig}
    </span>
  );
}

function Tag({ label }) {
  return (
    <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--navy-700)',
      padding: '1px 6px', borderRadius: '3px', border: '1px solid var(--border-subtle)' }}>
      {label}
    </span>
  );
}

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--navy-950)', gap: '16px', flexShrink: 0,
  },
  topCenter: { flex: 1, textAlign: 'center' },
  assessTitle: { fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700' },
  assessMeta: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' },
  layout: { display: 'grid', gridTemplateColumns: '280px 1fr', flex: 1, overflow: 'hidden' },
  controlNav: { borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '12px 8px' },
  navHeader: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '4px 8px 10px' },
  navItem: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', textAlign: 'left', gap: '8px', transition: 'all 0.15s ease', marginBottom: '2px' },
  navItemActive: { background: 'rgba(75,110,245,0.12)', color: 'var(--text-primary)', borderLeft: '2px solid var(--blue-primary)' },
  navItemLeft: { flex: 1, minWidth: 0 },
  navItemRight: { flexShrink: 0, textAlign: 'right' },
  navControlNum: { fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '2px' },
  navControlTitle: { fontSize: '12px', fontWeight: '500', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  safeguardArea: { overflowY: 'auto', padding: '20px 24px' },
  controlHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' },
  controlNum: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' },
  controlTitle: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', letterSpacing: '0.02em' },
  sgList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  sgCard: { background: 'var(--gradient-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' },
  sgHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', gap: '12px' },
  sgLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 },
  sgId: { fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '700', color: 'var(--blue-primary)', background: 'rgba(75,110,245,0.1)', padding: '2px 8px', borderRadius: '4px', flexShrink: 0, marginTop: '1px' },
  sgInfo: { flex: 1, minWidth: 0 },
  sgTitle: { fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '6px' },
  sgTags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  sgForm: { padding: '0 16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '0', paddingTop: '16px' },
  fieldGroup: {},
  fieldLabel: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' },
  descBox: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-subtle)' },
  textarea: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none', resize: 'vertical', lineHeight: 1.6 },
  statusGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  statusBtn: { padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.15s ease' },
};
