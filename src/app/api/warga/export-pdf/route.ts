import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth-helpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================
// Helper: Format currency for PDF (compact)
// ============================================
function fmtRp(amount: number): string {
  if (amount === 0) return '-';
  return new Intl.NumberFormat('id-ID').format(amount);
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
// Helper: Relationship label
// ============================================
const RELATIONSHIP_LABELS: Record<string, string> = {
  KEPALA_KELUARGA: 'Kepala Keluarga',
  SUAMI_ISTRI: 'Suami/Istri',
  ANAK: 'Anak',
  MENANTU: 'Menantu',
  CUCU: 'Cucu',
  ORANG_TUA: 'Orang Tua',
  MERTUA: 'Mertua',
  FAMILI_LAIN: 'Famili Lain',
  PEMBANTU: 'Pembantu',
  LAINNYA: 'Lainnya',
};

// ============================================
// Helper: Gender label
// ====================================
const GENDER_LABELS: Record<string, string> = {
  LAKI_LAKI: 'L',
  PEREMPUAN: 'P',
};

// ============================================
// Helper: Marital status label
// ============================================
const MARITAL_LABELS: Record<string, string> = {
  BELUM_KAWIN: 'Belum Kawin',
  KAWIN: 'Kawin',
  CERAI_HIDUP: 'Cerai Hidup',
  CERAI_MATI: 'Cerai Mati',
};

// ============================================
// Helper: Education label
// ============================================
const EDUCATION_LABELS: Record<string, string> = {
  TIDAK_SEKOLAH: 'Tidak Sekolah',
  SD: 'SD',
  SMP: 'SMP',
  SMA: 'SMA',
  D1: 'D1',
  D2: 'D2',
  D3: 'D3',
  S1: 'S1',
  S2: 'S2',
  S3: 'S3',
};

// ============================================
// Helper: Get Y after last autoTable
// ============================================
function getLastTableY(doc: jsPDF, fallback: number): number {
  const lastTable = (doc as Record<string, Record<string, number>>)['lastAutoTable'];
  return lastTable ? lastTable['finalY'] : fallback;
}

// GET /api/warga/export-pdf
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(authUser.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // =============================================
    // FETCH DATA
    // =============================================

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
        familyMembers: {
          select: {
            id: true,
            fullName: true,
            nik: true,
            gender: true,
            relationship: true,
            maritalStatus: true,
            birthPlace: true,
            birthDate: true,
            education: true,
            citizenship: true,
            occupation: true,
            isFamilyHead: true,
          },
          orderBy: [
            { isFamilyHead: 'desc' },
            { relationship: 'asc' },
            { fullName: 'asc' },
          ],
        },
      },
      orderBy: { familyHead: 'asc' },
    });

    // =============================================
    // GENERATE PDF — A4 portrait, narrow margins, compressed
    // =============================================

    const ML = 10;
    const MR = 10;
    const PW = 210;
    const CW = PW - ML - MR;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    doc.setFont('helvetica');

    const today = new Date().toISOString().split('T')[0];

    // ---- HEADER ----
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('DATA WARGA', PW / 2, 13, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RT Waduk Landung', PW / 2, 18, { align: 'center' });

    // Stats line
    const aktifCount = families.filter(f => f.rondaStatus === 'AKTIF').length;
    const kasepuhanCount = families.filter(f => f.rondaStatus === 'KASEPUHAN').length;
    const bayarIuranCount = families.filter(f => f.rondaStatus === 'BAYAR_IURAN').length;
    const harianCount = families.filter(f => f.jimpitanType === 'HARIAN').length;
    const bulananCount = families.filter(f => f.jimpitanType === 'BULANAN').length;
    const totalMembers = families.reduce((s, f) => s + f.familyMembers.length, 0);

    doc.setFontSize(8.5);
    doc.text(`Total: ${families.length} KK (${totalMembers} jiwa)  |  Harian: ${harianCount}  Bulanan: ${bulananCount}  |  Ronda Aktif: ${aktifCount}  Kasepuhan: ${kasepuhanCount}  Bayar Iuran: ${bayarIuranCount}`, PW / 2, 23, { align: 'center' });

    // Separator line
    doc.setDrawColor(120);
    doc.setLineWidth(0.3);
    doc.line(ML, 26, PW - MR, 26);

    let yPos = 30;

    // ---- SECTION 1: DAFTAR KEPALA KELUARGA ----
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('A. Daftar Kepala Keluarga', ML, yPos);
    yPos += 5;

    const kkTableBody = families.map((f, idx) => [
      String(idx + 1),
      f.familyHead,
      f.address || '-',
      f.jimpitanType === 'HARIAN' ? `Harian (Rp${fmtRp(f.jimpitanAmount)})` : `Bulanan (Rp${fmtRp(f.jimpitanAmount)})`,
      f.rondaStatus === 'AKTIF' ? 'Aktif' : f.rondaStatus === 'KASEPUHAN' ? 'Kasepuhan' : 'Bayar Iuran',
      f.rondaGroup?.name || '-',
      String(f.familyMembers.length),
    ]);

    autoTable(doc, {
      startY: yPos,
      margin: { left: ML, right: MR, bottom: 10 },
      head: [['No', 'Nama KK', 'Alamat', 'Jimpitan', 'Status Ronda', 'Grup Ronda', 'Jml Jiwa']],
      body: kkTableBody,
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
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 35 },
        2: { cellWidth: 48 },
        3: { cellWidth: 32 },
        4: { cellWidth: 24 },
        5: { cellWidth: 28 },
        6: { halign: 'center', cellWidth: 15 },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.row.index < families.length) {
          const status = families[data.row.index]?.rondaStatus;
          if (status === 'KASEPUHAN') {
            data.cell.styles.textColor = [170, 110, 0];
          } else if (status === 'BAYAR_IURAN') {
            data.cell.styles.textColor = [0, 70, 150];
          }
        }
      },
    });

    yPos = getLastTableY(doc, 100) + 8;

    // ---- SECTION 2: DAFTAR ANGGOTA KELUARGA ----
    if (yPos > 230) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('B. Daftar Anggota Keluarga', ML, yPos);
    yPos += 5;

    // Build flat list of all members grouped by family
    const memberRows: (string | number)[][] = [];
    let memberNo = 0;

    for (const family of families) {
      // Family header row
      memberRows.push([
        '', // No - blank for header
        `KK: ${family.familyHead}`,
        family.address || '-',
        '', '', '', '', '', '',
      ]);

      for (const member of family.familyMembers) {
        memberNo++;
        const genderLabel = GENDER_LABELS[member.gender] || member.gender;
        const relLabel = RELATIONSHIP_LABELS[member.relationship] || member.relationship;
        const maritalLabel = member.maritalStatus ? (MARITAL_LABELS[member.maritalStatus] || member.maritalStatus) : '-';
        const eduLabel = member.education ? (EDUCATION_LABELS[member.education] || member.education) : '-';
        const birthInfo = member.birthPlace && member.birthDate
          ? `${member.birthPlace}, ${fmtDateLong(member.birthDate)}`
          : member.birthDate
            ? fmtDateLong(member.birthDate)
            : member.birthPlace || '-';

        memberRows.push([
          String(memberNo),
          member.fullName,
          genderLabel,
          relLabel,
          maritalLabel,
          birthInfo,
          eduLabel,
          member.occupation || '-',
          member.nik || '-',
        ]);
      }
    }

    autoTable(doc, {
      startY: yPos,
      margin: { left: ML, right: MR, bottom: 10 },
      head: [['No', 'Nama Lengkap', 'L/P', 'Hubungan', 'Status Kawin', 'TTL', 'Pendidikan', 'Pekerjaan', 'NIK']],
      body: memberRows as string[][],
      theme: 'grid',
      tableWidth: CW,
      styles: {
        font: 'helvetica',
        fontSize: 6.5,
        cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
        lineColor: [190, 190, 190],
        lineWidth: 0.06,
        overflow: 'ellipsize',
      },
      headStyles: {
        fontSize: 6.5,
        fontStyle: 'bold',
        fillColor: [55, 55, 55],
        textColor: [255, 255, 255],
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 1.5, right: 0.8, bottom: 1.5, left: 0.8 },
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 7 },
        1: { cellWidth: 32 },
        2: { halign: 'center', cellWidth: 8 },
        3: { cellWidth: 20 },
        4: { cellWidth: 16 },
        5: { cellWidth: 32 },
        6: { cellWidth: 17 },
        7: { cellWidth: 22 },
        8: { cellWidth: 26 },
      },
      didParseCell: (data) => {
        // Style family header rows (where column 0 is empty and column 1 starts with "KK:")
        const cell1Val = data.row.raw ? (data.row.raw as string[])[1] : '';
        if (cell1Val && String(cell1Val).startsWith('KK:')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 240, 250];
          data.cell.styles.fontSize = 7;
        }
        // Highlight Kepala Keluarga members
        if (data.column.index === 3 && data.row.index > 0) {
          const cell3Val = data.row.raw ? (data.row.raw as string[])[3] : '';
          if (cell3Val === 'Kepala Keluarga') {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    yPos = getLastTableY(doc, 240) + 8;

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
      doc.text('RT Waduk Landung — Data Warga', ML, 290);
    }

    // ---- OUTPUT COMPRESSED PDF ----
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Data_Warga_RT_Waduk_Landung_${today}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('Export Warga PDF error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
