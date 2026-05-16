import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Shield } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from 'recharts';

const FUNCTION_META = {
  GV:{ title:'Govern',   color:'#9b4bf5' }, ID:{ title:'Identify', color:'#4b6ef5' },
  PR:{ title:'Protect',  color:'#00c2ff' }, DE:{ title:'Detect',   color:'#ffb83b' },
  RS:{ title:'Respond',  color:'#ff7b3b' }, RC:{ title:'Recover',  color:'#3bff8a' },
};

export default function PortalNISTPage() {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/portal/nist/summary')
      .then(r => setAssessment(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '32px' }}><div className="skeleton" style={{ height: '400px', borderRadius: '12px' }} /></div>;
  if (!assessment) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>
      <Shield size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
      <div>No NIST CSF 2.0 assessment available yet</div>
    </div>
  );

  const funcScores = typeof assessment.function_scores === 'string'
    ? JSON.parse(assessment.function_scores) : (assessment.function_scores || {});

  const radarData = Object.entries(FUNCTION_META).map(([fn, meta]) => ({
    function: fn,
    Current: funcScores[fn]?.current || 0,
    Target:  funcScores[fn]?.target  || 0,
  }));

  const current = parseFloat(assessment.overall_current) || 0;
  const target  = parseFloat(assessment.overall_target)  || 0;
  const gap     = Math.max(0, target - current).toFixed(2);

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }} className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">NIST CSF 2.0</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>{assessment.name}</p>
        </div>
      </div>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {[
          { label: 'Current Maturity', value: current.toFixed(2), color: 'var(--blue-primary)', sub: 'out of 4.0' },
          { label: 'Target Maturity',  value: target.toFixed(2),  color: 'var(--purple-primary)', sub: 'out of 4.0' },
          { label: 'Gap to Target',    value: gap,                color: gap > 0 ? 'var(--medium)' : 'var(--health-green)', sub: 'tiers to close' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: '700', color: s.color, lineHeight: 1, marginBottom: '6px' }}>{s.value}</div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '3px' }}>{s.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Radar */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', letterSpacing: '0.03em' }}>
          Function Maturity Profile
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData} margin={{ top: 16, right: 40, bottom: 16, left: 40 }}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="function" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }} />
            <PolarRadiusAxis angle={90} domain={[0, 4]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickCount={5} />
            <Radar name="Current" dataKey="Current" stroke="#4b6ef5" fill="#4b6ef5" fillOpacity={0.2} strokeWidth={2} />
            <Radar name="Target"  dataKey="Target"  stroke="#9b4bf5" fill="#9b4bf5" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 2" />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Function breakdown */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '600', letterSpacing: '0.03em' }}>
          Function Breakdown
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {Object.entries(FUNCTION_META).map(([fn, meta]) => {
            const s = funcScores[fn] || { current: 0, target: 0 };
            const g = Math.max(0, s.target - s.current);
            return (
              <div key={fn} style={{ padding: '14px', background: 'var(--navy-800)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: meta.color }}>{fn}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '6px' }}>{meta.title}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700', color: meta.color }}>
                    {(s.current || 0).toFixed(1)}
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--navy-600)', position: 'relative' }}>
                  <div style={{ width: `${(s.current / 4) * 100}%`, height: '100%', borderRadius: '3px', background: meta.color, transition: 'width 0.5s ease' }} />
                  {s.target > 0 && (
                    <div style={{ position: 'absolute', top: '-3px', left: `${(s.target / 4) * 100}%`, width: '2px', height: '12px', background: '#9b4bf5', transform: 'translateX(-50%)' }} />
                  )}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '5px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Target: <strong style={{ color: '#9b4bf5' }}>{(s.target || 0).toFixed(1)}</strong></span>
                  {g > 0 && <span>Gap: <strong style={{ color: 'var(--medium)' }}>{g.toFixed(1)}</strong></span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
