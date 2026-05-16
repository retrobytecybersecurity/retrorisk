import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../utils/api';
import {
  Users, AlertTriangle, CheckCircle, Clock,
  Calendar, Trash2, Bell, RefreshCw, ChevronRight,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function dismissReminder(id) {
    try {
      await api.patch(`/dashboard/reminders/${id}/dismiss`);
      setData(prev => ({
        ...prev,
        reminders: prev.reminders.filter(r => r.id !== id)
      }));
    } catch (err) {
      console.error('Dismiss error:', err);
    }
  }

  if (loading) return <LoadingSkeleton />;

  const totalClients = data?.totalActiveClients || 0;
  const health = data?.health || {};

  return (
    <div style={styles.page} className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={styles.greeting}>
            Good {getTimeOfDay()},{' '}
            <span className="gradient-text">{user?.username}</span>
          </h1>
          <p style={styles.subtitle}>Here's your vCISO operations overview</p>
        </div>
        <button onClick={fetchDashboard} className="btn btn-ghost" style={{ gap: '6px' }}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat cards row */}
      <div style={styles.statsGrid}>
        <StatCard
          label="Active Clients"
          value={totalClients}
          icon={<Users size={18} />}
          color="var(--blue-primary)"
          onClick={() => navigate('/clients')}
        />
        <StatCard
          label="At Risk"
          value={health.red || 0}
          icon={<AlertTriangle size={18} />}
          color="var(--critical)"
          badge="red"
        />
        <StatCard
          label="Needs Attention"
          value={health.amber || 0}
          icon={<Clock size={18} />}
          color="var(--medium)"
          badge="amber"
        />
        <StatCard
          label="On Track"
          value={health.green || 0}
          icon={<CheckCircle size={18} />}
          color="var(--health-green)"
          badge="green"
        />
      </div>

      {/* Main content grid */}
      <div style={styles.mainGrid}>
        {/* Reminders panel */}
        <div style={styles.leftCol}>
          <div className="card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitle}>
                <Bell size={16} color="var(--blue-primary)" />
                Upcoming Reminders
              </div>
              <span style={styles.reminderCount}>{data?.reminders?.length || 0}</span>
            </div>
            <div style={styles.panelBody}>
              {data?.reminders?.length === 0 ? (
                <EmptyState message="No upcoming reminders" />
              ) : (
                data.reminders.map(reminder => (
                  <ReminderItem
                    key={reminder.id}
                    reminder={reminder}
                    onDismiss={() => dismissReminder(reminder.id)}
                    onClick={() => navigate(`/clients/${reminder.client_id}`)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Review Queue */}
          <div className="card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitle}>
                <CheckCircle size={16} color="var(--cyan-accent)" />
                Review Queue
              </div>
              <span style={styles.reminderCount}>{data?.reviewQueue?.length || 0}</span>
            </div>
            <div style={styles.panelBody}>
              {data?.reviewQueue?.length === 0 ? (
                <EmptyState message="No items pending review" />
              ) : (
                data.reviewQueue.map(item => (
                  <ReviewItem key={item.id} item={item} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={styles.rightCol}>
          {/* Contract renewals */}
          <div className="card" style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitle}>
                <Calendar size={16} color="var(--purple-primary)" />
                Contract Renewals
              </div>
            </div>
            <div style={styles.panelBody}>
              {data?.upcomingRenewals?.length === 0 ? (
                <EmptyState message="No renewals in next 60 days" />
              ) : (
                data.upcomingRenewals.map(client => (
                  <RenewalItem
                    key={client.id}
                    client={client}
                    onClick={() => navigate(`/clients/${client.id}`)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Data deletion tasks */}
          {data?.dataDeletionTasks?.length > 0 && (
            <div className="card" style={{ ...styles.panel, borderColor: 'rgba(255,59,92,0.3)' }}>
              <div style={styles.panelHeader}>
                <div style={styles.panelTitle}>
                  <Trash2 size={16} color="var(--critical)" />
                  Data Deletion Required
                </div>
              </div>
              <div style={styles.panelBody}>
                {data.dataDeletionTasks.map(client => (
                  <DeletionItem
                    key={client.id}
                    client={client}
                    onClick={() => navigate(`/clients/${client.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, badge, onClick }) {
  return (
    <div
      className="card"
      style={{ ...styles.statCard, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div style={{ ...styles.statIcon, background: `${color}20`, color }}>
        {icon}
      </div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      {badge && (
        <div style={{
          ...styles.statIndicator,
          background: color,
          boxShadow: `0 0 12px ${color}60`
        }} />
      )}
    </div>
  );
}

function ReminderItem({ reminder, onDismiss, onClick }) {
  const typeColors = {
    checkin: 'var(--blue-primary)',
    assessment: 'var(--purple-primary)',
    renewal: 'var(--medium)',
    data_deletion: 'var(--critical)',
    review_request: 'var(--cyan-accent)',
  };

  const daysUntil = Math.ceil((new Date(reminder.due_date) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div style={styles.reminderItem}>
      <div
        style={{ ...styles.reminderDot, background: typeColors[reminder.type] || 'var(--blue-primary)' }}
      />
      <div style={styles.reminderContent} onClick={onClick}>
        <div style={styles.reminderTitle}>{reminder.title}</div>
        <div style={styles.reminderMeta}>
          {reminder.organization_name} •{' '}
          <span style={{ color: daysUntil <= 3 ? 'var(--critical)' : 'var(--text-muted)' }}>
            {daysUntil === 0 ? 'Today' : daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d`}
          </span>
        </div>
      </div>
      <button style={styles.dismissBtn} onClick={onDismiss} title="Dismiss">×</button>
    </div>
  );
}

function ReviewItem({ item }) {
  return (
    <div style={styles.reminderItem}>
      <div style={{ ...styles.reminderDot, background: 'var(--cyan-accent)' }} />
      <div style={styles.reminderContent}>
        <div style={styles.reminderTitle}>{item.title}</div>
        <div style={styles.reminderMeta}>{item.clientName} • {item.source} • {item.priority}</div>
      </div>
      <ChevronRight size={14} color="var(--text-muted)" />
    </div>
  );
}

function RenewalItem({ client, onClick }) {
  const daysUntil = Math.ceil((new Date(client.contract_renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
  return (
    <div style={{ ...styles.reminderItem, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ ...styles.reminderDot, background: 'var(--purple-primary)' }} />
      <div style={styles.reminderContent}>
        <div style={styles.reminderTitle}>{client.organization_name}</div>
        <div style={styles.reminderMeta}>Renews in {daysUntil} days</div>
      </div>
      <ChevronRight size={14} color="var(--text-muted)" />
    </div>
  );
}

function DeletionItem({ client, onClick }) {
  return (
    <div style={{ ...styles.reminderItem, cursor: 'pointer' }} onClick={onClick}>
      <div style={{ ...styles.reminderDot, background: 'var(--critical)' }} />
      <div style={styles.reminderContent}>
        <div style={{ ...styles.reminderTitle, color: 'var(--critical)' }}>{client.organization_name}</div>
        <div style={styles.reminderMeta}>
          Delete by {new Date(client.data_deletion_due_at).toLocaleDateString()}
        </div>
      </div>
      <ChevronRight size={14} color="var(--critical)" />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={styles.emptyState}>{message}</div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={styles.page}>
      <div style={{ marginBottom: 32 }}>
        <div className="skeleton" style={{ height: 28, width: 280, marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 16, width: 200 }} />
      </div>
      <div style={styles.statsGrid}>
        {[1,2,3,4].map(i => (
          <div key={i} className="card skeleton" style={{ height: 120 }} />
        ))}
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = {
  page: { padding: '32px', maxWidth: '1400px', margin: '0 auto' },
  greeting: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '0.03em',
    marginBottom: '4px',
  },
  subtitle: { color: 'var(--text-secondary)', fontSize: '14px' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '28px',
  },
  statCard: {
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.2s ease',
  },
  statIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: 1,
    marginBottom: '6px',
    color: 'var(--text-primary)',
  },
  statLabel: { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' },
  statIndicator: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  leftCol: { display: 'flex', flexDirection: 'column', gap: '20px' },
  rightCol: { display: 'flex', flexDirection: 'column', gap: '20px' },
  panel: { overflow: 'hidden' },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  panelTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: '600',
    letterSpacing: '0.03em',
  },
  reminderCount: {
    background: 'rgba(75,110,245,0.15)',
    color: 'var(--blue-light)',
    borderRadius: '100px',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: '600',
  },
  panelBody: { padding: '8px 0' },
  reminderItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background 0.15s ease',
  },
  reminderDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  reminderContent: { flex: 1, minWidth: 0, cursor: 'pointer' },
  reminderTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-primary)',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  reminderMeta: { fontSize: '11px', color: 'var(--text-muted)' },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'color 0.15s ease',
  },
  emptyState: {
    padding: '32px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px',
  },
};
