import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import {
  Shield, FileSearch, Target, Mail, Map,
  TrendingUp, TrendingDown, Minus, ChevronRight,
  AlertTriangle, CheckCircle, Clock
} from 'lucide-react';

const TREND_CONFIG = {
  improving: { icon: <TrendingUp size={14} />,  color: 'var(--health-green)', label: 'Improving' },
  declining: { icon: <TrendingDown size={14} />, color: 'var(--critical)',     label: 'Declining' },
  neutral:   { icon: <Minus size={14} />,        color: 'var(--medium)',       label: 'Neutral' },
  first:     { icon: <Mail size={14} />,         color: 'var(--blue-primary)', label: 'First Campaign' },
};

export default function PortalOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/portal/vuln/latest').catch(() => ({ data: null })),
      api.get('/portal/pentest/summary').catch(() => ({ data: null })),
      api.get('/portal/phishing/summary').catch(() => ({ data: null })),
      api.get('/portal/cis/summary').catch(() => ({ data: null })),
      api.get('/portal/nist/summary').catch(() => ({ data: null })),
      api.get('/portal/roadmap').catch(() => ({ data: { items: [], summary: {} } })),
    ]).then(([vuln, pentest, phishing, cis, nist, roadmap]) => {
      setData({
        vuln:     vuln.data,
        pentest:  pentest.data,
        phishing: phishing.data,
        cis:      cis.data,
        nist:     nist.data,
        roadmap:  roadmap.data,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;

  const roadmapSummary = data.roadmap?.summary || {};
  const openItems      = parseInt(roadmapSummary.open_total) || 0;
  const completedItems = parseInt(roadmapSummary.completed) || 0;
  const totalItems     = parseInt(roadmapSummary.total) || 0;
  const completionPct  = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div style={styles.page} className="animate-fade-in">
      {/* Welcome header */}
      <div style={styles.welcomeBar}>
        <div>
          <h1 style={styles.welcome}>Welcome to your Security Portal</h1>
          <p style={styles.welcomeSub}>Here's an overview of your current security posture</p>
        </div>
        <div style={styles.portalBadge}>
          <Shield size={14} color="var(--blue-primary)" />
          <span>Client Portal</span>
        </div>
      </div>

      {/* Roadmap headline */}
      {totalItems > 0 && (
        <div className="card" style={styles.roadmapBanner} onClick={() => navigate('/portal/roadmap')}>
          <div style={styles.roadmapLeft}>
            <Map size={20} color="var(--blue-primary)" />
            <div>
              <div style={styles.roadmapTitle}>Remediation Roadmap</div>
              <div style={styles.roadmapSub}>{openItems} open item{openItems !== 1 ? 's' : ''} • {completionPct}% complete</div>
            </div>
          </div>
          <div style={styles.roadmapRight}>
            <div style={styles.roadmapProgressWrap}>
              <div style={styles.roadmapProgressBar}>
                <div style={{ ...styles.roadmapProgressFill, width: `${completionPct}%` }} />
              </div>
              <span style={styles.roadmapPct}>{completionPct}%</span>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>
        </div>
      )}

      {/* Module cards grid */}
      <div style={styles.grid}>
        {/* Vulnerability */}
        <ModuleCard
          title="Vulnerability Scan"
          icon={<FileSearch size={18} />}
          color="var(--high)"
          onClick={() => navigate('/portal/vulnerability')}
          empty={!data.vuln}
          emptyMsg="No scan results available"
        >
          {data.vuln && (
            <>
              <div style={styles.cardMeta}>{data.vuln.scan?.name}</div>
              <div style={styles.sevRow}>
                <SevCount label="C" count={data.vuln.scan?.critical_count} color="var(--critical)" />
                <SevCount label="H" count={data.vuln.scan?.high_count}     color="var(--high)" />
                <SevCount label="M" count={data.vuln.scan?.medium_count}   color="var(--medium)" />
                <SevCount label="L" count={data.vuln.scan?.low_count}      color="var(--low)" />
              </div>
              <div style={styles.cardDetail}>{data.vuln.scan?.finding_count} unique findings</div>
            </>
          )}
        </ModuleCard>

        {/* Pentest */}
        <ModuleCard
          title="Penetration Test"
          icon={<Target size={18} />}
          color="var(--critical)"
          onClick={() => navigate('/portal/pentest')}
          empty={!data.pentest}
          emptyMsg="No penetration test results available"
        >
          {data.pentest && (
            <>
              <div style={styles.cardMeta}>{data.pentest.engagement?.name}</div>
              <div style={styles.sevRow}>
                <SevCount label="C" count={data.pentest.engagement?.critical_open} color="var(--critical)" />
                <SevCount label="H" count={data.pentest.engagement?.high_open}     color="var(--high)" />
                <SevCount label="M" count={data.pentest.engagement?.medium_open}   color="var(--medium)" />
                <SevCount label="L" count={data.pentest.engagement?.low_open}      color="var(--low)" />
              </div>
              <div style={styles.cardDetail}>{data.pentest.findings?.length} findings • {data.pentest.engagement?.engagement_type}</div>
            </>
          )}
        </ModuleCard>

        {/* Phishing */}
        <ModuleCard
          title="Phishing Assessment"
          icon={<Mail size={18} />}
          color="var(--medium)"
          onClick={() => navigate('/portal/phishing')}
          empty={!data.phishing}
          emptyMsg="No phishing assessments available"
        >
          {data.phishing && (
            <>
              <div style={styles.cardMeta}>{data.phishing.latestCampaign?.name}</div>
              <div style={styles.metricRow}>
                <Metric label="Click Rate" value={`${parseFloat(data.phishing.latestCampaign?.click_rate || 0).toFixed(1)}%`} color={parseFloat(data.phishing.latestCampaign?.click_rate) > 20 ? 'var(--critical)' : 'var(--health-green)'} />
                <Metric label="Report Rate" value={`${parseFloat(data.phishing.latestCampaign?.report_rate || 0).toFixed(1)}%`} color="var(--health-green)" />
              </div>
              {data.phishing.latestCampaign?.trend_direction && (
                <TrendPill direction={data.phishing.latestCampaign.trend_direction} />
              )}
            </>
          )}
        </ModuleCard>

        {/* CIS v8 */}
        <ModuleCard
          title="CIS Controls v8"
          icon={<Shield size={18} />}
          color="var(--blue-primary)"
          onClick={() => navigate('/portal/cis')}
          empty={!data.cis}
          emptyMsg="No CIS assessment available"
        >
          {data.cis && (
            <>
              <div style={styles.cardMeta}>{data.cis.name}</div>
              <div style={styles.bigScore}>
                <span style={{ color: getScoreColor(parseFloat(data.cis.overall_score)) }}>
                  {parseFloat(data.cis.overall_score).toFixed(1)}%
                </span>
                <span style={styles.bigScoreLabel}>Maturity</span>
              </div>
              <div style={styles.progressBarSmall}>
                <div style={{ width: `${data.cis.overall_score}%`, height: '100%', borderRadius: '2px', background: getScoreColor(parseFloat(data.cis.overall_score)) }} />
              </div>
              <div style={styles.cardDetail}>{data.cis.ig_level} • {data.cis.assessed_subcategories}/{data.cis.total_safeguards} assessed</div>
            </>
          )}
        </ModuleCard>

        {/* NIST CSF 2.0 */}
        <ModuleCard
          title="NIST CSF 2.0"
          icon={<Shield size={18} />}
          color="var(--purple-primary)"
          onClick={() => navigate('/portal/nist')}
          empty={!data.nist}
          emptyMsg="No NIST assessment available"
        >
          {data.nist && (
            <>
              <div style={styles.cardMeta}>{data.nist.name}</div>
              <div style={styles.tierRow}>
                <TierBox label="Current" value={parseFloat(data.nist.overall_current)} color="var(--blue-primary)" />
                <div style={styles.tierArrow}>→</div>
                <TierBox label="Target"  value={parseFloat(data.nist.overall_target)}  color="var(--purple-primary)" />
              </div>
              <div style={styles.cardDetail}>
                Gap: {Math.max(0, parseFloat(data.nist.overall_target) - parseFloat(data.nist.overall_current)).toFixed(2)} tiers
              </div>
            </>
          )}
        </ModuleCard>

        {/* Roadmap summary card */}
        <ModuleCard
          title="Remediation Roadmap"
          icon={<Map size={18} />}
          color="var(--health-green)"
          onClick={() => navigate('/portal/roadmap')}
          empty={totalItems === 0}
          emptyMsg="No roadmap items assigned"
        >
          {totalItems > 0 && (
            <>
              <div style={styles.roadmapCardMetrics}>
                <RoadmapStat icon={<AlertTriangle size={13} />} label="Open"      value={openItems}      color="var(--critical)" />
                <RoadmapStat icon={<CheckCircle size={13} />}   label="Completed" value={completedItems} color="var(--health-green)" />
                <RoadmapStat icon={<Clock size={13} />}         label="Total"     value={totalItems}     color="var(--text-muted)" />
              </div>
              <div style={styles.progressBarSmall}>
                <div style={{ width: `${completionPct}%`, height: '100%', borderRadius: '2px', background: 'var(--gradient-brand)' }} />
              </div>
              <div style={styles.cardDetail}>{completionPct}% complete</div>
            </>
          )}
        </ModuleCard>
      </div>
    </div>
  );
}

function ModuleCard({ title, icon, color, onClick, empty, emptyMsg, children }) {
  return (
    <div className="card" style={{ ...styles.moduleCard, cursor: 'pointer' }} onClick={onClick}>
      <div style={styles.moduleCardHeader}>
        <div style={{ ...styles.moduleIcon, color, background: `${color}18` }}>{icon}</div>
        <span style={styles.moduleTitle}>{title}</span>
        <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
      </div>
      <div style={styles.moduleCardBody}>
        {empty ? (
          <div style={styles.emptyCard}>{emptyMsg}</div>
        ) : children}
      </div>
    </div>
  );
}

function SevCount({ label, count, color }) {
  if (!count || count === 0) return null;
  return (
    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '100px', color, background: `${color}18`, border: `1px solid ${color}30` }}>
      {label}: {count}
    </span>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '700', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{label}</div>
    </div>
  );
}

