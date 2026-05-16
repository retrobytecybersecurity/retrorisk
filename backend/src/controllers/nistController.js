'use strict';

const path = require('path');
const pool = require('../config/database');
const { auditLog } = require('../utils/audit');

let NIST_DATA = null;

function getNistData() {
  if (!NIST_DATA) {
    try {
      NIST_DATA = require(path.join(__dirname, '../../data/nist-csf2-subcategories.json'));
    } catch (err) {
      throw new Error('NIST CSF 2.0 data file not found. Ensure nist-csf2-subcategories.json exists in backend/data/');
    }
  }
  return NIST_DATA;
}

// Flatten all subcategories
function getAllSubcategories() {
  const data = getNistData();
  const result = [];
  for (const fn of data.functions) {
    for (const cat of fn.categories) {
      for (const sc of cat.subcategories) {
        result.push({
          ...sc,
          functionId: fn.id,
          functionTitle: fn.title,
          categoryId: cat.id,
          categoryTitle: cat.title,
        });
      }
    }
  }
  return result;
}

// ── Scoring engine ─────────────────────────────────────────────────────────────
// Score = average tier across assessed subcategories per function
// Unassessed (tier=0) are excluded from average
function computeScores(responses) {
  // Group by function
  const byFunction = {};
  for (const r of responses) {
    if (!byFunction[r.function_id]) byFunction[r.function_id] = [];
    byFunction[r.function_id].push(r);
  }

  const functionScores = {};
  let totalCurrentSum = 0;
  let totalTargetSum  = 0;
  let totalCount = 0;

  for (const [fnId, fnResponses] of Object.entries(byFunction)) {
    const assessed = fnResponses.filter(r => r.current_tier > 0);
    const targetSet = fnResponses.filter(r => r.target_tier > 0);

    const currentAvg = assessed.length > 0
      ? assessed.reduce((s, r) => s + r.current_tier, 0) / assessed.length
      : 0;

    const targetAvg = targetSet.length > 0
      ? targetSet.reduce((s, r) => s + r.target_tier, 0) / targetSet.length
      : 0;

    functionScores[fnId] = {
      current: parseFloat(currentAvg.toFixed(2)),
      target:  parseFloat(targetAvg.toFixed(2)),
      assessed: assessed.length,
      total: fnResponses.length,
    };

    if (assessed.length > 0) {
      totalCurrentSum += currentAvg * assessed.length;
      totalTargetSum  += targetAvg * (targetSet.length || assessed.length);
      totalCount += assessed.length;
    }
  }

  const overallCurrent = totalCount > 0 ? parseFloat((totalCurrentSum / totalCount).toFixed(2)) : 0;
  const overallTarget  = totalCount > 0 ? parseFloat((totalTargetSum  / totalCount).toFixed(2)) : 0;

  return { overallCurrent, overallTarget, functionScores };
}

async function recomputeScores(dbClient, assessmentId) {
  const responsesRes = await dbClient.query(
    'SELECT function_id, category_id, subcategory_id, current_tier, target_tier FROM nist_responses WHERE assessment_id = $1',
    [assessmentId]
  );

  const { overallCurrent, overallTarget, functionScores } = computeScores(responsesRes.rows);

  const assessedCount = responsesRes.rows.filter(r => r.current_tier > 0).length;

  await dbClient.query(
    `UPDATE nist_assessments SET
       overall_current = $1,
       overall_target  = $2,
       function_scores = $3,
       assessed_subcategories = $4
     WHERE id = $5`,
    [overallCurrent, overallTarget, JSON.stringify(functionScores), assessedCount, assessmentId]
  );

  return { overallCurrent, overallTarget, functionScores };
}

