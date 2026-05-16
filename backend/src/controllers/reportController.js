'use strict';

const pool = require('../config/database');
const { decrypt } = require('../utils/encryption');
const pdf = require('../utils/pdfBuilder');

const NOW = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ── Helper: get client ────────────────────────────────────────────────────────
async function getClient(clientId) {
  const res = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
  if (!res.rows[0]) return null;
  const r = res.rows[0];
  return {
    ...r,
    organizationName: r.organization_name,
    primaryContactName: decrypt(r.primary_contact_name_enc),
    primaryContactEmail: decrypt(r.primary_contact_email_enc),
  };
}

// ── Set PDF headers ───────────────────────────────────────────────────────────
function setPDFHeaders(res, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

// ── Vulnerability Scan Report ─────────────────────────────────────────────────
async function vulnReport(req, res) {
  const { clientId, scanId } = req.params;
  try {
    const client = await getClient(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const scanRes = await pool.query(
      'SELECT * FROM vuln_scans WHERE id = $1 AND client_id = $2',
      [scanId, clientId]
    );
    if (!scanRes.rows[0]) return res.status(404).json({ error: 'Scan not found' });
    const scan = scanRes.rows[0];

    const findingsRes = await pool.query(
      `SELECT title, cve, cvss_score, cvss_version, severity, description, remediation, hosts, host_count
       FROM vuln_findings WHERE scan_id = $1
       ORDER BY CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
         WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END, cvss_score DESC NULLS LAST`,
      [scanId]
    );
    const findings = findingsRes.rows;

    setPDFHeaders(res, `VulnScan_${client.organization_name.replace(/\s/g, '_')}.pdf`);
    const doc = pdf.createDoc();
    doc.pipe(res);

    // Page setup
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(pdf.rgbStr(pdf.COLORS.navy));

    // Cover
    pdf.coverPage(doc, {
      title: 'Vulnerability Assessment Report',
      subtitle: scan.name,
      clientName: client.organization_name,
      reportDate: NOW(),
    });

    // Executive summary page
    pdf.pageBreak(doc);
    let y = pdf.pageHeader(doc, { title: 'Executive Summary', clientName: client.organization_name, pageNum: 2 });

    const counts = {
      Critical: findings.filter(f => f.severity === 'Critical').length,
      High:     findings.filter(f => f.severity === 'High').length,
      Medium:   findings.filter(f => f.severity === 'Medium').length,
      Low:      findings.filter(f => f.severity === 'Low').length,
    };

    y = pdf.execSummaryBox(doc, [
      `Scan: ${scan.name}`,
      `Scope: ${scan.scope}${scan.scope_custom ? ` — ${scan.scope_custom}` : ''}`,
      `Total unique findings: ${findings.length}`,
      `Critical: ${counts.Critical}  |  High: ${counts.High}  |  Medium: ${counts.Medium}  |  Low: ${counts.Low}`,
      `Import date: ${pdf.formatDate(scan.imported_at)}`,
    ], y);

    // Severity breakdown gauges
    y = pdf.sectionHeading(doc, 'Finding Severity Breakdown', y + 10);
    const barW = 200;
    ['Critical','High','Medium','Low'].forEach(sev => {
      const c = counts[sev];
      const color = pdf.SEVERITY_COLORS[sev];
      doc.font('Helvetica-Bold').fontSize(10).fillColor(pdf.rgbStr(color)).text(`${sev}: ${c}`, 60, y);
      doc.rect(160, y + 2, barW, 10).fill(pdf.rgbStr(pdf.COLORS.navyMid));
      if (findings.length > 0) {
        doc.rect(160, y + 2, Math.floor(barW * (c / findings.length)), 10).fill(pdf.rgbStr(color));
      }
      y += 22;
    });

    // Findings table
    pdf.pageBreak(doc);
    y = pdf.pageHeader(doc, { title: 'Findings Detail', clientName: client.organization_name, pageNum: 3 });

    const colW = [80, 70, 60, doc.page.width - 60 - 80 - 70 - 60 - 120, 120];
    y = pdf.table(doc,
      ['Severity', 'CVE', 'CVSS', 'Finding Title', 'Hosts'],
      findings.map(f => [
        f.severity,
        f.cve || 'N/A',
        f.cvss_score ? `${f.cvss_score} (v${f.cvss_version})` : 'N/A',
        f.title,
        f.host_count > 10 ? `${f.hosts.slice(0,3).join(', ')} +${f.host_count - 3} more` : (f.hosts || []).join(', '),
      ]),
      y, colW
    );

    pdf.pageFooter(doc);
    doc.end();
  } catch (err) {
    console.error('Vuln report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed' });
  }
}

// ── Penetration Test Report ───────────────────────────────────────────────────
async function pentestReport(req, res) {
  const { clientId, engagementId } = req.params;
  try {
    const client = await getClient(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const engRes = await pool.query(
      'SELECT * FROM pentest_engagements WHERE id = $1 AND client_id = $2',
      [engagementId, clientId]
    );
    if (!engRes.rows[0]) return res.status(404).json({ error: 'Engagement not found' });
    const eng = engRes.rows[0];

    const findingsRes = await pool.query(
      `SELECT title, severity, status, description, evidence_summary, remediation, affected_systems
       FROM pentest_findings WHERE engagement_id = $1
       ORDER BY CASE severity WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
         WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`,
      [engagementId]
    );
    const findings = findingsRes.rows;

    setPDFHeaders(res, `PenTest_${client.organization_name.replace(/\s/g, '_')}.pdf`);
    const doc = pdf.createDoc();
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(pdf.rgbStr(pdf.COLORS.navy));

    pdf.coverPage(doc, {
      title: 'Penetration Test Report',
      subtitle: eng.name,
      clientName: client.organization_name,
      reportDate: NOW(),
    });

    // Executive summary
    pdf.pageBreak(doc);
    let y = pdf.pageHeader(doc, { title: 'Executive Summary', clientName: client.organization_name, pageNum: 2 });

    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0 };
    findings.forEach(f => { if (counts[f.severity] !== undefined) counts[f.severity]++; });
    const open = findings.filter(f => !['Remediated - Verified','Risk Accepted'].includes(f.status)).length;

    y = pdf.execSummaryBox(doc, [
      `Engagement: ${eng.name}`,
      `Type: ${eng.engagement_type}`,
      `Testing Firm: ${eng.testing_firm || 'Retrobyte Cybersecurity'}`,
      `Test Period: ${pdf.formatDate(eng.start_date)} — ${pdf.formatDate(eng.end_date)}`,
      `Total Findings: ${findings.length}  |  Open: ${open}`,
      `Critical: ${counts.Critical}  |  High: ${counts.High}  |  Medium: ${counts.Medium}  |  Low: ${counts.Low}`,
    ], y);

    // Findings list (executive — name + severity + status only per spec)
    pdf.pageBreak(doc);
    y = pdf.pageHeader(doc, { title: 'Finding Summary', clientName: client.organization_name, pageNum: 3 });

    const W = doc.page.width;
    y = pdf.table(doc,
      ['Finding Title', 'Severity', 'Status'],
      findings.map(f => [f.title, f.severity, f.status]),
      y, [W - 120 - 100 - 120, 100, 120]
    );

    // Detail pages per finding
    findings.forEach((f, i) => {
      pdf.pageBreak(doc);
      let fy = pdf.pageHeader(doc, { title: `Finding ${i + 1} of ${findings.length}`, clientName: client.organization_name, pageNum: i + 4 });

      doc.font('Helvetica-Bold').fontSize(14).fillColor(pdf.rgbStr(pdf.COLORS.white))
        .text(f.title, 60, fy, { width: W - 120 });
      fy += 26;

      pdf.severityBadge(doc, f.severity, 60, fy);
      fy += 26;

      if (f.description) {
        fy = pdf.sectionHeading(doc, 'Description', fy);
        doc.font('Helvetica').fontSize(9).fillColor(pdf.rgbStr(pdf.COLORS.textMuted))
          .text(f.description, 60, fy, { width: W - 120 });
        fy = doc.y + 16;
      }

      if (f.remediation) {
        fy = pdf.sectionHeading(doc, 'Remediation', fy);
        doc.font('Helvetica').fontSize(9).fillColor(pdf.rgbStr(pdf.COLORS.white))
          .text(f.remediation, 60, fy, { width: W - 120 });
        fy = doc.y + 16;
      }

      if (f.affected_systems?.length > 0) {
        fy = pdf.sectionHeading(doc, 'Affected Systems', fy);
        doc.font('Helvetica').fontSize(9).fillColor(pdf.rgbStr(pdf.COLORS.cyan))
          .text(f.affected_systems.join(', '), 60, fy, { width: W - 120 });
      }

      pdf.pageFooter(doc);
    });

    doc.end();
  } catch (err) {
    console.error('Pentest report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed' });
  }
}