function TrendPill({ direction }) {
  const conf = TREND_CONFIG[direction] || TREND_CONFIG.neutral;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: conf.color, background: `${conf.color}15`, padding: '3px 10px', borderRadius: '100px', alignSelf: 'flex-start' }}>
      {conf.icon} {conf.label}
    </div>
  );
}

function TierBox({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', color, lineHeight: 1 }}>
        {value.toFixed(1)}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{label}</div>
    </div>
  );
}

function RoadmapStat({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color }}>
      {icon}
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '700' }}>{value}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function getScoreColor(score) {
  if (score >= 80) return 'var(--health-green)';
  if (score >= 50) return 'var(--medium)';
  return 'var(--critical)';
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '32px' }}>
      <div className="skeleton" style={{ height: '32px', width: '300px', marginBottom: '24px', borderRadius: '6px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="card skeleton" style={{ height: '160px' }} />)}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '32px', maxWidth: '1100px', margin: '0 auto' },
  welcomeBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' },
  welcome: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: '700', letterSpacing: '0.02em', marginBottom: '4px' },
  welcomeSub: { color: 'var(--text-secondary)', fontSize: '14px' },
  portalBadge: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: 'rgba(75,110,245,0.1)', border: '1px solid var(--border-accent)', borderRadius: '100px', fontSize: '12px', fontWeight: '600', color: 'var(--blue-primary)' },
  roadmapBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', marginBottom: '20px', cursor: 'pointer', transition: 'border-color 0.15s ease', gap: '16px' },
  roadmapLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  roadmapTitle: { fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: '700' },
  roadmapSub: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' },
  roadmapRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  roadmapProgressWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
  roadmapProgressBar: { width: '160px', height: '6px', borderRadius: '3px', background: 'var(--navy-600)', overflow: 'hidden' },
  roadmapProgressFill: { height: '100%', borderRadius: '3px', background: 'var(--gradient-brand)', transition: 'width 0.5s ease' },
  roadmapPct: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '700', color: 'var(--blue-primary)', minWidth: '36px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '16px' },
  moduleCard: { overflow: 'hidden', transition: 'border-color 0.15s ease, transform 0.15s ease' },
  moduleCardHeader: { display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 16px 12px', borderBottom: '1px solid var(--border-subtle)' },
  moduleIcon: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  moduleTitle: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '600', letterSpacing: '0.02em', flex: 1 },
  moduleCardBody: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '100px' },
  emptyCard: { color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', paddingTop: '8px' },
  cardMeta: { fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardDetail: { fontSize: '11px', color: 'var(--text-muted)' },
  sevRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  metricRow: { display: 'flex', gap: '20px' },
  bigScore: { display: 'flex', alignItems: 'baseline', gap: '6px' },
  bigScoreLabel: { fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--text-muted)' },
  progressBarSmall: { height: '4px', borderRadius: '2px', background: 'var(--navy-600)', overflow: 'hidden' },
  tierRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  tierArrow: { fontSize: '16px', color: 'var(--text-muted)' },
  roadmapCardMetrics: { display: 'flex', flexDirection: 'column', gap: '6px' },
};