// ── Get NIST data for frontend ─────────────────────────────────────────────────
async function getNistFramework(req, res) {
  try {
    return res.json(getNistData());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ── List assessments ───────────────────────────────────────────────────────────
async function listAssessments(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, status, overall_current, overall_target, function_scores,
              total_subcategories, assessed_subcategories, completed_at, created_at
       FROM nist_assessments
       WHERE client_id = $1
       ORDER BY created_at DESC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('List NIST assessments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Create assessment ──────────────────────────────────────────────────────────
async function createAssessment(req, res) {
  const { clientId } = req.params;

  const clientCheck = await pool.query(
    'SELECT id FROM clients WHERE id = $1 AND status = $2',
    [clientId, 'active']
  );
  if (!clientCheck.rows[0]) return res.status(404).json({ error: 'Client not found' });

  const subcategories = getAllSubcategories();
  const now = new Date();
  const name = `NIST CSF 2.0 Assessment — ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const result = await dbClient.query(
      `INSERT INTO nist_assessments
         (client_id, name, total_subcategories, created_by)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      [clientId, name, subcategories.length, req.user.userId]
    );

    const assessmentId = result.rows[0].id;

    // Pre-create all response rows
    for (const sc of subcategories) {
      await dbClient.query(
        `INSERT INTO nist_responses
           (assessment_id, client_id, subcategory_id, function_id, category_id, testing_procedures)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [assessmentId, clientId, sc.id, sc.functionId, sc.categoryId, sc.testingProcedures || '']
      );
    }

    // Update client last NIST date
    await dbClient.query(
      'UPDATE clients SET last_nist_assessment = CURRENT_DATE WHERE id = $1',
      [clientId]
    );

    await dbClient.query('COMMIT');

    await auditLog({
      userId: req.user.userId,
      action: 'NIST_ASSESSMENT_CREATED',
      entityType: 'nist_assessment',
      entityId: assessmentId,
      newValue: { name, subcategoryCount: subcategories.length },
      ipAddress: req.ip
    });

    return res.status(201).json({ id: assessmentId, name, subcategoryCount: subcategories.length });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Create NIST assessment error:', err);
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
      `SELECT id, name, status, overall_current, overall_target, function_scores,
              total_subcategories, assessed_subcategories, completed_at, created_at, client_id
       FROM nist_assessments WHERE id = $1`,
      [assessmentId]
    );
    if (!assessRes.rows[0]) return res.status(404).json({ error: 'Assessment not found' });

    const responsesRes = await pool.query(
      `SELECT subcategory_id, function_id, category_id,
              current_tier, target_tier, testing_procedures,
              evidence, testing_steps, gaps_observations, risk_rating,
              promoted_to_roadmap, roadmap_item_id
       FROM nist_responses WHERE assessment_id = $1`,
      [assessmentId]
    );

    const responseMap = {};
    for (const r of responsesRes.rows) {
      responseMap[r.subcategory_id] = r;
    }

    return res.json({ assessment: assessRes.rows[0], responses: responseMap });
  } catch (err) {
    console.error('Get NIST assessment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Save a subcategory response ────────────────────────────────────────────────
async function saveResponse(req, res) {
  const { assessmentId, subcategoryId } = req.params;
  const {
    currentTier, targetTier, testingProcedures,
    evidence, testingSteps, gapsObservations, riskRating
  } = req.body;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    await dbClient.query(
      `UPDATE nist_responses SET
         current_tier        = COALESCE($1, current_tier),
         target_tier         = COALESCE($2, target_tier),
         testing_procedures  = COALESCE($3, testing_procedures),
         evidence            = COALESCE($4, evidence),
         testing_steps       = COALESCE($5, testing_steps),
         gaps_observations   = COALESCE($6, gaps_observations),
         risk_rating         = $7
       WHERE assessment_id = $8 AND subcategory_id = $9`,
      [
        currentTier !== undefined ? currentTier : null,
        targetTier  !== undefined ? targetTier  : null,
        testingProcedures, evidence, testingSteps,
        gapsObservations, riskRating || null,
        assessmentId, subcategoryId
      ]
    );

    const scores = await recomputeScores(dbClient, assessmentId);
    await dbClient.query('COMMIT');

    return res.json({ message: 'Response saved', scores });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Save NIST response error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Mark complete ──────────────────────────────────────────────────────────────
async function completeAssessment(req, res) {
  const { assessmentId } = req.params;
  try {
    await pool.query(
      `UPDATE nist_assessments SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [assessmentId]
    );
    await auditLog({
      userId: req.user.userId,
      action: 'NIST_ASSESSMENT_COMPLETED',
      entityType: 'nist_assessment',
      entityId: assessmentId,
      ipAddress: req.ip
    });
    return res.json({ message: 'Assessment completed' });
  } catch (err) {
    console.error('Complete NIST error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Delete assessment ──────────────────────────────────────────────────────────
async function deleteAssessment(req, res) {
  const { assessmentId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM nist_assessments WHERE id = $1 RETURNING id, name',
      [assessmentId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Assessment not found' });

    await auditLog({
      userId: req.user.userId,
      action: 'NIST_ASSESSMENT_DELETED',
      entityType: 'nist_assessment',
      entityId: assessmentId,
      newValue: { name: result.rows[0].name },
      ipAddress: req.ip
    });
    return res.json({ message: 'Assessment deleted' });
  } catch (err) {
    console.error('Delete NIST error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Trend data ─────────────────────────────────────────────────────────────────
async function getTrendData(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, overall_current, overall_target, function_scores,
              total_subcategories, assessed_subcategories, status, created_at
       FROM nist_assessments
       WHERE client_id = $1
       ORDER BY created_at ASC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('NIST trend error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Client portal summary ──────────────────────────────────────────────────────
async function getClientPortalSummary(req, res) {
  const clientId = req.user.clientId;
  try {
    const result = await pool.query(
      `SELECT id, name, overall_current, overall_target, function_scores,
              total_subcategories, assessed_subcategories, status, created_at
       FROM nist_assessments
       WHERE client_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [clientId]
    );
    return res.json(result.rows[0] || null);
  } catch (err) {
    console.error('Portal NIST summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getNistFramework, listAssessments, createAssessment, getAssessment,
  saveResponse, completeAssessment, deleteAssessment,
  getTrendData, getClientPortalSummary
};