// ── CIS v8 Assessment Report ──────────────────────────────────────────────────
async function cisReport(req, res) {
  const { clientId, assessmentId } = req.params;
  try {
    const client = await getClient(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const assessRes = await pool.query(
      'SELECT * FROM cis_assessments WHERE id = $1 AND client_id = $2',
      [assessmentId, clientId]
    );
    if (!assessRes.rows[0]) return res.status(404).json({ error: 'Assessment not found' });
    const assess = assessRes.rows[0];

    const responsesRes = await pool.query(
      `SELECT safeguard_id, control_id, status, gaps_observations, risk_rating
       FROM cis_responses WHERE assessment_id = $1 ORDER BY control_id, safeguard_id`,
      [assessmentId]
    );
    const responses = responsesRes.rows;

    const controlScores = typeof assess.control_scores === 'string'
      ? JSON.parse(assess.control_scores) : (assess.control_scores || {});

    setPDFHeaders(res, `CIS_v8_${client.organization_name.replace(/\s/g, '_')}.pdf`);
    const doc = pdf.createDoc();
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(pdf.rgbStr(pdf.COLORS.navy));

    pdf.coverPage(doc, {
      title: 'CIS Controls v8 Assessment',
      subtitle: assess.name,
      clientName: client.organization_name,
      reportDate: NOW(),
    });

    // Executive summary
    pdf.pageBreak(doc);
    let y = pdf.pageHeader(doc, { title: 'Executive Summary', clientName: client.organization_name, pageNum: 2 });
    const W = doc.page.width;

    const compliant  = responses.filter(r => r.status === 'Compliant').length;
    const partial    = responses.filter(r => r.status === 'Partially Compliant').length;
    const nonComp    = responses.filter(r => r.status === 'Non-Compliant').length;
    const na         = responses.filter(r => r.status === 'Not Applicable').length;
    const notAssessed= responses.filter(r => r.status === 'Not Assessed').length;

    y = pdf.execSummaryBox(doc, [
      `Assessment: ${assess.name}`,
      `IG Level: ${assess.ig_level}  |  Total Safeguards: ${assess.total_safeguards}`,
      `Overall Maturity Score: ${assess.overall_score}%`,
      `Compliant: ${compliant}  |  Partial: ${partial}  |  Non-Compliant: ${nonComp}  |  N/A: ${na}  |  Not Assessed: ${notAssessed}`,
    ], y);

    // Overall score gauge
    y = pdf.sectionHeading(doc, 'Overall Maturity Score', y + 10);
    y = pdf.scoreGauge(doc, 'Overall', parseFloat(assess.overall_score), 100, 60, y, W - 200);

    // Control group breakdown
    y = pdf.sectionHeading(doc, 'Control Group Scores', y + 20);
    const CIS_CONTROLS = [
      'Inventory of Enterprise Assets', 'Inventory of Software Assets', 'Data Protection',
      'Secure Configuration', 'Account Management', 'Access Control Management',
      'Continuous Vulnerability Management', 'Audit Log Management', 'Email & Web Browser Protections',
      'Malware Defenses', 'Data Recovery', 'Network Infrastructure Management',
      'Network Monitoring and Defense', 'Security Awareness Training', 'Service Provider Management',
      'Application Software Security', 'Incident Response Management', 'Penetration Testing',
    ];

    Object.entries(controlScores).forEach(([ctrlId, score]) => {
      const label = `${ctrlId}. ${CIS_CONTROLS[parseInt(ctrlId) - 1] || ''}`;
      if (y > doc.page.height - 120) {
        pdf.pageBreak(doc);
        y = pdf.pageHeader(doc, { title: 'Control Group Scores (cont.)', clientName: client.organization_name, pageNum: 3 });
      }
      y = pdf.scoreGauge(doc, label, score, 100, 60, y, W - 200);
    });

    // Non-compliant items
    const issues = responses.filter(r => ['Non-Compliant','Partially Compliant'].includes(r.status));
    if (issues.length > 0) {
      pdf.pageBreak(doc);
      y = pdf.pageHeader(doc, { title: 'Gaps & Findings', clientName: client.organization_name, pageNum: 4 });
      y = pdf.table(doc,
        ['Safeguard', 'Status', 'Risk Rating', 'Observations'],
        issues.map(r => [
          r.safeguard_id,
          r.status,
          r.risk_rating || 'Not Rated',
          r.gaps_observations || '—',
        ]),
        y, [70, 120, 90, W - 120 - 70 - 120 - 90]
      );
    }

    pdf.pageFooter(doc);
    doc.end();
  } catch (err) {
    console.error('CIS report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed' });
  }
}

