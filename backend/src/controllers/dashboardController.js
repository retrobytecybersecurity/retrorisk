const pool = require('../config/database');
const { decrypt } = require('../utils/encryption');

async function getDashboard(req, res) {
  try {
    // Client health summary
    const healthResult = await pool.query(
      `SELECT health_status, COUNT(*) as count
       FROM clients WHERE status = 'active'
       GROUP BY health_status`
    );

    const health = { red: 0, amber: 0, green: 0 };
    healthResult.rows.forEach(r => { health[r.health_status] = parseInt(r.count); });

    // Upcoming reminders (next 30 days, not dismissed)
    const remindersResult = await pool.query(
      `SELECT r.id, r.type, r.title, r.due_date, r.framework,
              c.id as client_id, c.organization_name
       FROM reminders r
       JOIN clients c ON c.id = r.client_id
       WHERE r.is_dismissed = false
         AND r.due_date <= CURRENT_DATE + INTERVAL '30 days'
         AND c.status != 'offboarded'
       ORDER BY r.due_date ASC
       LIMIT 20`
    );

    // Review queue - roadmap items flagged by clients (placeholder for now)
    const reviewQueue = [];

    // Total active clients
    const clientCountResult = await pool.query(
      `SELECT COUNT(*) as total FROM clients WHERE status = 'active'`
    );

    // Clients with upcoming contract renewals (60 days)
    const renewalsResult = await pool.query(
      `SELECT id, organization_name, contract_renewal_date
       FROM clients
       WHERE status = 'active'
         AND contract_renewal_date <= CURRENT_DATE + INTERVAL '60 days'
         AND contract_renewal_date >= CURRENT_DATE
       ORDER BY contract_renewal_date ASC`
    );

    // Data deletion tasks
    const deletionResult = await pool.query(
      `SELECT id, organization_name, data_deletion_due_at
       FROM clients
       WHERE status = 'offboarded'
         AND data_deletion_due_at IS NOT NULL
       ORDER BY data_deletion_due_at ASC`
    );

    return res.json({
      health,
      totalActiveClients: parseInt(clientCountResult.rows[0].total),
      reminders: remindersResult.rows,
      reviewQueue,
      upcomingRenewals: renewalsResult.rows,
      dataDeletionTasks: deletionResult.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function dismissReminder(req, res) {
  const { id } = req.params;
  try {
    await pool.query('UPDATE reminders SET is_dismissed = true WHERE id = $1', [id]);
    return res.json({ message: 'Reminder dismissed' });
  } catch (err) {
    console.error('Dismiss reminder error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateClientHealth(clientId) {
  // This will be called by various modules as data changes
  // For now placeholder logic - will be expanded in later stages
  try {
    // Check for open critical findings (pen test - placeholder)
    // Check overdue roadmap items (roadmap - placeholder)
    // Check assessment currency

    const assessmentCheck = await pool.query(
      `SELECT last_vuln_scan, last_cis_assessment, last_nist_assessment, last_pentest, last_phishing
       FROM clients WHERE id = $1`,
      [clientId]
    );

    if (!assessmentCheck.rows[0]) return;

    const client = assessmentCheck.rows[0];
    const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const hasStaleAssessment = [
      client.last_cis_assessment,
      client.last_nist_assessment
    ].some(date => !date || new Date(date) < twelveMonthsAgo);

    let healthStatus = 'green';
    if (hasStaleAssessment) healthStatus = 'red';

    await pool.query('UPDATE clients SET health_status = $1 WHERE id = $2', [healthStatus, clientId]);
  } catch (err) {
    console.error('Health update error:', err);
  }
}

module.exports = { getDashboard, dismissReminder, updateClientHealth };
