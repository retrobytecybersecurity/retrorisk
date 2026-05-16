'use strict';

const path = require('path');
const pool = require('../config/database');
const { auditLog } = require('../utils/audit');

// ── Load safeguard library from JSON ─────────────────────────────────────────
let SAFEGUARD_DATA = null;

function getSafeguardData() {
  if (!SAFEGUARD_DATA) {
    try {
      SAFEGUARD_DATA = require(path.join(__dirname, '../../data/cis-v8-safeguards.json'));
    } catch (err) {
      throw new Error('CIS v8 safeguard data file not found. Ensure cis-v8-safeguards.json exists in backend/data/');
    }
  }
  return SAFEGUARD_DATA;
}

// Flatten all safeguards for a given IG level
function getSafeguardsForIG(igLevel) {
  const data = getSafeguardData();
  const igNum = parseInt(igLevel.replace('IG', ''));
  const result = [];

  for (const control of data.controls) {
    for (const sg of control.safeguards) {
      if (sg.ig <= igNum) {
        result.push({ ...sg, controlId: control.id, controlTitle: control.title });
      }
    }
  }
  return result;
}

// ── Scoring engine ────────────────────────────────────────────────────────────
// Compliant = 1.0, Partially Compliant = 0.5, Non-Compliant = 0, Not Applicable = excluded
function computeScores(responses, safeguards) {
  // Group safeguards by control
  const controlGroups = {};
  for (const sg of safeguards) {
    if (!controlGroups[sg.controlId]) {
      controlGroups[sg.controlId] = { safeguards: [], controlTitle: sg.controlTitle };
    }
    controlGroups[sg.controlId].safeguards.push(sg);
  }

  // Build a lookup of responses by safeguard_id
  const responseMap = {};
  for (const r of responses) {
    responseMap[r.safeguard_id] = r.status;
  }

  const controlScores = {};
  let totalWeight = 0;
  let totalScore = 0;

  for (const [controlId, group] of Object.entries(controlGroups)) {
    let controlWeight = 0;
    let controlPoints = 0;

    for (const sg of group.safeguards) {
      const status = responseMap[sg.id] || 'Not Assessed';
      if (status === 'Not Applicable') continue; // excluded from scoring
      if (status === 'Not Assessed') {
        controlWeight += 1;
        // Not assessed counts as 0 points
        continue;
      }
      controlWeight += 1;
      if (status === 'Compliant') controlPoints += 1;
      else if (status === 'Partially Compliant') controlPoints += 0.5;
      // Non-Compliant = 0
    }

    const score = controlWeight > 0 ? (controlPoints / controlWeight) * 100 : 0;
    controlScores[controlId] = parseFloat(score.toFixed(2));
    totalWeight += controlWeight;
    totalScore += controlPoints;
  }

  const overallScore = totalWeight > 0
    ? parseFloat(((totalScore / totalWeight) * 100).toFixed(2))
    : 0;

  return { overallScore, controlScores };
}

// ── Update assessment scores ──────────────────────────────────────────────────
async function recomputeScores(dbClient, assessmentId) {
  const assessRes = await dbClient.query(
    'SELECT ig_level, client_id FROM cis_assessments WHERE id = $1',
    [assessmentId]
  );
  if (!assessRes.rows[0]) return;

  const { ig_level, client_id } = assessRes.rows[0];
  const safeguards = getSafeguardsForIG(ig_level);

  const responsesRes = await dbClient.query(
    'SELECT safeguard_id, status FROM cis_responses WHERE assessment_id = $1',
    [assessmentId]
  );

  const { overallScore, controlScores } = computeScores(responsesRes.rows, safeguards);

  const assessedCount = responsesRes.rows.filter(
    r => r.status !== 'Not Assessed'
  ).length;

  await dbClient.query(
    `UPDATE cis_assessments SET
       overall_score = $1,
       control_scores = $2,
       assessed_safeguards = $3,
       total_safeguards = $4
     WHERE id = $5`,
    [overallScore, JSON.stringify(controlScores), assessedCount, safeguards.length, assessmentId]
  );

  return { overallScore, controlScores };
}

