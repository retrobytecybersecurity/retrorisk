import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { ArrowLeft, Save, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

const TIER_OPTIONS = [
  { value: 0, label: 'Not Assessed', color: 'var(--text-muted)',    desc: '' },
  { value: 1, label: 'Tier 1',       color: 'var(--critical)',      desc: 'Partial — Ad hoc, reactive' },
  { value: 2, label: 'Tier 2',       color: 'var(--high)',          desc: 'Risk Informed — Approved but not org-wide' },
  { value: 3, label: 'Tier 3',       color: 'var(--medium)',        desc: 'Repeatable — Formal policy, consistent' },
  { value: 4, label: 'Tier 4',       color: 'var(--health-green)',  desc: 'Adaptive — Continuous improvement' },
];

const RISK_OPTIONS = ['', 'Critical', 'High', 'Medium', 'Low', 'Informational'];

const RISK_COLORS = {
  Critical: 'var(--critical)', High: 'var(--high)',
  Medium: 'var(--medium)', Low: 'var(--low)', Informational: 'var(--info)',
};

const FUNCTION_META = {
  GV: { title: 'Govern',   color: '#9b4bf5' },
  ID: { title: 'Identify', color: '#4b6ef5' },
  PR: { title: 'Protect',  color: '#00c2ff' },
  DE: { title: 'Detect',   color: '#ffb83b' },
  RS: { title: 'Respond',  color: '#ff7b3b' },
  RC: { title: 'Recover',  color: '#3bff8a' },
};

function TierPicker({ label, value, onChange, color }) {
  return (
    <div>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.tierGrid}>
        {TIER_OPTIONS.map(opt => (
          <button key={opt.value} type="button"
            style={{
              ...styles.tierBtn,
              ...(value === opt.value ? {
                borderColor: opt.value === 0 ? 'var(--border-accent)' : opt.color,
                color: opt.value === 0 ? 'var(--text-primary)' : opt.color,
                background: opt.value === 0 ? 'rgba(255,255,255,0.05)' : `${opt.color}18`,
              } : {})
            }}
            onClick={() => onChange(opt.value)}>
            <span style={{ fontWeight: '800', fontSize: '13px' }}>{opt.value === 0 ? '—' : opt.value}</span>
            <span style={{ fontSize: '10px', lineHeight: 1.2 }}>{opt.label}{opt.desc ? ` — ${opt.desc}` : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NISTAssessmentView({ assessmentData, clientName, onBack, onUpdate }) {
  const { assessment, responses: initialResponses } = assessmentData;
  const [framework, setFramework]     = useState(null);
  const [responses, setResponses]     = useState(initialResponses || {});
  const [selectedFn, setSelectedFn]   = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [expandedSc, setExpanded]     = useState(null);
  const [saving, setSaving]           = useState(new Set());
  const [dirty, setDirty]             = useState(new Set());
  const [localEdits, setLocalEdits]   = useState({});
  const [completing, setCompleting]   = useState(false);

  useEffect(() => {
    api.get('/nist/framework').then(r => {
      setFramework(r.data);
      if (r.data.functions?.length > 0) {
        const fn = r.data.functions[0];
        setSelectedFn(fn.id);
        if (fn.categories?.length > 0) setSelectedCat(fn.categories[0].id);
      }
    });
  }, []);

  function getResponse(scId) {
    return { ...(responses[scId] || {}), ...(localEdits[scId] || {}) };
  }

  function updateLocal(scId, field, value) {
    setLocalEdits(prev => ({ ...prev, [scId]: { ...(prev[scId] || {}), [field]: value } }));
    setDirty(prev => new Set(prev).add(scId));
  }

  async function saveSubcategory(scId) {
    const resp = getResponse(scId);
    setSaving(prev => new Set(prev).add(scId));
    try {
      await api.put(`/nist/assessments/${assessment.id}/responses/${scId}`, {
        currentTier:       resp.current_tier ?? 0,
        targetTier:        resp.target_tier  ?? 0,
        testingProcedures: resp.testing_procedures,
        evidence:          resp.evidence,
        testingSteps:      resp.testing_steps,
        gapsObservations:  resp.gaps_observations,
        riskRating:        resp.risk_rating || null,
      });
      setResponses(prev => ({ ...prev, [scId]: { ...prev[scId], ...localEdits[scId] } }));
      setLocalEdits(prev => { const n = { ...prev }; delete n[scId]; return n; });
      setDirty(prev => { const n = new Set(prev); n.delete(scId); return n; });
      onUpdate();
    } catch (err) { console.error(err); }
    finally { setSaving(prev => { const n = new Set(prev); n.delete(scId); return n; }); }
  }

  async function handleComplete() {
    if (!window.confirm('Mark this assessment as complete?')) return;
    setCompleting(true);
    try {
      await api.patch(`/nist/assessments/${assessment.id}/complete`);
      onUpdate();
    } catch (err) { console.error(err); }
    finally { setCompleting(false); }
  }

  const activeFn  = framework?.functions?.find(f => f.id === selectedFn);
  const activeCat = activeFn?.categories?.find(c => c.id === selectedCat);

  // Function scores from assessment
  const funcScores = assessment.function_scores
    ? (typeof assessment.function_scores === 'string' ? JSON.parse(assessment.function_scores) : assessment.function_scores)
    : {};

  if (!framework) {
    return <div style={{ padding: '32px', color: 'var(--text-muted)' }}>Loading framework...</div>;
  }

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button className="btn btn-ghost" onClick={onBack} style={{ gap: '6px' }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={styles.topCenter}>
          <div style={styles.assessTitle}>{assessment.name}</div>
          <div style={styles.assessMeta}>{clientName} • {assessment.assessed_subcategories}/{assessment.total_subcategories} assessed</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={styles.overallScores}>
            <div style={styles.scoreChip}>
              <span style={styles.scoreChipLabel}>Current</span>
              <span style={{ ...styles.scoreChipValue, color: 'var(--blue-primary)' }}>{parseFloat(assessment.overall_current).toFixed(2)}</span>
            </div>
            <div style={styles.scoreChip}>
              <span style={styles.scoreChipLabel}>Target</span>
              <span style={{ ...styles.scoreChipValue, color: 'var(--purple-primary)' }}>{parseFloat(assessment.overall_target).toFixed(2)}</span>
            </div>
          </div>
          {assessment.status !== 'completed' && (
            <button className="btn btn-secondary" onClick={handleComplete} disabled={completing}>
              <CheckCircle size={15} />{completing ? 'Completing...' : 'Mark Complete'}
            </button>
          )}
        </div>
      </div>

      <div style={styles.layout}>
        {/* Function nav */}
        <div style={styles.fnNav}>
          <div style={styles.navHeader}>Functions</div>
          {framework.functions.map(fn => {
            const meta = FUNCTION_META[fn.id] || {};
            const scores = funcScores[fn.id] || { current: 0, target: 0 };
            const isActive = selectedFn === fn.id;
            return (
              <div key={fn.id}>
                <button
                  style={{ ...styles.fnBtn, ...(isActive ? { ...styles.fnBtnActive, borderLeftColor: meta.color } : {}) }}
                  onClick={() => {
                    setSelectedFn(fn.id);
                    if (fn.categories?.length > 0) setSelectedCat(fn.categories[0].id);
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: '600', fontSize: '12px' }}>{fn.id} — {meta.title}</span>
                  </div>
                  {scores.current > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: meta.color }}>
                      {scores.current.toFixed(1)}
                    </span>
                  )}
                </button>
                {/* Category list under active function */}
                {isActive && fn.categories.map(cat => (
                  <button key={cat.id}
                    style={{ ...styles.catBtn, ...(selectedCat === cat.id ? styles.catBtnActive : {}) }}
                    onClick={() => setSelectedCat(cat.id)}>
                    {cat.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Subcategory area */}
        <div style={styles.scArea}>
          {activeCat && (
            <>
              <div style={styles.catHeader}>
                <div>
                  <div style={{ ...styles.catId, color: FUNCTION_META[selectedFn]?.color }}>
                    {activeCat.id}
                  </div>
                  <div style={styles.catTitle}>{activeCat.title}</div>
                  <div style={styles.catDesc}>{activeCat.description}</div>
                </div>
              </div>

              <div style={styles.scList}>
                {activeCat.subcategories.map(sc => {
                  const resp = getResponse(sc.id);
                  const isExpanded = expandedSc === sc.id;
                  const isDirty = dirty.has(sc.id);
                  const isSaving = saving.has(sc.id);
                  const currentTier = resp.current_tier ?? 0;
                  const targetTier  = resp.target_tier  ?? 0;
                  const gap = Math.max(0, targetTier - currentTier);
                  const tierConf = TIER_OPTIONS[currentTier] || TIER_OPTIONS[0];

                  return (
                    <div key={sc.id} style={styles.scCard}>
                      <div style={styles.scHeader} onClick={() => setExpanded(isExpanded ? null : sc.id)}>
                        <div style={styles.scLeft}>
                          <span style={{ ...styles.scId, color: FUNCTION_META[selectedFn]?.color, background: `${FUNCTION_META[selectedFn]?.color}18` }}>
                            {sc.id}
                          </span>
                          <div style={styles.scInfo}>
                            <div style={styles.scDesc}>{sc.description}</div>
                            {currentTier > 0 && (
                              <div style={styles.scTags}>
                                <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '100px', color: tierConf.color, background: `${tierConf.color}18`, border: `1px solid ${tierConf.color}35` }}>
                                  Current: T{currentTier}
                                </span>
                                {targetTier > 0 && (
                                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '100px', color: 'var(--purple-primary)', background: 'rgba(155,75,245,0.1)', border: '1px solid rgba(155,75,245,0.3)' }}>
                                    Target: T{targetTier}
                                  </span>
                                )}
                                {gap > 0 && (
                                  <span style={{ fontSize: '10px', color: 'var(--medium)', padding: '1px 8px', borderRadius: '100px', background: 'rgba(255,184,59,0.1)', border: '1px solid rgba(255,184,59,0.3)' }}>
                                    Gap: {gap}
                                  </span>
                                )}
                                {resp.risk_rating && (
                                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '100px', color: RISK_COLORS[resp.risk_rating], background: `${RISK_COLORS[resp.risk_rating]}18`, border: `1px solid ${RISK_COLORS[resp.risk_rating]}35` }}>
                                    {resp.risk_rating}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {isDirty && (
                            <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '12px', gap: '4px' }}
                              onClick={e => { e.stopPropagation(); saveSubcategory(sc.id); }}
                              disabled={isSaving}>
                              <Save size={12} />{isSaving ? 'Saving...' : 'Save'}
                            </button>
                          )}
                          {!isDirty && currentTier > 0 && <CheckCircle size={15} color="var(--health-green)" />}
                          {isExpanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={styles.scForm}>
                          {/* Tier selectors */}
                          <TierPicker
                            label="Current Tier"
                            value={currentTier}
                            onChange={v => updateLocal(sc.id, 'current_tier', v)}
                          />
                          <TierPicker
                            label="Target Tier"
                            value={targetTier}
                            onChange={v => updateLocal(sc.id, 'target_tier', v)}
                          />

                          {/* Gap callout */}
                          {currentTier > 0 && targetTier > 0 && gap > 0 && (
                            <div style={styles.gapCallout}>
                              <span style={{ fontWeight: '700', color: 'var(--medium)' }}>Gap: {gap} tier{gap !== 1 ? 's' : ''}</span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {' '}from {TIER_OPTIONS[currentTier]?.label} to {TIER_OPTIONS[targetTier]?.label}
                              </span>
                            </div>
                          )}

                          {/* Testing Procedures */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Testing Procedures</div>
                            <textarea style={styles.textarea} rows={3}
                              value={resp.testing_procedures || ''}
                              onChange={e => updateLocal(sc.id, 'testing_procedures', e.target.value)}
                              placeholder="Your standard methodology for assessing this subcategory..." />
                          </div>

                          {/* Evidence */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Evidence (Suralink Reference)</div>
                            <input className="input" value={resp.evidence || ''}
                              onChange={e => updateLocal(sc.id, 'evidence', e.target.value)}
                              placeholder="Suralink request title or reference..." />
                          </div>

                          {/* Testing Steps */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Testing Steps</div>
                            <textarea style={styles.textarea} rows={3}
                              value={resp.testing_steps || ''}
                              onChange={e => updateLocal(sc.id, 'testing_steps', e.target.value)}
                              placeholder="What you did and observed during this assessment..." />
                          </div>

                          {/* Gaps / Observations */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Gaps / Observations</div>
                            <textarea style={styles.textarea} rows={3}
                              value={resp.gaps_observations || ''}
                              onChange={e => updateLocal(sc.id, 'gaps_observations', e.target.value)}
                              placeholder="Gaps identified, observations, or client-specific context..." />
                          </div>

                          {/* Risk Rating */}
                          <div style={styles.fieldGroup}>
                            <div style={styles.fieldLabel}>Risk Rating</div>
                            <select className="input" style={{ maxWidth: '220px' }}
                              value={resp.risk_rating || ''}
                              onChange={e => updateLocal(sc.id, 'risk_rating', e.target.value)}>
                              <option value="">None / Not Rated</option>
                              {RISK_OPTIONS.slice(1).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                            {isDirty && (
                              <button className="btn btn-ghost"
                                onClick={() => {
                                  setLocalEdits(prev => { const n = { ...prev }; delete n[sc.id]; return n; });
                                  setDirty(prev => { const n = new Set(prev); n.delete(sc.id); return n; });
                                }}>
                                Discard
                              </button>
                            )}
                            <button className="btn btn-primary"
                              onClick={() => saveSubcategory(sc.id)} disabled={isSaving}>
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

const styles = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--navy-950)', gap: '16px', flexShrink: 0 },
  topCenter: { flex: 1, textAlign: 'center' },
  assessTitle: { fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700' },
  assessMeta: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' },
  overallScores: { display: 'flex', gap: '12px' },
  scoreChip: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 12px', background: 'var(--navy-800)', borderRadius: '8px', border: '1px solid var(--border-subtle)' },
  scoreChipLabel: { fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' },
  scoreChipValue: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', lineHeight: 1 },
  layout: { display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, overflow: 'hidden' },
  fnNav: { borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '12px 8px' },
  navHeader: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', padding: '4px 8px 10px' },
  fnBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: '8px', background: 'transparent', border: 'none', borderLeft: '2px solid transparent', cursor: 'pointer', color: 'var(--text-secondary)', textAlign: 'left', gap: '8px', transition: 'all 0.15s ease', marginBottom: '2px' },
  fnBtnActive: { background: 'rgba(75,110,245,0.08)', color: 'var(--text-primary)' },
  catBtn: { width: '100%', padding: '6px 10px 6px 28px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'left', borderRadius: '6px', transition: 'all 0.15s ease', marginBottom: '2px' },
  catBtnActive: { background: 'rgba(75,110,245,0.1)', color: 'var(--text-primary)' },
  scArea: { overflowY: 'auto', padding: '20px 24px' },
  catHeader: { marginBottom: '20px' },
  catId: { fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' },
  catTitle: { fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '700', marginBottom: '8px' },
  catDesc: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 },
  scList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  scCard: { background: 'var(--gradient-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' },
  scHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', gap: '12px' },
  scLeft: { display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 },
  scId: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', flexShrink: 0, marginTop: '2px' },
  scInfo: { flex: 1, minWidth: 0 },
  scDesc: { fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '6px' },
  scTags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  scForm: { padding: '0 16px 20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' },
  tierGrid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  tierBtn: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s ease', width: '100%' },
  gapCallout: { padding: '10px 14px', background: 'rgba(255,184,59,0.08)', border: '1px solid rgba(255,184,59,0.25)', borderRadius: '8px', fontSize: '13px' },
  fieldGroup: {},
  fieldLabel: { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' },
  textarea: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: '13px', outline: 'none', resize: 'vertical', lineHeight: 1.6 },
};
