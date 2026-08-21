import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { RegionStat } from '../components/GeographicDistributionChart';

export type ReportCarwash = {
  id?: string;
  name?: string;
  province?: string;
  district?: string;
  sector?: string;
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
    head: [['Name', 'Province', 'District', 'Sector', 'Contact', 'Phone', 'Registered', 'Status']],
    body: carwashes.map((cw) => [
      cw.name || 'Unnamed',
      cw.province || '—',
      cw.district || '—',
      cw.sector || '—',
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
      0: { cellWidth: 32 },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { cellWidth: 24 },
      5: { cellWidth: 22 },
      6: { cellWidth: 20 },
      7: { cellWidth: 16 },
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

export function exportNationalExcelReport(input: NationalReportInput): void {
  const { stats, carwashes, generatedBy } = input;
  const total = stats.total ?? carwashes.length;

  const summaryRows = [
    ['CYESHA — National Carwash Registry Report'],
    [`Generated`, format(new Date(), 'PPpp')],
    [`Generated by`, generatedBy || '—'],
    [],
    ['SUMMARY METRICS'],
    ['Total Registrations', total],
    ['Verified', stats.verified ?? 0],
    ['Pending Review', stats.unverified ?? 0],
    ['Active Operations', stats.active ?? 0],
  ];

  const facilityRows = carwashes.map((cw) => ({
    Name: cw.name || 'Unnamed',
    Province: cw.province || '',
    District: cw.district || '',
    Sector: cw.sector || '',
    Address: cw.address || '',
    'Contact Person': cw.contact_name || '',
    Phone: cw.phone || '',
    Status: cw.status || '',
    Verification: cw.verification_status || '',
    'Registered Date': displayDate(cw.registration_date || cw.created_at),
    'Updated At': displayDate(cw.updated_at),
  }));

  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const facilitySheet = XLSX.utils.json_to_sheet(facilityRows);
  facilitySheet['!cols'] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
    { wch: 18 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, facilitySheet, 'Facilities');

  XLSX.writeFile(wb, `cyesha-national-report_${stamp()}.xlsx`);
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