// ── Get safeguard library (for frontend) ──────────────────────────────────────
async function getSafeguards(req, res) {
  try {
    const data = getSafeguardData();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── List assessments for a client ─────────────────────────────────────────────
async function listAssessments(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, ig_level, status, overall_score, control_scores,
              total_safeguards, assessed_safeguards, completed_at, created_at
       FROM cis_assessments
       WHERE client_id = $1
       ORDER BY created_at DESC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('List CIS assessments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Create a new assessment ───────────────────────────────────────────────────
async function createAssessment(req, res) {
  const { clientId } = req.params;
  const { igLevel } = req.body;

  if (!igLevel) return res.status(400).json({ error: 'IG level is required' });

  const clientCheck = await pool.query(
    'SELECT id, cis_ig_level FROM clients WHERE id = $1 AND status = $2',
    [clientId, 'active']
  );
  if (!clientCheck.rows[0]) return res.status(404).json({ error: 'Client not found' });

  const safeguards = getSafeguardsForIG(igLevel);
  const now = new Date();
  const name = `CIS v8 Assessment — ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const result = await dbClient.query(
      `INSERT INTO cis_assessments
         (client_id, name, ig_level, total_safeguards, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [clientId, name, igLevel, safeguards.length, req.user.userId]
    );

    const assessmentId = result.rows[0].id;

    // Pre-create response rows for all applicable safeguards (Not Assessed default)
    // Load testing procedures from JSON
    for (const sg of safeguards) {
      await dbClient.query(
        `INSERT INTO cis_responses
           (assessment_id, client_id, safeguard_id, control_id, testing_procedures)
         VALUES ($1,$2,$3,$4,$5)`,
        [assessmentId, clientId, sg.id, sg.controlId, sg.testingProcedures || '']
      );
    }

    // Update client last CIS assessment date
    await dbClient.query(
      'UPDATE clients SET last_cis_assessment = CURRENT_DATE WHERE id = $1',
      [clientId]
    );

    await dbClient.query('COMMIT');

    await auditLog({
      userId: req.user.userId,
      action: 'CIS_ASSESSMENT_CREATED',
      entityType: 'cis_assessment',
      entityId: assessmentId,
      newValue: { name, igLevel, safeguardCount: safeguards.length },
      ipAddress: req.ip
    });

    return res.status(201).json({ id: assessmentId, name, safeguardCount: safeguards.length });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Create CIS assessment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Get assessment with all responses ─────────────────────────────────────────
async function getAssessment(req, res) {
  const { assessmentId } = req.params;
  try {
    const assessRes = await pool.query(
      `SELECT id, name, ig_level, status, overall_score, control_scores,
              total_safeguards, assessed_safeguards, completed_at, created_at, client_id
       FROM cis_assessments WHERE id = $1`,
      [assessmentId]
    );
    if (!assessRes.rows[0]) return res.status(404).json({ error: 'Assessment not found' });

    const assessment = assessRes.rows[0];

    const responsesRes = await pool.query(
      `SELECT safeguard_id, control_id, status, testing_procedures,
              evidence, testing_steps, gaps_observations, risk_rating,
              promoted_to_roadmap, roadmap_item_id, updated_at
       FROM cis_responses
       WHERE assessment_id = $1`,
      [assessmentId]
    );

    // Build response map
    const responseMap = {};
    for (const r of responsesRes.rows) {
      responseMap[r.safeguard_id] = r;
    }

    return res.json({ assessment, responses: responseMap });
  } catch (err) {
    console.error('Get assessment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Save a safeguard response ─────────────────────────────────────────────────
async function saveResponse(req, res) {
  const { assessmentId, safeguardId } = req.params;
  const {
    status, testingProcedures, evidence,
    testingSteps, gapsObservations, riskRating
  } = req.body;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Upsert response
    await dbClient.query(
      `UPDATE cis_responses SET
         status = COALESCE($1, status),
         testing_procedures = COALESCE($2, testing_procedures),
         evidence = COALESCE($3, evidence),
         testing_steps = COALESCE($4, testing_steps),
         gaps_observations = COALESCE($5, gaps_observations),
         risk_rating = $6
       WHERE assessment_id = $7 AND safeguard_id = $8`,
      [
        status, testingProcedures, evidence,
        testingSteps, gapsObservations,
        riskRating || null,
        assessmentId, safeguardId
      ]
    );

    // Recompute scores
    const scores = await recomputeScores(dbClient, assessmentId);
    await dbClient.query('COMMIT');

    return res.json({ message: 'Response saved', scores });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Save response error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Mark assessment complete ──────────────────────────────────────────────────
async function completeAssessment(req, res) {
  const { assessmentId } = req.params;
  try {
    await pool.query(
      `UPDATE cis_assessments SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [assessmentId]
    );

    await auditLog({
      userId: req.user.userId,
      action: 'CIS_ASSESSMENT_COMPLETED',
      entityType: 'cis_assessment',
      entityId: assessmentId,
      ipAddress: req.ip
    });

    return res.json({ message: 'Assessment marked complete' });
  } catch (err) {
    console.error('Complete assessment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Delete assessment ─────────────────────────────────────────────────────────
async function deleteAssessment(req, res) {
  const { assessmentId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM cis_assessments WHERE id = $1 RETURNING id, name',
      [assessmentId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Assessment not found' });

    await auditLog({
      userId: req.user.userId,
      action: 'CIS_ASSESSMENT_DELETED',
      entityType: 'cis_assessment',
      entityId: assessmentId,
      newValue: { name: result.rows[0].name },
      ipAddress: req.ip
    });

    return res.json({ message: 'Assessment deleted' });
  } catch (err) {
    console.error('Delete assessment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Trend data ────────────────────────────────────────────────────────────────
async function getTrendData(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, ig_level, overall_score, control_scores,
              total_safeguards, assessed_safeguards, status, created_at
       FROM cis_assessments
       WHERE client_id = $1
       ORDER BY created_at ASC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('CIS trend error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Client portal summary ─────────────────────────────────────────────────────
async function getClientPortalSummary(req, res) {
  const clientId = req.user.clientId;
  try {
    const result = await pool.query(
      `SELECT id, name, ig_level, overall_score, control_scores,
              total_safeguards, assessed_safeguards, status, created_at
       FROM cis_assessments
       WHERE client_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [clientId]
    );
    return res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Portal CIS summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getSafeguards, listAssessments, createAssessment, getAssessment,
  saveResponse, completeAssessment, deleteAssessment,
  getTrendData, getClientPortalSummary
};
