import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import type { RegionStat } from '../components/GeographicDistributionChart';
import { formatCarwashDisplay } from './utils';

export type ReportCarwash = {
  id?: string;
  name?: string;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  address?: string;
  contact_name?: string;
  phone?: string;
  status?: string;
  verification_status?: string;
  registration_date?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReportStats = {
  total?: number;
  verified?: number;
  unverified?: number;
  active?: number;
  regions?: {
    kigali?: number;
    northern?: number;
    southern?: number;
    eastern?: number;
    western?: number;
  };
  recent?: ReportCarwash[];
};

export type NationalReportInput = {
  stats: ReportStats;
  carwashes: ReportCarwash[];
  generatedBy?: string;
};

const REGION_COLORS = [
  [59, 130, 246],
  [16, 185, 129],
  [245, 158, 11],
  [139, 92, 246],
  [6, 182, 212],
] as const;

export function buildRegionStats(stats?: ReportStats): RegionStat[] {
  return [
    { label: 'Kigali City', value: stats?.regions?.kigali || 0 },
    { label: 'Northern Province', value: stats?.regions?.northern || 0 },
    { label: 'Southern Province', value: stats?.regions?.southern || 0 },
    { label: 'Eastern Province', value: stats?.regions?.eastern || 0 },
    { label: 'Western Province', value: stats?.regions?.western || 0 },
  ];
}

function stamp(): string {
  return format(new Date(), 'yyyy-MM-dd_HH-mm');
}

function displayDate(value?: string): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '—';
  }
}