// ── NIST CSF 2.0 Report ───────────────────────────────────────────────────────
async function nistReport(req, res) {
  const { clientId, assessmentId } = req.params;
  try {
    const client = await getClient(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const assessRes = await pool.query(
      'SELECT * FROM nist_assessments WHERE id = $1 AND client_id = $2',
      [assessmentId, clientId]
    );
    if (!assessRes.rows[0]) return res.status(404).json({ error: 'Assessment not found' });
    const assess = assessRes.rows[0];

    const responsesRes = await pool.query(
      `SELECT subcategory_id, function_id, category_id,
              current_tier, target_tier, gaps_observations, risk_rating
       FROM nist_responses WHERE assessment_id = $1
       ORDER BY function_id, category_id, subcategory_id`,
      [assessmentId]
    );
    const responses = responsesRes.rows;

    const funcScores = typeof assess.function_scores === 'string'
      ? JSON.parse(assess.function_scores) : (assess.function_scores || {});

    const FUNCTIONS = {
      GV: 'Govern', ID: 'Identify', PR: 'Protect',
      DE: 'Detect', RS: 'Respond', RC: 'Recover',
    };

    setPDFHeaders(res, `NIST_CSF2_${client.organization_name.replace(/\s/g, '_')}.pdf`);
    const doc = pdf.createDoc();
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(pdf.rgbStr(pdf.COLORS.navy));

    pdf.coverPage(doc, {
      title: 'NIST CSF 2.0 Assessment',
      subtitle: assess.name,
      clientName: client.organization_name,
      reportDate: NOW(),
    });

    // Executive summary
    pdf.pageBreak(doc);
    let y = pdf.pageHeader(doc, { title: 'Executive Summary', clientName: client.organization_name, pageNum: 2 });
    const W = doc.page.width;

    const gap = Math.max(0, parseFloat(assess.overall_target) - parseFloat(assess.overall_current)).toFixed(2);

    y = pdf.execSummaryBox(doc, [
      `Assessment: ${assess.name}`,
      `Assessed: ${assess.assessed_subcategories} of ${assess.total_subcategories} subcategories`,
      `Current Maturity: ${parseFloat(assess.overall_current).toFixed(2)} / 4.0`,
      `Target Maturity: ${parseFloat(assess.overall_target).toFixed(2)} / 4.0`,
      `Overall Gap: ${gap} tiers`,
    ], y);

    // Function scores
    y = pdf.sectionHeading(doc, 'Function Maturity Scores', y + 10);
    Object.entries(funcScores).forEach(([fn, scores]) => {
      const label = `${fn} — ${FUNCTIONS[fn] || fn}`;
      if (y > doc.page.height - 140) {
        pdf.pageBreak(doc);
        y = pdf.pageHeader(doc, { title: 'Function Scores (cont.)', clientName: client.organization_name, pageNum: 3 });
      }
      // Current
      y = pdf.scoreGauge(doc, `${label} (Current)`, scores.current || 0, 4, 60, y, (W - 200) / 2);
      // Target
      y = pdf.scoreGauge(doc, `${label} (Target)`, scores.target || 0, 4, 60, y, (W - 200) / 2);
      y += 6;
    });

    // Gap analysis — subcategories where gap > 0
    const gaps = responses.filter(r => r.current_tier > 0 && r.target_tier > r.current_tier);
    if (gaps.length > 0) {
      pdf.pageBreak(doc);
      y = pdf.pageHeader(doc, { title: 'Gap Analysis', clientName: client.organization_name, pageNum: 4 });
      y = pdf.table(doc,
        ['Subcategory', 'Function', 'Current', 'Target', 'Gap', 'Risk Rating'],
        gaps.map(r => [
          r.subcategory_id, r.function_id,
          `Tier ${r.current_tier}`, `Tier ${r.target_tier}`,
          `${r.target_tier - r.current_tier}`,
          r.risk_rating || '—',
        ]),
        y, [100, 60, 60, 60, 40, 80]
      );
    }

    pdf.pageFooter(doc);
    doc.end();
  } catch (err) {
    console.error('NIST report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed' });
  }
}

