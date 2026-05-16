import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const STATUS_COLORS = {
  Open:          'var(--critical)',
  'In Progress': 'var(--blue-primary)',
  Completed:     'var(--health-green)',
  'Risk Accepted':'var(--info)',
};

export default function RoadmapDonut({ summary }) {
  const data = [
    { name: 'Open',          value: parseInt(summary.open)          || 0 },
    { name: 'In Progress',   value: parseInt(summary.in_progress)   || 0 },
    { name: 'Completed',     value: parseInt(summary.completed)      || 0 },
    { name: 'Risk Accepted', value: parseInt(summary.risk_accepted)  || 0 },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <div style={{ width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
        No data
      </div>
    );
  }

  return (
    <div style={{ width: 100, height: 100 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={48}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={STATUS_COLORS[entry.name] || 'var(--text-muted)'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'var(--navy-800)', border: '1px solid var(--border-accent)', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: 'var(--text-primary)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
