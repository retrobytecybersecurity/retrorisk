'use strict';

const pool = require('../config/database');
const { auditLog } = require('../utils/audit');

// ── Phase assignment from due date ────────────────────────────────────────────
function assignPhase(dueDateStr) {
  if (!dueDateStr) return 'Long Term';
  const due  = new Date(dueDateStr);
  const now  = new Date();
  const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (days <= 30)  return 'Quick Win';
  if (days <= 90)  return 'Short Term';
  return 'Long Term';
}

// ── Roadmap audit helper ──────────────────────────────────────────────────────
async function logRoadmapChange(dbClient, { itemId, clientId, userId, changeType, oldValue, newValue, notes }) {
  await dbClient.query(
    `INSERT INTO roadmap_audit (item_id, client_id, changed_by, change_type, old_value, new_value, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [itemId, clientId, userId || null, changeType, oldValue || null, newValue || null, notes || null]
  );
}

// ── List roadmap items for a client ──────────────────────────────────────────
async function listItems(req, res) {
  const { clientId } = req.params;
  const { source, priority, status, phase } = req.query;

  try {
    let query = `
      SELECT id, title, source, source_reference, priority, status, phase,
             effort, due_date, date_added, date_closed,
             assigned_owner, notes, internal_notes,
             risk_acceptance_reason, risk_accepted_by, risk_review_date,
             flagged_for_review, flagged_at, flagged_notes,
             created_at, updated_at
      FROM roadmap_items
      WHERE client_id = $1
    `;
    const params = [clientId];
    let idx = 2;

    if (source)   { query += ` AND source = $${idx++}`;   params.push(source); }
    if (priority) { query += ` AND priority = $${idx++}`; params.push(priority); }
    if (status)   { query += ` AND status = $${idx++}`;   params.push(status); }
    if (phase)    { query += ` AND phase = $${idx++}`;    params.push(phase); }

    query += `
      ORDER BY
        CASE source WHEN 'CIS' THEN 1 WHEN 'NIST' THEN 2 WHEN 'Pen Test' THEN 3
          WHEN 'Vuln Scan' THEN 4 WHEN 'Phishing' THEN 5 ELSE 6 END,
        CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END,
        due_date ASC NULLS LAST
    `;

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('List roadmap error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Get summary stats for a client ───────────────────────────────────────────
async function getSummary(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'Completed' AND status != 'Risk Accepted') as open_total,
         COUNT(*) FILTER (WHERE status = 'Completed') as completed,
         COUNT(*) FILTER (WHERE status = 'Risk Accepted') as risk_accepted,
         COUNT(*) FILTER (WHERE status = 'In Progress') as in_progress,
         COUNT(*) FILTER (WHERE status = 'Open') as open,
         COUNT(*) FILTER (WHERE priority = 'Critical' AND status NOT IN ('Completed','Risk Accepted')) as critical_open,
         COUNT(*) FILTER (WHERE priority = 'High' AND status NOT IN ('Completed','Risk Accepted')) as high_open,
         COUNT(*) FILTER (WHERE priority = 'Medium' AND status NOT IN ('Completed','Risk Accepted')) as medium_open,
         COUNT(*) FILTER (WHERE priority = 'Low' AND status NOT IN ('Completed','Risk Accepted')) as low_open,
         COUNT(*) FILTER (WHERE flagged_for_review = true AND status NOT IN ('Completed','Risk Accepted')) as flagged,
         COUNT(*) as total
       FROM roadmap_items
       WHERE client_id = $1`,
      [clientId]
    );
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Roadmap summary error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Create roadmap item (manual) ─────────────────────────────────────────────
async function createItem(req, res) {
  const { clientId } = req.params;
  const {
    title, source, sourceReference, priority, status,
    effort, dueDate, assignedOwner, notes, internalNotes
  } = req.body;

  if (!title || !source || !priority) {
    return res.status(400).json({ error: 'Title, source, and priority are required' });
  }

  const phase = assignPhase(dueDate);

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const result = await dbClient.query(
      `INSERT INTO roadmap_items
         (client_id, title, source, source_reference, priority, status,
          phase, effort, due_date, assigned_owner, notes, internal_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        clientId, title.trim(), source, sourceReference || null,
        priority, status || 'Open', phase,
        effort || null, dueDate || null,
        assignedOwner || null, notes || null, internalNotes || null,
        req.user.userId
      ]
    );

    const itemId = result.rows[0].id;

    await logRoadmapChange(dbClient, {
      itemId, clientId, userId: req.user.userId,
      changeType: 'CREATED',
      newValue: `${source} — ${priority} — ${title}`
    });

    await dbClient.query('COMMIT');

    await auditLog({
      userId: req.user.userId,
      action: 'ROADMAP_ITEM_CREATED',
      entityType: 'roadmap_item',
      entityId: itemId,
      newValue: { title, source, priority },
      ipAddress: req.ip
    });

    return res.status(201).json({ id: itemId, phase, message: 'Roadmap item created' });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Create roadmap item error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Promote a finding to roadmap (called from framework modules) ──────────────
async function promoteToRoadmap(req, res) {
  const { clientId } = req.params;
  const {
    title, source, sourceReference, sourceItemId,
    priority, effort, dueDate, notes
  } = req.body;

  if (!title || !source || !priority) {
    return res.status(400).json({ error: 'Title, source, and priority required' });
  }

  const phase = assignPhase(dueDate);

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const result = await dbClient.query(
      `INSERT INTO roadmap_items
         (client_id, title, source, source_reference, source_item_id,
          priority, phase, effort, due_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        clientId, title.trim(), source, sourceReference || null,
        sourceItemId || null, priority, phase,
        effort || null, dueDate || null, notes || null, req.user.userId
      ]
    );

    const itemId = result.rows[0].id;

    await logRoadmapChange(dbClient, {
      itemId, clientId, userId: req.user.userId,
      changeType: 'PROMOTED',
      newValue: `Promoted from ${source}: ${title}`
    });

    await dbClient.query('COMMIT');

    await auditLog({
      userId: req.user.userId,
      action: 'ROADMAP_ITEM_PROMOTED',
      entityType: 'roadmap_item',
      entityId: itemId,
      newValue: { title, source, priority, phase },
      ipAddress: req.ip
    });

    return res.status(201).json({ id: itemId, phase });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Promote roadmap error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Update roadmap item (admin) ───────────────────────────────────────────────
async function updateItem(req, res) {
  const { itemId } = req.params;
  const {
    title, source, sourceReference, priority, status,
    effort, dueDate, assignedOwner, notes, internalNotes,
    riskAcceptanceReason, riskAcceptedBy, riskReviewDate
  } = req.body;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const existing = await dbClient.query(
      'SELECT client_id, status, priority, due_date FROM roadmap_items WHERE id = $1',
      [itemId]
    );
    if (!existing.rows[0]) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    const old = existing.rows[0];
    const newPhase = dueDate ? assignPhase(dueDate) : undefined;

    // Auto-set date_closed when marking completed
    const dateClosed = status === 'Completed' ? new Date().toISOString().split('T')[0] : null;

    await dbClient.query(
      `UPDATE roadmap_items SET
         title = COALESCE($1, title),
         source = COALESCE($2, source),
         source_reference = COALESCE($3, source_reference),
         priority = COALESCE($4, priority),
         status = COALESCE($5, status),
         phase = COALESCE($6, phase),
         effort = COALESCE($7, effort),
         due_date = COALESCE($8, due_date),
         assigned_owner = COALESCE($9, assigned_owner),
         notes = COALESCE($10, notes),
         internal_notes = COALESCE($11, internal_notes),
         risk_acceptance_reason = COALESCE($12, risk_acceptance_reason),
         risk_accepted_by = COALESCE($13, risk_accepted_by),
         risk_review_date = COALESCE($14, risk_review_date),
         date_closed = COALESCE($15, date_closed)
       WHERE id = $16`,
      [
        title?.trim(), source, sourceReference, priority,
        status, newPhase, effort, dueDate,
        assignedOwner, notes, internalNotes,
        riskAcceptanceReason, riskAcceptedBy, riskReviewDate,
        dateClosed, itemId
      ]
    );

    // Log status change
    if (status && status !== old.status) {
      await logRoadmapChange(dbClient, {
        itemId, clientId: old.client_id, userId: req.user.userId,
        changeType: 'STATUS_CHANGE',
        oldValue: old.status,
        newValue: status
      });
    }

    await dbClient.query('COMMIT');

    await auditLog({
      userId: req.user.userId,
      action: 'ROADMAP_ITEM_UPDATED',
      entityType: 'roadmap_item',
      entityId: itemId,
      newValue: { status, priority },
      ipAddress: req.ip
    });

    return res.json({ message: 'Item updated' });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Update roadmap item error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Client sets assigned owner ────────────────────────────────────────────────
async function setAssignedOwner(req, res) {
  const { itemId } = req.params;
  const { assignedOwner } = req.body;
  const clientId = req.user.clientId;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const check = await dbClient.query(
      'SELECT id, client_id FROM roadmap_items WHERE id = $1 AND client_id = $2',
      [itemId, clientId]
    );
    if (!check.rows[0]) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    await dbClient.query(
      'UPDATE roadmap_items SET assigned_owner = $1 WHERE id = $2',
      [assignedOwner?.trim() || null, itemId]
    );

    await logRoadmapChange(dbClient, {
      itemId, clientId, userId: req.user.userId,
      changeType: 'OWNER_SET',
      newValue: assignedOwner
    });

    await dbClient.query('COMMIT');
    return res.json({ message: 'Owner updated' });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Set owner error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Client flags item as ready for review ─────────────────────────────────────
async function flagForReview(req, res) {
  const { itemId } = req.params;
  const { flaggedNotes } = req.body;
  const clientId = req.user.clientId;

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    const check = await dbClient.query(
      'SELECT id, client_id, title FROM roadmap_items WHERE id = $1 AND client_id = $2',
      [itemId, clientId]
    );
    if (!check.rows[0]) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    await dbClient.query(
      `UPDATE roadmap_items SET
         flagged_for_review = true,
         flagged_at = NOW(),
         flagged_notes = $1
       WHERE id = $2`,
      [flaggedNotes?.trim() || null, itemId]
    );

    // Create dashboard reminder for admin
    await dbClient.query(
      `INSERT INTO reminders (client_id, type, title, due_date)
       VALUES ($1, 'review_request', $2, CURRENT_DATE)`,
      [clientId, `Review requested: ${check.rows[0].title}`]
    );

    await logRoadmapChange(dbClient, {
      itemId, clientId, userId: req.user.userId,
      changeType: 'FLAGGED_FOR_REVIEW',
      newValue: flaggedNotes || 'No notes provided'
    });

    await dbClient.query('COMMIT');
    return res.json({ message: 'Item flagged for review' });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Flag review error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    dbClient.release();
  }
}

// ── Admin clears review flag ──────────────────────────────────────────────────
async function clearReviewFlag(req, res) {
  const { itemId } = req.params;

  try {
    await pool.query(
      'UPDATE roadmap_items SET flagged_for_review = false, flagged_at = NULL, flagged_notes = NULL WHERE id = $1',
      [itemId]
    );
    return res.json({ message: 'Review flag cleared' });
  } catch (err) {
    console.error('Clear flag error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Delete item ───────────────────────────────────────────────────────────────
async function deleteItem(req, res) {
  const { itemId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM roadmap_items WHERE id = $1 RETURNING id, title',
      [itemId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Item not found' });

    await auditLog({
      userId: req.user.userId,
      action: 'ROADMAP_ITEM_DELETED',
      entityType: 'roadmap_item',
      entityId: itemId,
      newValue: { title: result.rows[0].title },
      ipAddress: req.ip
    });

    return res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Delete item error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Get audit trail for an item ───────────────────────────────────────────────
async function getAuditTrail(req, res) {
  const { itemId } = req.params;
  try {
    const result = await pool.query(
      `SELECT ra.id, ra.change_type, ra.old_value, ra.new_value, ra.notes, ra.created_at,
              u.username as changed_by
       FROM roadmap_audit ra
       LEFT JOIN users u ON u.id = ra.changed_by
       WHERE ra.item_id = $1
       ORDER BY ra.created_at DESC`,
      [itemId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Audit trail error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Review queue (admin dashboard) ───────────────────────────────────────────
async function getReviewQueue(req, res) {
  try {
    const result = await pool.query(
      `SELECT ri.id, ri.title, ri.source, ri.priority, ri.status,
              ri.flagged_at, ri.flagged_notes,
              ri.client_id, c.organization_name
       FROM roadmap_items ri
       JOIN clients c ON c.id = ri.client_id
       WHERE ri.flagged_for_review = true
         AND c.status = 'active'
       ORDER BY ri.flagged_at ASC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Review queue error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Client portal — roadmap view ──────────────────────────────────────────────
async function getClientPortalRoadmap(req, res) {
  const clientId = req.user.clientId;
  const { source, priority, status } = req.query;

  try {
    let query = `
      SELECT id, title, source, source_reference, priority, status, phase,
             effort, due_date, date_added, date_closed,
             assigned_owner, notes,
             flagged_for_review, flagged_at, flagged_notes
      FROM roadmap_items
      WHERE client_id = $1
    `;
    const params = [clientId];
    let idx = 2;

    if (source)   { query += ` AND source = $${idx++}`;   params.push(source); }
    if (priority) { query += ` AND priority = $${idx++}`; params.push(priority); }
    if (status)   { query += ` AND status = $${idx++}`;   params.push(status); }

    query += `
      ORDER BY
        CASE source WHEN 'CIS' THEN 1 WHEN 'NIST' THEN 2 WHEN 'Pen Test' THEN 3
          WHEN 'Vuln Scan' THEN 4 WHEN 'Phishing' THEN 5 ELSE 6 END,
        CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
          WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END,
        due_date ASC NULLS LAST
    `;

    const result = await pool.query(query, params);

    // Summary counts
    const summary = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'Completed') as completed,
         COUNT(*) FILTER (WHERE status NOT IN ('Completed','Risk Accepted')) as open_total
       FROM roadmap_items WHERE client_id = $1`,
      [clientId]
    );

    return res.json({ items: result.rows, summary: summary.rows[0] });
  } catch (err) {
    console.error('Portal roadmap error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listItems, getSummary, createItem, promoteToRoadmap,
  updateItem, setAssignedOwner, flagForReview, clearReviewFlag,
  deleteItem, getAuditTrail, getReviewQueue, getClientPortalRoadmap
};
