import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Shield } from 'lucide-react';

const CIS_CONTROLS = [
  'Inventory of Enterprise Assets','Inventory of Software Assets','Data Protection',
  'Secure Configuration','Account Management','Access Control Management',
  'Continuous Vulnerability Management','Audit Log Management','Email & Web Browser Protections',
  'Malware Defenses','Data Recovery','Network Infrastructure Management',
  'Network Monitoring and Defense','Security Awareness Training','Service Provider Management',
  'Application Software Security','Incident Response Management','Penetration Testing',
];

function ScoreBar({ score, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--navy-600)', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: '4px', background: color, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '700', color, minWidth: '42px' }}>
        {score.toFixed(1)}%
      </span>
    </div>
  );
}

export default function PortalCISPage() {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/portal/cis/summary')
      .then(r => setAssessment(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '32px' }}><div className="skeleton" style={{ height: '400px', borderRadius: '12px' }} /></div>;
  if (!assessment) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>
      <Shield size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
      <div>No CIS v8 assessment available yet</div>
    </div>
  );

  const controlScores = typeof assessment.control_scores === 'string'
    ? JSON.parse(assessment.control_scores) : (assessment.control_scores || {});

  const overallScore = parseFloat(assessment.overall_score) || 0;
  const color = overallScore >= 80 ? 'var(--health-green)' : overallScore >= 50 ? 'var(--medium)' : 'var(--critical)';

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }} className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">CIS Controls v8</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>{assessment.name}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{assessment.ig_level}</span>
          <span style={{ padding: '3px 12px', borderRadius: '100px', fontSize: '11px', fontWeight: '700',
            background: assessment.status === 'completed' ? 'rgba(59,255,138,0.1)' : 'rgba(255,184,59,0.1)',
            color: assessment.status === 'completed' ? 'var(--health-green)' : 'var(--medium)',
            border: `1px solid ${assessment.status === 'completed' ? 'rgba(59,255,138,0.3)' : 'rgba(255,184,59,0.3)'}` }}>
            {assessment.status === 'completed' ? 'Completed' : 'In Progress'}
          </span>
        </div>
      </div>

      {/* Overall score */}
      <div className="card" style={{ padding: '28px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Overall Maturity Score
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '52px', fontWeight: '700', color, lineHeight: 1 }}>
              {overallScore.toFixed(1)}%
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div>{assessment.assessed_subcategories} of {assessment.total_safeguards} assessed</div>
          </div>
        </div>
        <ScoreBar score={overallScore} color={color} />
      </div>

      {/* Control group breakdown */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', letterSpacing: '0.03em' }}>
          Maturity by Control Group
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(controlScores).map(([ctrlId, score]) => {
            const s = parseFloat(score) || 0;
            const c = s >= 80 ? 'var(--health-green)' : s >= 50 ? 'var(--medium)' : 'var(--critical)';
            const label = CIS_CONTROLS[parseInt(ctrlId) - 1] || `Control ${ctrlId}`;
            return (
              <div key={ctrlId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--blue-primary)', fontFamily: 'var(--font-mono)', marginRight: '8px' }}>{ctrlId}.</span>
                    {label}
                  </span>
                </div>
                <ScoreBar score={s} color={c} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
