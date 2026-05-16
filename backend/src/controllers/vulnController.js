'use strict';

const pool = require('../config/database');
const { parseCSV, countsBySeverity } = require('../utils/nessusParser');
const { auditLog } = require('../utils/audit');

// ── Import a Nessus CSV ────────────────────────────────────────────────────────
async function importScan(req, res) {
  const { clientId } = req.params;
  const { scope, scopeCustom } = req.body;
  const csvText = req.body.csvData;

  if (!csvText) return res.status(400).json({ error: 'No CSV data provided' });
  if (!scope)   return res.status(400).json({ error: 'Scope is required' });

  // Verify client exists
  const clientCheck = await pool.query(
    'SELECT id FROM clients WHERE id = $1 AND status = $2',
    [clientId, 'active']
  );
  if (!clientCheck.rows[0]) return res.status(404).json({ error: 'Client not found' });

  let findings;
  try {
    findings = parseCSV(csvText);
  } catch (err) {
    return res.status(422).json({ error: err.message });
  }

  const counts = countsBySeverity(findings);
  const now    = new Date();
  const scanName = `Nessus Scan — ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert scan record
    const scanRes = await client.query(
      `INSERT INTO vuln_scans
         (client_id, name, scope, scope_custom, imported_by,
          finding_count, critical_count, high_count, medium_count, low_count, info_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        clientId, scanName,
        scope, scopeCustom || null,
        req.user.userId,
        findings.length,
        counts.Critical, counts.High, counts.Medium, counts.Low, counts.Informational
      ]
    );
    const scanId = scanRes.rows[0].id;

    // Bulk insert findings
    for (const f of findings) {
      await client.query(
        `INSERT INTO vuln_findings
           (scan_id, client_id, plugin_id, title, cve, cvss_score, cvss_version,
            severity, description, remediation, hosts, host_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          scanId, clientId,
          f.plugin_id, f.title, f.cve,
          f.cvss_score, f.cvss_version,
          f.severity, f.description, f.remediation,
          f.hosts, f.host_count
        ]
      );
    }

    // Update client's last vuln scan date
    await client.query(
      'UPDATE clients SET last_vuln_scan = CURRENT_DATE WHERE id = $1',
      [clientId]
    );

    await client.query('COMMIT');

    await auditLog({
      userId: req.user.userId,
      action: 'VULN_SCAN_IMPORTED',
      entityType: 'vuln_scan',
      entityId: scanId,
      newValue: { scanName, findingCount: findings.length, scope },
      ipAddress: req.ip
    });

    return res.status(201).json({
      scanId,
      scanName,
      findingCount: findings.length,
      counts
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import scan error:', err);
    return res.status(500).json({ error: 'Failed to import scan' });
  } finally {
    client.release();
  }
}

// ── List all scans for a client ────────────────────────────────────────────────
async function listScans(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, scope, scope_custom, imported_at,
              finding_count, critical_count, high_count, medium_count, low_count, info_count
       FROM vuln_scans
       WHERE client_id = $1
       ORDER BY imported_at DESC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('List scans error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Get findings for a scan ────────────────────────────────────────────────────
async function getScanFindings(req, res) {
  const { scanId } = req.params;
  try {
    // Verify caller has access to this scan's client
    const scanCheck = await pool.query(
      'SELECT client_id FROM vuln_scans WHERE id = $1',
      [scanId]
    );
    if (!scanCheck.rows[0]) return res.status(404).json({ error: 'Scan not found' });

    const result = await pool.query(
      `SELECT id, plugin_id, title, cve, cvss_score, cvss_version,
              severity, description, remediation, hosts, host_count,
              promoted_to_roadmap, roadmap_item_id
       FROM vuln_findings
       WHERE scan_id = $1
       ORDER BY
         CASE severity
           WHEN 'Critical' THEN 1
           WHEN 'High' THEN 2
           WHEN 'Medium' THEN 3
           WHEN 'Low' THEN 4
           WHEN 'Informational' THEN 5
         END,
         cvss_score DESC NULLS LAST`,
      [scanId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Get findings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Get most recent scan for a client (client portal) ─────────────────────────
async function getLatestScan(req, res) {
  const { clientId } = req.params;
  try {
    const scanRes = await pool.query(
      `SELECT id, name, scope, scope_custom, imported_at,
              finding_count, critical_count, high_count, medium_count, low_count, info_count
       FROM vuln_scans
       WHERE client_id = $1
       ORDER BY imported_at DESC
       LIMIT 1`,
      [clientId]
    );
    if (!scanRes.rows[0]) return res.json(null);

    const scan = scanRes.rows[0];
    const findings = await pool.query(
      `SELECT id, title, cve, cvss_score, severity, description, remediation, hosts, host_count
       FROM vuln_findings
       WHERE scan_id = $1
       ORDER BY
         CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
           WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END,
         cvss_score DESC NULLS LAST`,
      [scan.id]
    );

    return res.json({ scan, findings: findings.rows });
  } catch (err) {
    console.error('Latest scan error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Trend data — severity counts across all scans ─────────────────────────────
async function getTrendData(req, res) {
  const { clientId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, scope, imported_at,
              critical_count, high_count, medium_count, low_count, info_count
       FROM vuln_scans
       WHERE client_id = $1
       ORDER BY imported_at ASC`,
      [clientId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Trend data error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Compare two scans — delta view ────────────────────────────────────────────
async function compareScans(req, res) {
  const { clientId } = req.params;
  const { scanAId, scanBId } = req.query;

  if (!scanAId || !scanBId) {
    return res.status(400).json({ error: 'scanAId and scanBId are required' });
  }

  try {
    // Fetch both scans metadata
    const scansRes = await pool.query(
      `SELECT id, name, imported_at, critical_count, high_count, medium_count, low_count, info_count
       FROM vuln_scans WHERE id = ANY($1) AND client_id = $2`,
      [[scanAId, scanBId], clientId]
    );
    if (scansRes.rows.length !== 2) {
      return res.status(404).json({ error: 'One or both scans not found for this client' });
    }

    // Ensure scanA is the older one
    const sorted = scansRes.rows.sort((a, b) => new Date(a.imported_at) - new Date(b.imported_at));
    const [scanA, scanB] = sorted;

    // Fetch findings for both scans — use plugin_id or title as dedup key
    const findingsA = await pool.query(
      'SELECT plugin_id, title, severity, cvss_score FROM vuln_findings WHERE scan_id = $1',
      [scanA.id]
    );
    const findingsB = await pool.query(
      'SELECT plugin_id, title, severity, cvss_score, hosts, host_count, description, remediation, cve FROM vuln_findings WHERE scan_id = $1',
      [scanB.id]
    );

    const keyA = new Set(findingsA.rows.map(f => f.plugin_id || f.title.toLowerCase()));
    const keyB = new Map(findingsB.rows.map(f => [f.plugin_id || f.title.toLowerCase(), f]));

    const remediated = []; // In A, not in B
    const persisted  = []; // In both A and B
    const newFindings = []; // In B, not in A

    for (const f of findingsA.rows) {
      const key = f.plugin_id || f.title.toLowerCase();
      if (keyB.has(key)) {
        persisted.push({ ...keyB.get(key), status: 'persisted' });
      } else {
        remediated.push({ ...f, status: 'remediated' });
      }
    }

    for (const f of findingsB.rows) {
      const key = f.plugin_id || f.title.toLowerCase();
      if (!keyA.has(key)) {
        newFindings.push({ ...f, status: 'new' });
      }
    }

    return res.json({
      scanA: { id: scanA.id, name: scanA.name, importedAt: scanA.imported_at },
      scanB: { id: scanB.id, name: scanB.name, importedAt: scanB.imported_at },
      summary: {
        remediated: remediated.length,
        persisted: persisted.length,
        new: newFindings.length,
      },
      remediated,
      persisted,
      new: newFindings,
    });
  } catch (err) {
    console.error('Compare scans error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Delete a scan ──────────────────────────────────────────────────────────────
async function deleteScan(req, res) {
  const { scanId } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM vuln_scans WHERE id = $1 RETURNING id, name, client_id',
      [scanId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Scan not found' });

    await auditLog({
      userId: req.user.userId,
      action: 'VULN_SCAN_DELETED',
      entityType: 'vuln_scan',
      entityId: scanId,
      newValue: { name: result.rows[0].name },
      ipAddress: req.ip
    });

    return res.json({ message: 'Scan deleted' });
  } catch (err) {
    console.error('Delete scan error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  importScan, listScans, getScanFindings,
  getLatestScan, getTrendData, compareScans, deleteScan
};
