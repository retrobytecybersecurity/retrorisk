'use strict';

/**
 * GoPhish CSV Parser
 * Maps GoPhish campaign result export columns to RetroRisk fields.
 *
 * Standard GoPhish export columns:
 * First Name, Last Name, Email, Position, Status, Reported
 *
 * GoPhish Status values:
 *   "Email Sent"       — delivered, no action
 *   "Email Opened"     — opened only
 *   "Clicked Link"     — clicked the phishing link
 *   "Submitted Data"   — submitted credentials/data
 *   "Email Reported"   — user reported the email
 */

const GOPHISH_COLS = {
  FIRST_NAME: ['first name', 'firstname', 'first_name'],
  LAST_NAME:  ['last name',  'lastname',  'last_name'],
  EMAIL:      ['email', 'email address'],
  POSITION:   ['position', 'title', 'job title', 'role'],
  STATUS:     ['status'],
  REPORTED:   ['reported'],
};

// Status hierarchy — higher index = deeper in funnel
const STATUS_HIERARCHY = [
  'Email Sent',
  'Email Opened',
  'Clicked Link',
  'Submitted Data',
  'Email Reported',
];

function findCol(headers, candidates) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
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

function parseGoPhishCSV(rawText) {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV appears empty or has no data rows');

  const headers = parseCSVLine(lines[0]);

  const colFirstName = findCol(headers, GOPHISH_COLS.FIRST_NAME);
  const colLastName  = findCol(headers, GOPHISH_COLS.LAST_NAME);
  const colEmail     = findCol(headers, GOPHISH_COLS.EMAIL);
  const colPosition  = findCol(headers, GOPHISH_COLS.POSITION);
  const colStatus    = findCol(headers, GOPHISH_COLS.STATUS);
  const colReported  = findCol(headers, GOPHISH_COLS.REPORTED);

  if (colStatus === -1) {
    throw new Error('Could not find a "Status" column — verify this is a GoPhish campaign results export');
  }
  if (colEmail === -1) {
    throw new Error('Could not find an "Email" column — verify this is a GoPhish campaign results export');
  }

  const targets = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const email = colEmail !== -1 ? cols[colEmail]?.trim() : '';
    if (!email) continue;

    const status   = colStatus !== -1   ? cols[colStatus]?.trim()   : 'Email Sent';
    const reported = colReported !== -1 ? cols[colReported]?.trim().toLowerCase() === 'true' : false;

    targets.push({
      first_name: colFirstName !== -1 ? cols[colFirstName]?.trim() || null : null,
      last_name:  colLastName  !== -1 ? cols[colLastName]?.trim()  || null : null,
      email:      email,
      position:   colPosition  !== -1 ? cols[colPosition]?.trim()  || null : null,
      status:     normalizeStatus(status),
      reported:   reported,
    });
  }

  if (targets.length === 0) {
    throw new Error('No target records found in this CSV');
  }

  return targets;
}

function normalizeStatus(raw) {
  if (!raw) return 'Email Sent';
  const lower = raw.toLowerCase();
  if (lower.includes('submitted') || lower.includes('submit data')) return 'Submitted Data';
  if (lower.includes('clicked') || lower.includes('click')) return 'Clicked Link';
  if (lower.includes('opened') || lower.includes('open')) return 'Email Opened';
  if (lower.includes('reported') || lower.includes('report')) return 'Email Reported';
  return 'Email Sent';
}

/**
 * Compute campaign metrics from parsed targets
 */
function computeMetrics(targets, emailsSent) {
  const total = emailsSent || targets.length;

  const opened    = targets.filter(t => isAtLeast(t.status, 'Email Opened')).length;
  const clicked   = targets.filter(t => isAtLeast(t.status, 'Clicked Link')).length;
  const submitted = targets.filter(t => isAtLeast(t.status, 'Submitted Data')).length;
  const reported  = targets.filter(t => t.reported || t.status === 'Email Reported').length;

  const rate = (n) => total > 0 ? parseFloat(((n / total) * 100).toFixed(2)) : 0;

  return {
    emails_sent:     total,
    opened,
    clicked,
    submitted,
    reported,
    open_rate:       rate(opened),
    click_rate:      rate(clicked),
    submission_rate: rate(submitted),
    report_rate:     rate(reported),
  };
}

function isAtLeast(status, threshold) {
  const statusIdx    = STATUS_HIERARCHY.indexOf(status);
  const thresholdIdx = STATUS_HIERARCHY.indexOf(threshold);
  return statusIdx >= thresholdIdx;
}

/**
 * Determine trend direction vs prior campaign click rate
 */
function computeTrend(currentClickRate, priorClickRate) {
  if (priorClickRate === null || priorClickRate === undefined) return 'first';
  const diff = currentClickRate - priorClickRate;
  if (Math.abs(diff) < 2) return 'neutral';
  return diff < 0 ? 'improving' : 'declining';
}

module.exports = { parseGoPhishCSV, computeMetrics, computeTrend };
