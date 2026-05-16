'use strict';

const pool = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');
const { parseGoPhishCSV, computeMetrics, computeTrend } = require('../utils/goPhishParser');
const { auditLog } = require('../utils/audit');

function decryptTarget(row) {
  return {
    id:                 row.id,
    campaignId:         row.campaign_id,
    firstName:          decrypt(row.first_name_enc),
    lastName:           decrypt(row.last_name_enc),
    email:              decrypt(row.email_enc),
    position:           decrypt(row.position_enc),
    status:             row.status,
    reported:           row.reported,
    flaggedForTraining: row.flagged_for_training,
    trainingCompleted:  row.training_completed,
    trainingCompletedAt: row.training_completed_at,
    isRepeatOffender:   row.is_repeat_offender,
    createdAt:          row.created_at,
  };
}

// ── Import a GoPhish CSV ───────────────────────────────────────────────────────
async function importCampaign(req, res) {
  const { clientId } = req.params;
  const {
    name, campaignDate, phishingType, pretext,
    testingFirm, emailsSent, csvData
  } = req.body;

  if (!csvData)        return res.status(400).json({ error: 'No CSV data provided' });
  if (!name)           return res.status(400).json({ error: 'Campaign name is required' });
  if (!phishingType)   return res.status(400).json({ error: 'Phishing type is required' });
  if (!campaignDate)   return res.status(400).json({ error: 'Campaign date is required' });

  const clientCheck = await pool.query(
    'SELECT id FROM clients WHERE id = $1 AND status = $2',
    [clientId, 'active']
  );
  if (!clientCheck.rows[0]) return res.status(404).json({ error: 'Client not found' });

  let targets;
  try {
    targets = parseGoPhishCSV(csvData);
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }

  const metrics = computeMetrics(targets, parseInt(emailsSent) || targets.length);

  // Get prior campaign click rate for trend calculation
  const priorRes = await pool.query(
    `SELECT click_rate FROM phishing_campaigns
     WHERE client_id = $1
     ORDER BY campaign_date DESC LIMIT 1`,
    [clientId]
  );
  const priorClickRate = priorRes.rows[0]?.click_rate ?? null;
  const trendDirection = computeTrend(metrics.click_rate, priorClickRate);

  // Get prior clickers for repeat offender detection
  const priorClickersRes = await pool.query(
    `SELECT DISTINCT pt.email_enc
     FROM phishing_targets pt
     JOIN phishing_campaigns pc ON pc.id = pt.campaign_id
     WHERE pc.client_id = $1
       AND pt.status IN ('Clicked Link','Submitted Data')`,
    [clientId]
  );
  // We can't easily compare encrypted emails without decrypting — use a Set of decrypted emails
  const priorClickerEmails = new Set(
    priorClickersRes.rows.map(r => decrypt(r.email_enc)).filter(Boolean)
  );

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Insert campaign
    const campaignRes = await dbClient.query(
      `INSERT INTO phishing_campaigns (
         client_id, name, campaign_date, phishing_type, pretext, testing_firm,
         emails_sent, opened, clicked, submitted, reported,
         open_rate, click_rate, submission_rate, report_rate,
         trend_direction, imported_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        clientId, name.trim(), campaignDate, phishingType,
        pretext || null, testingFirm || null,
        metrics.emails_sent, metrics.opened, metrics.clicked,
        metrics.submitted, metrics.reported,
        metrics.open_rate, metrics.click_rate,
        metrics.submission_rate, metrics.report_rate,
        trendDirection, req.user.userId
      ]
    );

    const campaignId = campaignRes.rows[0].id;

    // Insert targets with encrypted PII
    for (const t of targets) {
      const isRepeat = (
        (t.status === 'Clicked Link' || t.status === 'Submitted Data') &&
        t.email && priorClickerEmails.has(t.email)
      );

      const shouldFlag = t.status === 'Clicked Link' || t.status === 'Submitted Data';

      await dbClient.query(
        `INSERT INTO phishing_targets (
           campaign_id, client_id,
           first_name_enc, last_name_enc, email_enc, position_enc,
           status, reported,
           flagged_for_training, is_repeat_offender
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          campaignId, clientId,
          encrypt(t.first_name), encrypt(t.last_name),
          encrypt(t.email), encrypt(t.position),
          t.status, t.reported,
          shouldFlag, isRepeat
        ]
      );
    }

    // Update client last phishing date
    await dbClient.query(
      'UPDATE clients SET last_phishing = CURRENT_DATE WHERE id = $1',
      [clientId]
    );

    await dbClient.query('COMMIT');

    await auditLog({
      userId: req.user.userId,
      action: 'PHISHING_CAMPAIGN_IMPORTED',
      entityType: 'phishing_campaign',
      entityId: campaignId,
      newValue: { name, phishingType, targetCount: targets.length, clickRate: metrics.click_rate },
      ipAddress: req.ip
    });

    return res.status(201).json({
      campaignId,
      metrics,
      trendDirection,
      targetCount: targets.length,
    });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Import campaign error:', err);
    return res.status(500).json({ error: 'Failed to import campaign' });
  } finally {
    dbClient.release();
  }
}