function drawGeoBarChart(
  doc: jsPDF,
  regions: RegionStat[],
  x: number,
  y: number,
  width: number,
  height: number
) {
  const maxVal = Math.max(...regions.map((r) => r.value), 1);
  const padLeft = 28;
  const padBottom = 28;
  const padTop = 10;
  const chartW = width - padLeft;
  const chartH = height - padBottom - padTop;
  const barGap = 10;
  const barW = (chartW - barGap * (regions.length + 1)) / regions.length;

  // Panel background
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, width, height, 3, 3, 'FD');

  // Axis line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(x + padLeft, y + padTop + chartH, x + width - 6, y + padTop + chartH);

  regions.forEach((region, i) => {
    const barH = (region.value / maxVal) * chartH;
    const bx = x + padLeft + barGap + i * (barW + barGap);
    const by = y + padTop + chartH - barH;
    const [r, g, b] = REGION_COLORS[i % REGION_COLORS.length];

    doc.setFillColor(r, g, b);
    doc.roundedRect(bx, by, barW, Math.max(barH, region.value > 0 ? 2 : 0), 1.5, 1.5, 'F');

    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    const valueLabel = String(region.value);
    doc.text(valueLabel, bx + barW / 2, by - 2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    const short = region.label.replace(' Province', '').replace(' City', '');
    doc.text(short, bx + barW / 2, y + height - 10, { align: 'center' });
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Geographic Distribution (Facilities by Province)', x + 4, y - 3);
}

function drawGeoPieLegend(
  doc: jsPDF,
  regions: RegionStat[],
  x: number,
  y: number,
  total: number
) {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Regional Share', x, y);

  let rowY = y + 8;
  regions.forEach((region, i) => {
    const [r, g, b] = REGION_COLORS[i % REGION_COLORS.length];
    const pct = total > 0 ? Math.round((region.value / total) * 100) : 0;
    doc.setFillColor(r, g, b);
    doc.circle(x + 2, rowY - 1.2, 1.6, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`${region.label}: ${region.value} (${pct}%)`, x + 6, rowY);
    rowY += 6;
  });
}

export async function exportNationalPdfReport(input: NationalReportInput): Promise<void> {
  const { stats, carwashes, generatedBy } = input;
  const regions = buildRegionStats(stats);
  const total = stats.total ?? carwashes.length;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header
  doc.setFillColor(11, 59, 143);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CYESHA — National Carwash Registry', margin, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('National Report including Geographic Distribution', margin, 19);
  doc.setFontSize(8);
  doc.text(`Generated ${format(new Date(), 'PPpp')}${generatedBy ? ` · ${generatedBy}` : ''}`, margin, 25);

  let y = 36;

  // KPI boxes
  const kpis = [
    { label: 'Total', value: total },
    { label: 'Verified', value: stats.verified ?? 0 },
    { label: 'Pending', value: stats.unverified ?? 0 },
    { label: 'Active', value: stats.active ?? 0 },
  ];
  const boxW = (pageW - margin * 2 - 9) / 4;
  kpis.forEach((kpi, i) => {
    const bx = margin + i * (boxW + 3);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxW, 18, 2, 2, 'FD');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label.toUpperCase(), bx + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(String(kpi.value), bx + 3, y + 14);
    doc.setFont('helvetica', 'normal');
  });

  y += 28;
  drawGeoBarChart(doc, regions, margin, y, pageW - margin * 2 - 55, 55);
  drawGeoPieLegend(doc, regions, pageW - margin - 50, y + 8, total);

  y += 66;

  // Facility registry table
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Registered Carwash Facilities', margin, y);
  y += 3;

  autoTable(doc, {
    startY: y + 2,
    head: [['Carwash Facility', 'Province', 'District', 'Sector', 'Cell', 'Contact', 'Phone', 'Registered', 'Status']],
    body: carwashes.map((cw) => [
      formatCarwashDisplay(cw),
      cw.province || '—',
      cw.district || '—',
      cw.sector || '—',
      cw.cell || '—',
      cw.contact_name || '—',
      cw.phone || '—',
      displayDate(cw.registration_date || cw.created_at),
      cw.status || '—',
    ]),
    styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak' },
    headStyles: { fillColor: [16, 185, 129], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 20 },
      2: { cellWidth: 16 },
      3: { cellWidth: 14 },
      4: { cellWidth: 14 },
      5: { cellWidth: 20 },
      6: { cellWidth: 18 },
      7: { cellWidth: 16 },
      8: { cellWidth: 14 },
    },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `CYESHA National Registry Report · Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`cyesha-national-report_${stamp()}.pdf`);
}

export async function exportNationalExcelReport(input: NationalReportInput): Promise<void> {
  const { stats, carwashes, generatedBy } = input;
  const regions = buildRegionStats(stats);
  const total = stats.total ?? carwashes.length;
  const verified = stats.verified ?? 0;
  const pending = stats.unverified ?? 0;
  const active = stats.active ?? 0;
  const generatedAt = format(new Date(), 'PPpp');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CYESHA National Registry';
  wb.created = new Date();
  wb.modified = new Date();
  wb.company = 'CYESHA';
  wb.title = 'National Carwash Registry Report';

  const brandBlue = '0B3B8F';
  const brandBlueSoft = 'EFF6FF';
  const brandGreen = '059669';
  const brandGreenSoft = 'ECFDF5';
  const brandAmber = 'D97706';
  const brandAmberSoft = 'FFFBEB';
  const slate = '0F172A';
  const muted = '64748B';
  const border = 'E2E8F0';
  const white = 'FFFFFF';
  const zebra = 'F8FAFC';

  // ─── Sheet 1: Cover / Summary ───────────────────────────────────────────
  const summary = wb.addWorksheet('Executive Summary', {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 18 },
  });

  summary.columns = [
    { key: 'a', width: 3 },
    { key: 'b', width: 28 },
    { key: 'c', width: 22 },
    { key: 'd', width: 22 },
    { key: 'e', width: 22 },
    { key: 'f', width: 22 },
    { key: 'g', width: 3 },
  ];

  // Hero banner
  summary.mergeCells('B2:F2');
  const titleCell = summary.getCell('B2');
  titleCell.value = 'CYESHA — National Carwash Registry';
  titleCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: `FF${white}` } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${brandBlue}` } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summary.getRow(2).height = 36;

  summary.mergeCells('B3:F3');
  const subtitle = summary.getCell('B3');
  subtitle.value = 'Official national report · Geographic coverage & facility registry';
  subtitle.font = { name: 'Calibri', size: 11, color: { argb: `FF${white}` } };
  subtitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF155EEF' } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summary.getRow(3).height = 22;

  // Meta block
  summary.getCell('B5').value = 'Generated';
  summary.getCell('C5').value = generatedAt;
  summary.getCell('B6').value = 'Prepared by';
  summary.getCell('C6').value = generatedBy || 'System Administrator';
  summary.getCell('B7').value = 'Document';
  summary.getCell('C7').value = `cyesha-national-report_${stamp()}.xlsx`;
  for (const row of [5, 6, 7]) {
    summary.getCell(`B${row}`).font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${muted}` } };
    summary.getCell(`C${row}`).font = { name: 'Calibri', size: 10, color: { argb: `FF${slate}` } };
  }

  // KPI section header
  summary.mergeCells('B9:F9');
  const kpiHead = summary.getCell('B9');
  kpiHead.value = 'KEY PERFORMANCE INDICATORS';
  kpiHead.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${brandBlue}` } };
  kpiHead.alignment = { vertical: 'middle' };
  summary.getRow(9).height = 20;

  const kpiDefs = [
    { col: 'B', label: 'Total Registrations', value: total, fill: brandBlue, soft: brandBlueSoft },
    { col: 'C', label: 'Verified', value: verified, fill: brandGreen, soft: brandGreenSoft },
    { col: 'D', label: 'Pending Review', value: pending, fill: brandAmber, soft: brandAmberSoft },
    { col: 'E', label: 'Active Operations', value: active, fill: brandBlue, soft: brandBlueSoft },
  ];

  for (const kpi of kpiDefs) {
    const labelCell = summary.getCell(`${kpi.col}10`);
    labelCell.value = kpi.label.toUpperCase();
    labelCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: `FF${kpi.fill}` } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${kpi.soft}` } };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    labelCell.border = {
      top: { style: 'thin', color: { argb: `FF${border}` } },
      left: { style: 'thin', color: { argb: `FF${border}` } },
      right: { style: 'thin', color: { argb: `FF${border}` } },
    };

    const valueCell = summary.getCell(`${kpi.col}11`);
    valueCell.value = kpi.value;
    valueCell.font = { name: 'Calibri', size: 22, bold: true, color: { argb: `FF${slate}` } };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${kpi.soft}` } };
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valueCell.border = {
      bottom: { style: 'thin', color: { argb: `FF${border}` } },
      left: { style: 'thin', color: { argb: `FF${border}` } },
      right: { style: 'thin', color: { argb: `FF${border}` } },
    };
  }
  summary.getRow(10).height = 18;
  summary.getRow(11).height = 36;

  // Geographic distribution section
  summary.mergeCells('B13:F13');
  const geoHead = summary.getCell('B13');
  geoHead.value = 'GEOGRAPHIC DISTRIBUTION BY PROVINCE';
  geoHead.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${brandBlue}` } };
  summary.getRow(13).height = 20;

  const geoHeaders = ['Province / Region', 'Facilities', 'Share %', 'Visual'];
  geoHeaders.forEach((h, i) => {
    const cell = summary.getCell(14, i + 2);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${white}` } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${brandGreen}` } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle', indent: i === 0 ? 1 : 0 };
    cell.border = { bottom: { style: 'thin', color: { argb: `FF${brandGreen}` } } };
  });
  summary.getRow(14).height = 22;

  const barColors = ['3B82F6', '10B981', 'F59E0B', '8B5CF6', '06B6D4'];
  regions.forEach((region, idx) => {
    const rowIdx = 15 + idx;
    const pct = total > 0 ? Math.round((region.value / total) * 100) : 0;
    const row = summary.getRow(rowIdx);
    row.height = 22;

    const nameCell = row.getCell(2);
    nameCell.value = region.label;
    nameCell.font = { name: 'Calibri', size: 10, color: { argb: `FF${slate}` } };
    nameCell.alignment = { vertical: 'middle', indent: 1 };

    const countCell = row.getCell(3);
    countCell.value = region.value;
    countCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${slate}` } };
    countCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const pctCell = row.getCell(4);
    pctCell.value = pct / 100;
    pctCell.numFmt = '0%';
    pctCell.font = { name: 'Calibri', size: 10, color: { argb: `FF${muted}` } };
    pctCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const visualCell = row.getCell(5);
    // Repeat block characters proportional to share (presentable bar surrogate)
    const blocks = Math.round(pct / 5);
    visualCell.value = blocks > 0 ? '█'.repeat(blocks) : '·';
    visualCell.font = { name: 'Calibri', size: 10, color: { argb: `FF${barColors[idx % barColors.length]}` } };
    visualCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const bg = idx % 2 === 0 ? zebra : white;
    for (let c = 2; c <= 5; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${bg}` } };
      row.getCell(c).border = {
        bottom: { style: 'hair', color: { argb: `FF${border}` } },
      };
    }
  });

  // Footer note
  const footerRow = 15 + regions.length + 2;
  summary.mergeCells(`B${footerRow}:F${footerRow}`);
  const foot = summary.getCell(`B${footerRow}`);
  foot.value =
    'Confidential — for internal registry use. Figures reflect the national carwash database at time of export.';
  foot.font = { name: 'Calibri', size: 8, italic: true, color: { argb: `FF${muted}` } };

  // ─── Sheet 2: Facilities registry ───────────────────────────────────────
  const facilities = wb.addWorksheet('Facility Registry', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });

  const facilityHeaders = [
    'Carwash Facility',
    'Province',
    'District',
    'Sector',
    'Cell',
    'Contact Person',
    'Phone',
    'Status',
    'Verification',
    'Registered',
  ];

  facilities.columns = [
    { width: 42 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 20 },
    { width: 16 },
    { width: 12 },
    { width: 13 },
    { width: 13 },
  ];

  const headerRow = facilities.getRow(1);
  headerRow.height = 24;
  facilityHeaders.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${white}` } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${brandBlue}` } };
    cell.alignment = { horizontal: i >= 7 ? 'center' : 'left', vertical: 'middle', indent: i >= 7 ? 0 : 1 };
    cell.border = { bottom: { style: 'medium', color: { argb: `FF${brandBlue}` } } };
  });

  const sorted = [...carwashes].sort((a, b) =>
    (a.province || '').localeCompare(b.province || '') ||
    (a.district || '').localeCompare(b.district || '') ||
    (a.cell || '').localeCompare(b.cell || '') ||
    formatCarwashDisplay(a).localeCompare(formatCarwashDisplay(b))
  );

  sorted.forEach((cw, idx) => {
    const row = facilities.getRow(idx + 2);
    row.height = 18;
    const values = [
      formatCarwashDisplay(cw),
      cw.province || '—',
      cw.district || '—',
      cw.sector || '—',
      cw.cell || '—',
      cw.contact_name || '—',
      cw.phone || '—',
      (cw.status || '—').toString(),
      (cw.verification_status || '—').toString(),
      displayDate(cw.registration_date || cw.created_at),
    ];

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 9, color: { argb: `FF${slate}` } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: i >= 7 ? 'center' : 'left',
        indent: i >= 7 ? 0 : 1,
      };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${zebra}` } };
      }
      cell.border = {
        bottom: { style: 'hair', color: { argb: `FF${border}` } },
      };
    });

    // Status pill colours (Status=8, Verification=9)
    const statusCell = row.getCell(8);
    const status = String(cw.status || '').toLowerCase();
    if (status === 'active') {
      statusCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${brandGreen}` } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${brandGreenSoft}` } };
    } else if (status) {
      statusCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${brandAmber}` } };
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${brandAmberSoft}` } };
    }

    const verCell = row.getCell(9);
    const ver = String(cw.verification_status || '').toLowerCase();
    if (ver === 'verified') {
      verCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${brandGreen}` } };
    } else if (ver) {
      verCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: `FF${brandAmber}` } };
    }
  });

  // Auto-filter + print setup
  if (sorted.length > 0) {
    facilities.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sorted.length + 1, column: facilityHeaders.length },
    };
  }
  facilities.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  facilities.headerFooter = {
    oddHeader: '&LCYESHA National Registry&RFacility Registry',
    oddFooter: '&LConfidential&CPage &P of &N&R' + generatedAt,
  };

  // Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cyesha-national-report_${stamp()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Load carwashes from API, fall back to empty list */
export async function fetchReportCarwashes(): Promise<ReportCarwash[]> {
  try {
    const res = await fetch('/api/carwashes');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
