'use strict';

const PDFDocument = require('pdfkit');

// ── Brand colors (RGB) ────────────────────────────────────────────────────────
const COLORS = {
  navy:       [13,  15,  30],
  navyMid:    [22,  25,  50],
  blue:       [75,  110, 245],
  purple:     [155, 75,  245],
  cyan:       [0,   194, 255],
  white:      [240, 242, 255],
  textMuted:  [138, 143, 181],
  critical:   [255, 59,  92],
  high:       [255, 123, 59],
  medium:     [255, 184, 59],
  low:        [59,  223, 255],
  info:       [138, 143, 181],
  green:      [59,  255, 138],
};

const SEVERITY_COLORS = {
  Critical:      COLORS.critical,
  High:          COLORS.high,
  Medium:        COLORS.medium,
  Low:           COLORS.low,
  Informational: COLORS.info,
};

// ── Create a new branded PDF document ────────────────────────────────────────
function createDoc() {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    info: { Creator: 'RetroRisk — Retrobyte Cybersecurity', Producer: 'RetroRisk GRC Platform' },
  });
  return doc;
}

// ── Cover page ────────────────────────────────────────────────────────────────
function coverPage(doc, { title, clientName, reportDate, subtitle }) {
  const W = doc.page.width;
  const H = doc.page.height;

  // Dark background
  doc.rect(0, 0, W, H).fill(rgbStr(COLORS.navy));

  // Top accent bar — gradient effect with two rects
  doc.rect(0, 0, W / 2, 6).fill(rgbStr(COLORS.blue));
  doc.rect(W / 2, 0, W / 2, 6).fill(rgbStr(COLORS.purple));

  // Subtle dot grid
  for (let x = 60; x < W - 60; x += 28) {
    for (let y = 80; y < H - 80; y += 28) {
      doc.circle(x, y, 1).fill(`rgba(75,110,245,0.08)`).fillColor(rgbStr([75,110,245])).opacity(0.08);
    }
  }
  doc.opacity(1);

  // Logo mark — R geometric shape
  const lx = 60, ly = 80;
  doc.save()
    .rect(lx, ly, 32, 40).fill(rgbStr(COLORS.blue))
    .restore();
  doc.save()
    .moveTo(lx + 32, ly).lineTo(lx + 52, ly + 20).lineTo(lx + 32, ly + 40)
    .fill(rgbStr(COLORS.purple))
    .restore();

  // RETRORISK wordmark
  doc.font('Helvetica-Bold').fontSize(22).fillColor(rgbStr(COLORS.white))
    .text('RETRO', lx + 60, ly + 8, { continued: true })
    .fillColor(rgbStr(COLORS.blue))
    .text('RISK');

  doc.font('Helvetica').fontSize(10).fillColor(rgbStr(COLORS.textMuted))
    .text('by Retrobyte Cybersecurity', lx + 60, ly + 34);

  // Main title
  const ty = H * 0.35;
  doc.font('Helvetica-Bold').fontSize(32).fillColor(rgbStr(COLORS.white))
    .text(title, 60, ty, { width: W - 120 });

  if (subtitle) {
    doc.font('Helvetica').fontSize(14).fillColor(rgbStr(COLORS.textMuted))
      .text(subtitle, 60, ty + 52, { width: W - 120 });
  }

  // Divider line
  doc.moveTo(60, ty + 90).lineTo(W - 60, ty + 90)
    .strokeColor(rgbStr(COLORS.blue)).lineWidth(1).stroke();

  // Client and date
  doc.font('Helvetica-Bold').fontSize(13).fillColor(rgbStr(COLORS.blue))
    .text('CLIENT', 60, ty + 110);
  doc.font('Helvetica').fontSize(16).fillColor(rgbStr(COLORS.white))
    .text(clientName, 60, ty + 128);

  doc.font('Helvetica-Bold').fontSize(13).fillColor(rgbStr(COLORS.blue))
    .text('REPORT DATE', 60, ty + 164);
  doc.font('Helvetica').fontSize(16).fillColor(rgbStr(COLORS.white))
    .text(reportDate, 60, ty + 182);

  // Footer
  doc.font('Helvetica').fontSize(9).fillColor(rgbStr(COLORS.textMuted))
    .text('CONFIDENTIAL — This report contains sensitive security information.', 60, H - 70, { width: W - 120, align: 'center' });
  doc.text('Unauthorized distribution is prohibited.', 60, H - 56, { width: W - 120, align: 'center' });
}

// ── Page header (on subsequent pages) ────────────────────────────────────────
function pageHeader(doc, { title, clientName, pageNum }) {
  const W = doc.page.width;

  // Top bar
  doc.rect(0, 0, W / 2, 4).fill(rgbStr(COLORS.blue));
  doc.rect(W / 2, 0, W / 2, 4).fill(rgbStr(COLORS.purple));

  // Logo text small
  doc.font('Helvetica-Bold').fontSize(9).fillColor(rgbStr(COLORS.blue))
    .text('RETRO', 60, 16, { continued: true })
    .fillColor(rgbStr(COLORS.purple)).text('RISK');

  // Client name center
  doc.font('Helvetica').fontSize(9).fillColor(rgbStr(COLORS.textMuted))
    .text(clientName, 0, 16, { width: W, align: 'center' });

  // Page number right
  doc.font('Helvetica').fontSize(9).fillColor(rgbStr(COLORS.textMuted))
    .text(`Page ${pageNum}`, 0, 16, { width: W - 60, align: 'right' });

  // Section title
  doc.font('Helvetica-Bold').fontSize(18).fillColor(rgbStr(COLORS.white))
    .text(title, 60, 44);

  doc.moveTo(60, 70).lineTo(W - 60, 70)
    .strokeColor(rgbStr(COLORS.blue)).lineWidth(0.5).stroke();

  return 88; // return Y position to start content
}