// ── List campaigns for a client ────────────────────────────────────────────────
async function listCampaigns(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, campaign_date, phishing_type, pretext, testing_firm,
              emails_sent, opened, clicked, submitted, reported,
              open_rate, click_rate, submission_rate, report_rate,
              trend_direction, created_at
       FROM phishing_campaigns
       WHERE client_id = $1
       ORDER BY campaign_date DESC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('List campaigns error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Get targets for a campaign (admin only — never exposed to client) ──────────
async function getCampaignTargets(req, res) {
  const { campaignId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, first_name_enc, last_name_enc, email_enc, position_enc,
              status, reported, flagged_for_training,
              training_completed, training_completed_at, is_repeat_offender
       FROM phishing_targets
       WHERE campaign_id = $1
       ORDER BY
         CASE status
           WHEN 'Submitted Data' THEN 1
           WHEN 'Clicked Link'   THEN 2
           WHEN 'Email Opened'   THEN 3
           WHEN 'Email Reported' THEN 4
           ELSE 5
         END`,
      [campaignId]
    );
    return res.json(result.rows.map(decryptTarget));
  } catch (err) {
    console.error('Get targets error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Update training status for a target ───────────────────────────────────────
async function updateTraining(req, res) {
  const { targetId } = req.params;
  const { trainingCompleted } = req.body;

  try {
    await pool.query(
      `UPDATE phishing_targets SET
         training_completed = $1,
         training_completed_at = $2
       WHERE id = $3`,
      [
        trainingCompleted,
        trainingCompleted ? new Date() : null,
        targetId
      ]
    );

    await auditLog({
      userId: req.user.userId,
      action: 'PHISHING_TRAINING_UPDATED',
      entityType: 'phishing_target',
      entityId: targetId,
      newValue: { trainingCompleted },
      ipAddress: req.ip
    });

    return res.json({ message: 'Training status updated' });
  } catch (err) {
    console.error('Update training error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Delete a campaign ─────────────────────────────────────────────────────────
async function deleteCampaign(req, res) {
  const { campaignId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM phishing_campaigns WHERE id = $1 RETURNING id, name',
      [campaignId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found' });

    await auditLog({
      userId: req.user.userId,
      action: 'PHISHING_CAMPAIGN_DELETED',
      entityType: 'phishing_campaign',
      entityId: campaignId,
      newValue: { name: result.rows[0].name },
      ipAddress: req.ip
    });

    return res.json({ message: 'Campaign deleted' });
  } catch (err) {
    console.error('Delete campaign error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Trend data ─────────────────────────────────────────────────────────────────
async function getTrendData(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, campaign_date, phishing_type,
              click_rate, submission_rate, report_rate, open_rate,
              trend_direction
       FROM phishing_campaigns
       WHERE client_id = $1
       ORDER BY campaign_date ASC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Phishing trend error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Repeat offenders across all campaigns ─────────────────────────────────────
async function getRepeatOffenders(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         pt.first_name_enc, pt.last_name_enc, pt.email_enc, pt.position_enc,
         COUNT(*) as fail_count,
         MAX(pc.campaign_date) as last_fail_date,
         BOOL_OR(pt.training_completed) as any_training_completed,
         BOOL_AND(pt.training_completed) as all_training_completed
       FROM phishing_targets pt
       JOIN phishing_campaigns pc ON pc.id = pt.campaign_id
       WHERE pc.client_id = $1
         AND pt.status IN ('Clicked Link','Submitted Data')
       GROUP BY pt.first_name_enc, pt.last_name_enc, pt.email_enc, pt.position_enc
       HAVING COUNT(*) > 1
       ORDER BY COUNT(*) DESC`,
      [clientId]
    );

    return res.json(result.rows.map(r => ({
      firstName:            decrypt(r.first_name_enc),
      lastName:             decrypt(r.last_name_enc),
      email:                decrypt(r.email_enc),
      position:             decrypt(r.position_enc),
      failCount:            parseInt(r.fail_count),
      lastFailDate:         r.last_fail_date,
      anyTrainingCompleted: r.any_training_completed,
      allTrainingCompleted: r.all_training_completed,
    })));
  } catch (err) {
    console.error('Repeat offenders error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Client portal — headline metrics only ─────────────────────────────────────
async function getClientPortalSummary(req, res) {
  const clientId = req.user.clientId;
  try {
    // Most recent campaign
    const latest = await pool.query(
      `SELECT id, name, campaign_date, phishing_type,
              emails_sent, click_rate, submission_rate, report_rate, open_rate,
              trend_direction
       FROM phishing_campaigns
       WHERE client_id = $1
       ORDER BY campaign_date DESC LIMIT 1`,
      [clientId]
    );

    if (!latest.rows[0]) return res.json(null);

    // Trend data for graph
    const trend = await pool.query(
      `SELECT campaign_date, click_rate, submission_rate, report_rate
       FROM phishing_campaigns
       WHERE client_id = $1
       ORDER BY campaign_date ASC`,
      [clientId]
    );

    return res.json({
      latestCampaign: latest.rows[0],
      trend: trend.rows,
    });
  } catch (err) {
    console.error('Portal phishing summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  importCampaign, listCampaigns, getCampaignTargets,
  updateTraining, deleteCampaign, getTrendData,
  getRepeatOffenders, getClientPortalSummary
};