// ── Phishing Report ───────────────────────────────────────────────────────────
async function phishingReport(req, res) {
  const { clientId, campaignId } = req.params;
  try {
    const client = await getClient(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const campRes = await pool.query(
      'SELECT * FROM phishing_campaigns WHERE id = $1 AND client_id = $2',
      [campaignId, clientId]
    );
    if (!campRes.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    const camp = campRes.rows[0];

    // All campaigns for trend
    const trendRes = await pool.query(
      'SELECT name, campaign_date, click_rate, report_rate FROM phishing_campaigns WHERE client_id = $1 ORDER BY campaign_date ASC',
      [clientId]
    );

    setPDFHeaders(res, `Phishing_${client.organization_name.replace(/\s/g, '_')}.pdf`);
    const doc = pdf.createDoc();
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(pdf.rgbStr(pdf.COLORS.navy));

    pdf.coverPage(doc, {
      title: 'Phishing Assessment Report',
      subtitle: camp.name,
      clientName: client.organization_name,
      reportDate: NOW(),
    });

    pdf.pageBreak(doc);
    let y = pdf.pageHeader(doc, { title: 'Campaign Results', clientName: client.organization_name, pageNum: 2 });
    const W = doc.page.width;

    y = pdf.execSummaryBox(doc, [
      `Campaign: ${camp.name}`,
      `Type: ${camp.phishing_type}`,
      `Date: ${pdf.formatDate(camp.campaign_date)}`,
      `Lure: ${camp.pretext || 'Not specified'}`,
      `Emails Sent: ${camp.emails_sent}`,
      `Testing Firm: ${camp.testing_firm || 'Retrobyte Cybersecurity'}`,
    ], y);

    y = pdf.sectionHeading(doc, 'Key Metrics', y + 10);

    const metrics = [
      { label: 'Open Rate',       value: parseFloat(camp.open_rate),       raw: camp.opened },
      { label: 'Click Rate',      value: parseFloat(camp.click_rate),      raw: camp.clicked },
      { label: 'Submission Rate', value: parseFloat(camp.submission_rate), raw: camp.submitted },
      { label: 'Report Rate',     value: parseFloat(camp.report_rate),     raw: camp.reported },
    ];

    metrics.forEach(m => {
      const color = m.label === 'Report Rate' ? pdf.COLORS.green :
                    m.value > 20 ? pdf.COLORS.critical : pdf.COLORS.medium;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(pdf.rgbStr(color))
        .text(`${m.value}%`, 60, y, { continued: true })
        .font('Helvetica').fontSize(9).fillColor(pdf.rgbStr(pdf.COLORS.textMuted))
        .text(`  ${m.label} (${m.raw} of ${camp.emails_sent})`, { width: W - 120 });
      doc.rect(60, y + 18, (W - 120), 6).fill(pdf.rgbStr(pdf.COLORS.navyMid));
      doc.rect(60, y + 18, Math.floor((W - 120) * (m.value / 100)), 6).fill(pdf.rgbStr(color));
      y += 40;
    });

    // Trend table
    if (trendRes.rows.length > 1) {
      y = pdf.sectionHeading(doc, 'Campaign History', y + 10);
      y = pdf.table(doc,
        ['Campaign', 'Date', 'Click Rate', 'Report Rate'],
        trendRes.rows.map(r => [
          r.name, pdf.formatDate(r.campaign_date),
          `${parseFloat(r.click_rate).toFixed(1)}%`,
          `${parseFloat(r.report_rate).toFixed(1)}%`,
        ]),
        y, [250, 120, 80, 80]
      );
    }

    pdf.pageFooter(doc);
    doc.end();
  } catch (err) {
    console.error('Phishing report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed' });
  }
}

// ── Roadmap Report ────────────────────────────────────────────────────────────
async function roadmapReport(req, res) {
  const { clientId } = req.params;
  try {
    const client = await getClient(clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const itemsRes = await pool.query(
      `SELECT title, source, priority, status, phase, effort, due_date, assigned_owner, notes
       FROM roadmap_items WHERE client_id = $1
       ORDER BY CASE source WHEN 'CIS' THEN 1 WHEN 'NIST' THEN 2 WHEN 'Pen Test' THEN 3
         WHEN 'Vuln Scan' THEN 4 WHEN 'Phishing' THEN 5 ELSE 6 END,
         CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2
           WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END`,
      [clientId]
    );
    const items = itemsRes.rows;

    const summaryRes = await pool.query(
      `SELECT COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'Completed') as completed,
         COUNT(*) FILTER (WHERE status NOT IN ('Completed','Risk Accepted')) as open_total
       FROM roadmap_items WHERE client_id = $1`,
      [clientId]
    );
    const summary = summaryRes.rows[0];

    setPDFHeaders(res, `Roadmap_${client.organization_name.replace(/\s/g, '_')}.pdf`);
    const doc = pdf.createDoc();
    doc.pipe(res);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill(pdf.rgbStr(pdf.COLORS.navy));

    pdf.coverPage(doc, {
      title: 'Remediation Roadmap Report',
      clientName: client.organization_name,
      reportDate: NOW(),
    });

    pdf.pageBreak(doc);
    let y = pdf.pageHeader(doc, { title: 'Roadmap Overview', clientName: client.organization_name, pageNum: 2 });
    const W = doc.page.width;

    const pct = parseInt(summary.total) > 0
      ? Math.round((parseInt(summary.completed) / parseInt(summary.total)) * 100) : 0;

    y = pdf.execSummaryBox(doc, [
      `Total Items: ${summary.total}`,
      `Open: ${summary.open_total}  |  Completed: ${summary.completed}`,
      `Overall Completion: ${pct}%`,
    ], y);

    y = pdf.sectionHeading(doc, 'Completion Progress', y + 10);
    y = pdf.scoreGauge(doc, 'Overall', pct, 100, 60, y, W - 200);

    // Items by phase
    ['Quick Win', 'Short Term', 'Long Term'].forEach(phase => {
      const phaseItems = items.filter(i => i.phase === phase);
      if (phaseItems.length === 0) return;

      if (y > doc.page.height - 200) {
        pdf.pageBreak(doc);
        y = pdf.pageHeader(doc, { title: `Roadmap — ${phase}`, clientName: client.organization_name, pageNum: 3 });
      }

      y = pdf.sectionHeading(doc, phase, y + 10);
      y = pdf.table(doc,
        ['Title', 'Source', 'Priority', 'Status', 'Due Date', 'Assigned To'],
        phaseItems.map(i => [
          i.title, i.source, i.priority, i.status,
          i.due_date ? new Date(i.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
          i.assigned_owner || '—',
        ]),
        y, [180, 70, 70, 90, 80, 80]
      );
    });

    pdf.pageFooter(doc);
    doc.end();
  } catch (err) {
    console.error('Roadmap report error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Report generation failed' });
  }
}

module.exports = { vulnReport, pentestReport, cisReport, nistReport, phishingReport, roadmapReport };
