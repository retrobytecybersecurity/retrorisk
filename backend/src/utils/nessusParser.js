'use strict';

/**
 * Nessus CSV Parser
 * Expects standard Nessus export format.
 * Deduplicates by Plugin ID — one finding per unique vulnerability,
 * all affected hosts consolidated into an array.
 */

const SEVERITY_MAP = {
  'critical': 'Critical',
  '4': 'Critical',
  'high': 'High',
  '3': 'High',
  'medium': 'Medium',
  '2': 'Medium',
  'low': 'Low',
  '1': 'Low',
  'none': 'Informational',
  'informational': 'Informational',
  'info': 'Informational',
  '0': 'Informational',
};

// Standard Nessus column names (case-insensitive matching)
const COL = {
  PLUGIN_ID:    ['plugin id', 'pluginid', 'plugin_id'],
  NAME:         ['name', 'plugin name', 'pluginname'],
  HOST:         ['host', 'ip address', 'ip', 'asset', 'hostname'],
  CVE:          ['cve', 'cves'],
  CVSS3:        ['cvss v3.0 base score', 'cvss3 base score', 'cvssv3', 'cvss_v3_base_score', 'cvss v3.0', 'cvss3'],
  CVSS2:        ['cvss v2.0 base score', 'cvss2 base score', 'cvssv2', 'cvss_v2_base_score', 'cvss v2.0', 'cvss2'],
  SEVERITY:     ['severity', 'risk', 'risk rating'],
  DESCRIPTION:  ['description', 'synopsis', 'plugin output'],
  SOLUTION:     ['solution', 'remediation', 'fix'],
};

function findCol(headers, candidates) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseSeverity(raw, cvssScore) {
  if (raw) {
    const mapped = SEVERITY_MAP[raw.toLowerCase().trim()];
    if (mapped) return mapped;
  }
  // Fall back to CVSS banding
  if (cvssScore !== null && cvssScore !== undefined) {
    if (cvssScore >= 9.0) return 'Critical';
    if (cvssScore >= 7.0) return 'High';
    if (cvssScore >= 4.0) return 'Medium';
    if (cvssScore > 0)   return 'Low';
    return 'Informational';
  }
  return 'Informational';
}

function parseCSV(rawText) {
  const lines = rawText.split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV appears empty or has no data rows');

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  if (headers.length < 3) throw new Error('CSV header row has too few columns — is this a Nessus export?');

  // Locate columns
  const colPluginId   = findCol(headers, COL.PLUGIN_ID);
  const colName       = findCol(headers, COL.NAME);
  const colHost       = findCol(headers, COL.HOST);
  const colCVE        = findCol(headers, COL.CVE);
  const colCVSS3      = findCol(headers, COL.CVSS3);
  const colCVSS2      = findCol(headers, COL.CVSS2);
  const colSeverity   = findCol(headers, COL.SEVERITY);
  const colDesc       = findCol(headers, COL.DESCRIPTION);
  const colSolution   = findCol(headers, COL.SOLUTION);

  if (colName === -1) throw new Error('Could not find a "Name" or "Plugin Name" column — verify this is a standard Nessus CSV export');
  if (colHost === -1) throw new Error('Could not find a "Host" or "IP Address" column — verify this is a standard Nessus CSV export');

  // Parse rows and deduplicate by plugin ID (fall back to name if no plugin ID)
  const findingMap = new Map(); // key → finding

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 2) continue;

    const pluginId  = colPluginId !== -1 ? cols[colPluginId]?.trim() : null;
    const name      = colName !== -1 ? cols[colName]?.trim() : '';
    const host      = colHost !== -1 ? cols[colHost]?.trim() : '';

    if (!name && !pluginId) continue;
    if (!host) continue;

    const dedupeKey = pluginId || name.toLowerCase();

    // Parse CVSS — prefer v3, fall back to v2
    let cvssScore = null;
    let cvssVersion = null;
    if (colCVSS3 !== -1 && cols[colCVSS3]) {
      const v = parseFloat(cols[colCVSS3]);
      if (!isNaN(v) && v > 0) { cvssScore = v; cvssVersion = 3; }
    }
    if (cvssScore === null && colCVSS2 !== -1 && cols[colCVSS2]) {
      const v = parseFloat(cols[colCVSS2]);
      if (!isNaN(v) && v > 0) { cvssScore = v; cvssVersion = 2; }
    }

    const rawSeverity = colSeverity !== -1 ? cols[colSeverity] : null;
    const severity    = parseSeverity(rawSeverity, cvssScore);

    // CVE — N/A if missing
    let cve = colCVE !== -1 ? cols[colCVE]?.trim() : null;
    if (!cve || cve === '' || cve.toLowerCase() === 'n/a') cve = 'N/A';

    if (findingMap.has(dedupeKey)) {
      // Already seen — just add host if not duplicate
      const existing = findingMap.get(dedupeKey);
      if (host && !existing.hosts.includes(host)) {
        existing.hosts.push(host);
        existing.host_count = existing.hosts.length;
      }
    } else {
      findingMap.set(dedupeKey, {
        plugin_id:   pluginId || null,
        title:       name,
        cve:         cve,
        cvss_score:  cvssScore,
        cvss_version: cvssVersion,
        severity:    severity,
        description: colDesc !== -1 ? cols[colDesc]?.trim() || null : null,
        remediation: colSolution !== -1 ? cols[colSolution]?.trim() || null : null,
        hosts:       host ? [host] : [],
        host_count:  host ? 1 : 0,
      });
    }
  }

  if (findingMap.size === 0) {
    throw new Error('No findings were parsed from this CSV. Verify the file is a Nessus export with data rows.');
  }

  return Array.from(findingMap.values());
}

/**
 * Parse a single CSV line respecting quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Compute severity counts from parsed findings
 */
function countsBySeverity(findings) {
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 };
  for (const f of findings) {
    if (counts[f.severity] !== undefined) counts[f.severity]++;
  }
  return counts;
}

module.exports = { parseCSV, countsBySeverity };