// ── Page footer ───────────────────────────────────────────────────────────────
function pageFooter(doc) {
  const W = doc.page.width;
  const H = doc.page.height;
  doc.font('Helvetica').fontSize(8).fillColor(rgbStr(COLORS.textMuted))
    .text('CONFIDENTIAL — Retrobyte Cybersecurity', 60, H - 36, { width: W - 120, align: 'center' });
}

// ── Section heading ───────────────────────────────────────────────────────────
function sectionHeading(doc, text, y) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor(rgbStr(COLORS.blue))
    .text(text, 60, y);
  doc.moveTo(60, y + 20).lineTo(doc.page.width - 60, y + 20)
    .strokeColor(rgbStr(COLORS.blue)).lineWidth(0.3).opacity(0.5).stroke().opacity(1);
  return y + 30;
}

// ── Executive summary box ─────────────────────────────────────────────────────
function execSummaryBox(doc, lines, y) {
  const W = doc.page.width;
  const boxH = lines.length * 18 + 28;
  doc.rect(60, y, W - 120, boxH)
    .fill(rgbStr(COLORS.navyMid));
  doc.rect(60, y, 3, boxH).fill(rgbStr(COLORS.blue));

  let ty = y + 14;
  for (const line of lines) {
    doc.font('Helvetica').fontSize(10).fillColor(rgbStr(COLORS.textMuted))
      .text('•  ', 72, ty, { continued: true })
      .fillColor(rgbStr(COLORS.white)).text(line, { width: W - 150 });
    ty += 18;
  }
  return y + boxH + 16;
}

// ── Severity badge (inline colored rect + text) ───────────────────────────────
function severityBadge(doc, severity, x, y) {
  const color = SEVERITY_COLORS[severity] || COLORS.info;
  const w = doc.widthOfString(severity, { fontSize: 8 }) + 14;
  doc.roundedRect(x, y - 1, w, 14, 3).fill(rgbStr(color.map(c => Math.floor(c * 0.2))));
  doc.font('Helvetica-Bold').fontSize(8).fillColor(rgbStr(color))
    .text(severity.toUpperCase(), x + 7, y + 2);
  return x + w + 6;
}

// ── Score gauge (text-based for PDF) ─────────────────────────────────────────
function scoreGauge(doc, label, value, maxValue, x, y, width) {
  const pct = maxValue > 0 ? value / maxValue : 0;
  const color = pct >= 0.8 ? COLORS.green : pct >= 0.5 ? COLORS.medium : COLORS.critical;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(rgbStr(COLORS.textMuted))
    .text(label, x, y);

  // Bar background
  doc.rect(x, y + 14, width, 8).fill(rgbStr(COLORS.navyMid));
  // Bar fill
  doc.rect(x, y + 14, width * pct, 8).fill(rgbStr(color));

  // Value text
  const displayVal = maxValue === 4
    ? value.toFixed(2)
    : `${Math.round(pct * 100)}%`;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(rgbStr(color))
    .text(displayVal, x + width + 8, y + 12);

  return y + 34;
}

// ── Simple table ──────────────────────────────────────────────────────────────
function table(doc, headers, rows, y, colWidths) {
  const W = doc.page.width;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const startX = 60;

  // Header row
  doc.rect(startX, y, totalW, 22).fill(rgbStr(COLORS.navyMid));
  let hx = startX;
  headers.forEach((h, i) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(rgbStr(COLORS.blue))
      .text(h.toUpperCase(), hx + 6, y + 7, { width: colWidths[i] - 8 });
    hx += colWidths[i];
  });
  y += 22;

  // Data rows
  rows.forEach((row, ri) => {
    const rowH = 20;
    if (ri % 2 === 0) {
      doc.rect(startX, y, totalW, rowH).fill(rgbStr([18, 21, 40]));
    }
    let rx = startX;
    row.forEach((cell, ci) => {
      doc.font('Helvetica').fontSize(8).fillColor(rgbStr(COLORS.white))
        .text(String(cell || '—'), rx + 6, y + 6, { width: colWidths[ci] - 8, ellipsis: true });
      rx += colWidths[ci];
    });
    y += rowH;

    // Page break check
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 80;
    }
  });

  return y + 12;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rgbStr([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function pageBreak(doc) {
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(rgbStr(COLORS.navy));
}

module.exports = {
  createDoc, coverPage, pageHeader, pageFooter,
  sectionHeading, execSummaryBox, severityBadge,
  scoreGauge, table, rgbStr, formatDate, pageBreak,
  COLORS, SEVERITY_COLORS,
};
