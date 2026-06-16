import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================
// Helper: Count month boundaries in a period
// ============================================
function countMonthBoundaries(periodeStart: string, periodeEnd: string): number {
  const start = new Date(periodeStart + 'T00:00:00');
  const end = new Date(periodeEnd + 'T00:00:00');
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

// ============================================
// Helper: Format currency for PDF (compact)
// ============================================
function fmtRp(amount: number): string {
  if (amount === 0) return '-';
  return new Intl.NumberFormat('id-ID').format(amount);
}

// ============================================
// Helper: Format short date for PDF
// ============================================
function fmtDateShort(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================
// Helper: Format long date for PDF
// ============================================
function fmtDateLong(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================
// Helper: Get Y after last autoTable
// ============================================
function getLastTableY(doc: jsPDF, fallback: number): number {
  const lastTable = (doc as Record<string, Record<string, number>>)['lastAutoTable'];
  return lastTable ? lastTable['finalY'] : fallback;
}

// GET /api/selapanan/export-pdf?selapananId=xxx
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const selapananId = searchParams.get('selapananId');

    if (!selapananId) {
      return NextResponse.json({ error: 'selapananId wajib diisi' }, { status: 400 });
    }

    // =============================================
    // FETCH DATA
    // =============================================

    const selapanan = await db.selapanan.findUnique({ where: { id: selapananId } });
    if (!selapanan) return NextResponse.json({ error: 'Selapanan tidak ditemukan' }, { status: 404 });

    // Fetch all active families
    const families = await db.family.findMany({
      where: { isActive: true },
      select: {
        id: true,
        familyHead: true,
        address: true,
        jimpitanType: true,
        jimpitanAmount: true,
        rondaStatus: true,
        rondaFee: true,
        rondaGroupId: true,
        rondaGroup: { select: { id: true, name: true, dayOfWeek: true } },
      },
      orderBy: { familyHead: 'asc' },
    });

    // Fetch previous unpaid shortages
    const prevShortages = await db.jimpitanShortage.findMany({
      where: {
        isSettled: false,
        selapanan: {
          periodeEnd: { lt: selapanan.periodeStart },
          status: { not: 'CANCELLED' },
        },
      },
      include: {
        family: { select: { id: true, familyHead: true } },
        selapanan: { select: { number: true } },
      },
    });

    const prevShortageMap = new Map<string, { remaining: number; fromSelapanan: number }>();
    for (const s of prevShortages) {
      const existing = prevShortageMap.get(s.familyId);
      const remaining = s.totalShortage - s.settledAmount;
      if (existing) {
        existing.remaining += remaining;
      } else {
        prevShortageMap.set(s.familyId, { remaining, fromSelapanan: s.selapanan.number });
      }
    }

    // Calculate days elapsed
    const today = new Date().toISOString().split('T')[0];
    const startDate = new Date(selapanan.periodeStart + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diffDays = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.min(35, Math.max(1, diffDays + 1));

    // Get total paid per family from JimpitanLog
    const currentLogs = await db.jimpitanLog.findMany({
      where: { selapananId, family: { jimpitanType: 'HARIAN' } },
      select: { familyId: true, paidAmount: true },
    });

    const paidMap = new Map<string, number>();
    for (const log of currentLogs) {
      const existing = paidMap.get(log.familyId) || 0;
      paidMap.set(log.familyId, existing + log.paidAmount);
    }

    // Get jimpitan amount from settings
    const jimpitanSetting = await db.settings.findUnique({ where: { key: 'jimpitan_amount' } });
    const jimpitanAmount = jimpitanSetting ? parseInt(jimpitanSetting.value, 10) || 1000 : 1000;

    // Get existing tarikan records
    const existingTarikan = await db.selapananTarikan.findMany({
      where: { selapananId },
      include: { family: { select: { familyHead: true } } },
      orderBy: { family: { familyHead: 'asc' } },
    });
    const existingTarikanMap = new Map(existingTarikan.map(t => [t.familyId, t]));

    const monthsSpanned = countMonthBoundaries(selapanan.periodeStart, selapanan.periodeEnd);

    // Build tarikan records
    const tarikanRecords: {
      familyHead: string; jimpitanType: string; rondaStatus: string; rondaGroup: string;
      sisaTarikan: number; kuranganJimpitan: number; iuranBulanan: number; iuranRonda: number;
      totalHarusBayar: number; jumlahBayar: number; sisaDepan: number;
      prevFromSelapanan: number | null;
    }[] = [];

    for (const family of families) {
      const sisaTarikan = prevShortageMap.get(family.id)?.remaining || 0;
      const totalPaid = paidMap.get(family.id) || 0;
      const kuranganJimpitan = family.jimpitanType === 'HARIAN' ? Math.max(0, (elapsedDays * jimpitanAmount) - totalPaid) : 0;
      const iuranBulanan = family.jimpitanType === 'BULANAN' ? family.jimpitanAmount * monthsSpanned : 0;
      const iuranRonda = family.rondaStatus === 'BAYAR_IURAN' ? family.rondaFee : 0;

      const existing = existingTarikanMap.get(family.id);
      const sisaFromPrev = existing ? existing.sisaTarikan : sisaTarikan;
      const iuranBln = existing ? existing.iuranBulanan : iuranBulanan;
      const iuranRnd = existing ? existing.iuranRonda : iuranRonda;
      const jumlahBayar = existing ? existing.jumlahBayar : 0;
      const totalHarusBayar = sisaFromPrev + kuranganJimpitan + iuranBln + iuranRnd;
      const sisaDepan = totalHarusBayar - jumlahBayar;

      tarikanRecords.push({
        familyHead: family.familyHead,
        jimpitanType: family.jimpitanType,
        rondaStatus: family.rondaStatus,
        rondaGroup: family.rondaGroup?.name || '-',
        sisaTarikan: sisaFromPrev,
        kuranganJimpitan,
        iuranBulanan: iuranBln,
        iuranRonda: iuranRnd,
        totalHarusBayar,
        jumlahBayar,
        sisaDepan,
        prevFromSelapanan: prevShortageMap.get(family.id)?.fromSelapanan || null,
      });
    }

    // Fetch jimpitan daily data for weekly recap
    const jimpitanLogs = await db.jimpitanLog.findMany({
      where: { selapananId },
      select: {
        date: true,
        paidAmount: true,
        shortage: true,
        expectedAmount: true,
      },
    });

    // Group jimpitan logs by week
    const periodStart = new Date(selapanan.periodeStart + 'T00:00:00');
    const weeklyData: { weekNum: number; startDate: string; endDate: string; days: number; expected: number; paid: number; shortage: number }[] = [];

    for (let w = 0; w < 5; w++) {
      const weekStart = new Date(periodStart);
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekStartStr = weekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const weekLogs = jimpitanLogs.filter(l => l.date >= weekStartStr && l.date <= weekEndStr);
      const uniqueDays = new Set(weekLogs.map(l => l.date)).size;
      const harianFamilies = families.filter(f => f.jimpitanType === 'HARIAN').length;
      const expected = uniqueDays * jimpitanAmount * harianFamilies;
      const paid = weekLogs.reduce((s, l) => s + l.paidAmount, 0);
      const shortage = weekLogs.reduce((s, l) => s + l.shortage, 0);

      if (uniqueDays > 0) {
        weeklyData.push({
          weekNum: w + 1,
          startDate: weekStartStr,
          endDate: weekEndStr > selapanan.periodeEnd ? selapanan.periodeEnd : weekEndStr,
          days: uniqueDays,
          expected,
          paid,
          shortage,
        });
      }
    }

    // =============================================
    // GENERATE PDF — A4 portrait, narrow margins, compressed
    // =============================================

    const ML = 10; // margin left
    const MR = 10; // margin right
    const PW = 210; // page width A4
    const CW = PW - ML - MR; // content width = 190mm

    // Create doc with compression enabled
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    doc.setFont('helvetica');

    // ---- HEADER ----
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('REKAPITULASI SELAPANAN', PW / 2, 13, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RT Waduk Landung', PW / 2, 18, { align: 'center' });

    doc.setFontSize(8.5);
    doc.text(`Selapanan Ke-${selapanan.number}  |  Periode: ${fmtDateShort(selapanan.periodeStart)} — ${fmtDateShort(selapanan.periodeEnd)}`, PW / 2, 23, { align: 'center' });
    doc.text(`Hari ke-${elapsedDays}/35  |  Rapat: ${fmtDateLong(selapanan.meetingDate)}`, PW / 2, 27, { align: 'center' });

    // Separator line
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.line(ML, 30, PW - MR, 30);

    let yPos = 34;

    // ---- SECTION 1: TARIKAN WARGA ----
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('A. Rekap Tarikan Warga', ML, yPos);
    yPos += 1.5;

    // Summary line
    const totalHarusBayar = tarikanRecords.reduce((s, t) => s + t.totalHarusBayar, 0);
    const totalSudahBayar = tarikanRecords.reduce((s, t) => s + t.jumlahBayar, 0);
    const totalSisaDepan = tarikanRecords.reduce((s, t) => s + t.sisaDepan, 0);
    const totalSisaTarikan = tarikanRecords.reduce((s, t) => s + t.sisaTarikan, 0);
    const totalKuranganJimpitan = tarikanRecords.reduce((s, t) => s + t.kuranganJimpitan, 0);
    const totalIuranBulanan = tarikanRecords.reduce((s, t) => s + t.iuranBulanan, 0);
    const totalIuranRonda = tarikanRecords.reduce((s, t) => s + t.iuranRonda, 0);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Harus Bayar: Rp${fmtRp(totalHarusBayar)}  |  Sudah Bayar: Rp${fmtRp(totalSudahBayar)}  |  Sisa: Rp${fmtRp(totalSisaDepan)}`, ML, yPos + 3.5);
    yPos += 6;

    // Tarikan table — column widths sum to CW (190mm) so table fills the page
    // No=8, Nama=40, Sisa=20, Jimpitan=20, Bulanan=19, Ronda=18, Total=24, Bayar=21, SisaD=20 = 190mm
    const tarikanTableBody = tarikanRecords.map((t, idx) => [
      String(idx + 1),
      t.familyHead,
      t.sisaTarikan > 0 ? fmtRp(t.sisaTarikan) : '-',
      t.jimpitanType === 'HARIAN' ? (t.kuranganJimpitan > 0 ? fmtRp(t.kuranganJimpitan) : 'Lunas') : '-',
      t.iuranBulanan > 0 ? fmtRp(t.iuranBulanan) : '-',
      t.iuranRonda > 0 ? fmtRp(t.iuranRonda) : '-',
      fmtRp(t.totalHarusBayar),
      t.jumlahBayar > 0 ? fmtRp(t.jumlahBayar) : '-',
      t.sisaDepan > 0 ? fmtRp(t.sisaDepan) : 'Lunas',
    ]);

    // Totals row
    tarikanTableBody.push([
      '',
      'TOTAL',
      totalSisaTarikan > 0 ? fmtRp(totalSisaTarikan) : '-',
      totalKuranganJimpitan > 0 ? fmtRp(totalKuranganJimpitan) : '-',
      totalIuranBulanan > 0 ? fmtRp(totalIuranBulanan) : '-',
      totalIuranRonda > 0 ? fmtRp(totalIuranRonda) : '-',
      fmtRp(totalHarusBayar),
      totalSudahBayar > 0 ? fmtRp(totalSudahBayar) : '-',
      totalSisaDepan > 0 ? fmtRp(totalSisaDepan) : 'Lunas',
    ]);

    autoTable(doc, {
      startY: yPos,
      margin: { left: ML, right: MR, bottom: 10 },
      head: [[
        'No', 'Nama KK', 'Sisa', 'Jimpitan', 'Iuran\nBulanan', 'Iuran\nRonda', 'Total\nBayar', 'Sudah\nBayar', 'Sisa\nDepan'
      ]],
      body: tarikanTableBody,
      theme: 'grid',
      tableWidth: CW,
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 },
        lineColor: [190, 190, 190],
        lineWidth: 0.08,
        overflow: 'ellipsize',
      },
      headStyles: {
        fontSize: 7,
        fontStyle: 'bold',
        fillColor: [55, 55, 55],
        textColor: [255, 255, 255],
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 2, right: 1, bottom: 2, left: 1 },
      },
      bodyStyles: {
        fontSize: 7.5,
        valign: 'middle',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 19 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 24 },
        7: { halign: 'right', cellWidth: 21 },
        8: { halign: 'right', cellWidth: 20 },
      },
      didParseCell: (data) => {
        if (data.row.index === tarikanRecords.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [235, 235, 235];
        }
        if (data.column.index === 8 && data.row.index < tarikanRecords.length) {
          const val = tarikanRecords[data.row.index]?.sisaDepan;
          data.cell.styles.textColor = val > 0 ? [190, 0, 0] : [0, 120, 0];
        }
        if (data.column.index === 3 && data.row.index < tarikanRecords.length) {
          const rec = tarikanRecords[data.row.index];
          if (rec?.kuranganJimpitan === 0 && rec?.jimpitanType === 'HARIAN') {
            data.cell.styles.textColor = [0, 120, 0];
          }
        }
      },
    });

    yPos = getLastTableY(doc, 110) + 6;

    // ---- SECTION 2: REKAP MINGGUAN JIMPITAN ----
    if (yPos > 235) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('B. Rekap Mingguan Jimpitan Harian', ML, yPos);
    yPos += 1.5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const harianCount = families.filter(f => f.jimpitanType === 'HARIAN').length;
    doc.text(`Besaran: Rp${fmtRp(jimpitanAmount)}/hari  |  ${harianCount} KK Harian`, ML, yPos + 3);
    yPos += 5.5;

    const weeklyTableBody = weeklyData.map(w => [
      String(w.weekNum),
      `${fmtDateShort(w.startDate)} — ${fmtDateShort(w.endDate)}`,
      String(w.days),
      fmtRp(w.expected),
      fmtRp(w.paid),
      w.shortage > 0 ? fmtRp(w.shortage) : 'Lunas',
      w.expected > 0 ? `${Math.round((w.paid / w.expected) * 100)}%` : '-',
    ]);

    const totalWeekExpected = weeklyData.reduce((s, w) => s + w.expected, 0);
    const totalWeekPaid = weeklyData.reduce((s, w) => s + w.paid, 0);
    const totalWeekShortage = weeklyData.reduce((s, w) => s + w.shortage, 0);
    weeklyTableBody.push([
      '', 'TOTAL 35 HARI', String(weeklyData.reduce((s, w) => s + w.days, 0)),
      fmtRp(totalWeekExpected), fmtRp(totalWeekPaid),
      totalWeekShortage > 0 ? fmtRp(totalWeekShortage) : 'Lunas',
      totalWeekExpected > 0 ? `${Math.round((totalWeekPaid / totalWeekExpected) * 100)}%` : '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      margin: { left: ML, right: MR, bottom: 10 },
      head: [['Minggu', 'Tanggal', 'Hari', 'Target', 'Terkumpul', 'Kurangan', '%']],
      body: weeklyTableBody,
      theme: 'grid',
      tableWidth: CW,
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
        lineColor: [190, 190, 190],
        lineWidth: 0.08,
        overflow: 'ellipsize',
      },
      headStyles: {
        fontSize: 8,
        fontStyle: 'bold',
        fillColor: [55, 55, 55],
        textColor: [255, 255, 255],
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 2, right: 1, bottom: 2, left: 1 },
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 17 },
        1: { cellWidth: 62 },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 26 },
        6: { halign: 'center', cellWidth: 14 },
      },
      didParseCell: (data) => {
        if (data.row.index === weeklyData.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [235, 235, 235];
        }
      },
    });

    yPos = getLastTableY(doc, 155) + 6;

    // ---- FOOTER: SIGNATURE AREA ----
    if (yPos > 242) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Dicetak: ${fmtDateLong(today)}, ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`, ML, yPos);

    // Signature area
    yPos += 12;
    const signY = yPos;

    doc.setTextColor(0);
    doc.setFontSize(8.5);
    doc.text('Ketua RT', ML + 14, signY);
    doc.text('Sekretaris', ML + 64, signY);
    doc.text('Bendahara', ML + 114, signY);

    doc.setLineWidth(0.15);
    doc.line(ML + 4, signY + 18, ML + 44, signY + 18);
    doc.line(ML + 54, signY + 18, ML + 94, signY + 18);
    doc.line(ML + 104, signY + 18, ML + 144, signY + 18);

    doc.setFontSize(7.5);
    doc.text('( ...................... )', ML + 10, signY + 23);
    doc.text('( ...................... )', ML + 60, signY + 23);
    doc.text('( ...................... )', ML + 110, signY + 23);

    // ---- PAGE NUMBERS ----
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160);
      doc.text(`Halaman ${i} / ${totalPages}`, PW / 2, 290, { align: 'center' });
      doc.text('RT Waduk Landung — Rekapitulasi Selapanan', ML, 290);
    }

    // ---- OUTPUT COMPRESSED PDF ----
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rekap_Selapanan_${selapanan.number}_${today}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('Export PDF error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
