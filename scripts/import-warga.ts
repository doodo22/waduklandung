import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';
import * as XLSX from 'xlsx';
import * as path from 'path';

const db = new PrismaClient();

interface WargaRow {
  nama: string;
  username: string;
  password: string;
  alamat: string;
  tipeJimpitan: string;
  jumlahJimpitan: number | null;
  statusRonda: string;
  iuranRonda: number | null;
}

function readExcel(filePath: string): WargaRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  return rows.map((row) => ({
    nama: String(row['Nama'] || '').trim(),
    username: String(row['Username'] || '').trim(),
    password: String(row['password'] || '123456').trim(),
    alamat: String(row['alamat'] || '').trim(),
    tipeJimpitan: String(row['tipe jimpitan'] || 'harian').trim().toUpperCase(),
    jumlahJimpitan: row['Jumlah jimpitan'] ? Number(row['Jumlah jimpitan']) : null,
    statusRonda: String(row['status ronda'] || 'Aktif Ronda').trim(),
    iuranRonda: row['iuran ronda'] ? Number(row['iuran ronda']) : null,
  }));
}

function mapRondaStatus(status: string): string {
  const s = status.toLowerCase().trim();
  if (s.includes('aktif')) return 'AKTIF';
  if (s.includes('kasepuhan')) return 'KASEPUHAN';
  if (s.includes('bayar') || s.includes('iuran')) return 'BAYAR_IURAN';
  return 'AKTIF';
}

function mapJimpitanType(type: string): string {
  const t = type.toLowerCase().trim();
  if (t.includes('bulanan')) return 'BULANAN';
  return 'HARIAN';
}

async function main() {
  console.log('🚀 Starting warga import...\n');

  // 1. Read Excel data
  const excelPath = path.join(__dirname, '..', 'upload', 'user.xlsx');
  const wargaList = readExcel(excelPath);
  console.log(`📋 Read ${wargaList.length} warga from Excel\n`);

  // 2. Delete existing warga data (in correct order to respect foreign keys)
  console.log('🗑️  Removing old warga data...');

  // Delete dependent records first
  await db.customLevyPayment.deleteMany();
  await db.customLevyItem.deleteMany();
  await db.customLevy.deleteMany();
  await db.jimpitanShortage.deleteMany();
  await db.jimpitanLog.deleteMany();
  await db.jimpitanEnrollment.deleteMany();
  await db.rondaLog.deleteMany();
  await db.rondaSchedule.deleteMany({ where: { selapananId: { not: null } } });
  await db.fine.deleteMany();
  await db.letter.deleteMany();
  await db.familyMember.deleteMany();

  // Delete warga users (keep admin)
  const adminUser = await db.user.findFirst({ where: { role: 'KETUA_RT' } });
  if (adminUser) {
    await db.user.deleteMany({ where: { role: 'WARGA' } });
    await db.user.deleteMany({ where: { role: 'PENGURUS' } });
    await db.user.deleteMany({ where: { role: 'SEKRETARIS' } });
    await db.user.deleteMany({ where: { role: 'BENDAHARA' } });
  } else {
    // Keep first user as admin fallback
    const allUsers = await db.user.findMany({ orderBy: { createdAt: 'asc' } });
    if (allUsers.length > 0) {
      await db.user.deleteMany({ where: { id: { not: allUsers[0].id } } });
    }
  }

  // Delete all families
  await db.family.deleteMany();

  console.log('✅ Old data removed\n');

  // 3. Get ronda groups for assignment
  const rondaGroups = await db.rondaGroup.findMany({ orderBy: { dayOfWeek: 'asc' } });
  console.log(`📌 Found ${rondaGroups.length} ronda groups\n`);

  // 4. Separate aktif ronda members (they get assigned to groups)
  const aktifMembers = wargaList.filter(w => mapRondaStatus(w.statusRonda) === 'AKTIF');
  const nonAktifMembers = wargaList.filter(w => mapRondaStatus(w.statusRonda) !== 'AKTIF');

  console.log(`👥 Aktif Ronda: ${aktifMembers.length}`);
  console.log(`👥 Non-Aktif (Kasepuhan/Bayar Iuran): ${nonAktifMembers.length}\n`);

  // 5. Create Family + User for each warga
  console.log('📝 Creating families and users...');
  let created = 0;

  for (let i = 0; i < wargaList.length; i++) {
    const w = wargaList[i];
    const rondaStatus = mapRondaStatus(w.statusRonda);
    const jimpitanType = mapJimpitanType(w.tipeJimpitan);
    const jimpitanAmount = jimpitanType === 'HARIAN'
      ? 1000
      : (w.jumlahJimpitan || 30000);
    const rondaFee = rondaStatus === 'BAYAR_IURAN'
      ? (w.iuranRonda || 5000)
      : 0;

    // Determine ronda group assignment for AKTIF members
    let rondaGroupId: string | null = null;
    if (rondaStatus === 'AKTIF') {
      const aktifIndex = aktifMembers.indexOf(w);
      const groupIndex = aktifIndex % rondaGroups.length;
      rondaGroupId = rondaGroups[groupIndex].id;
    }

    // Create Family
    const family = await db.family.create({
      data: {
        familyHead: w.nama,
        address: w.alamat,
        jimpitanType: jimpitanType,
        jimpitanAmount: jimpitanAmount,
        rondaStatus: rondaStatus,
        rondaFee: rondaFee,
        isActive: true,
        rondaGroupId: rondaGroupId,
      },
    });

    // Hash password
    const hashedPassword = hashPassword(w.password);

    // Create User linked to Family
    await db.user.create({
      data: {
        username: w.username,
        password: hashedPassword,
        name: w.nama,
        role: 'WARGA',
        status: 'ACTIVE',
        address: w.alamat,
        familyId: family.id,
      },
    });

    // Create JimpitanEnrollment for all families
    await db.jimpitanEnrollment.create({
      data: {
        familyId: family.id,
        isActive: true,
      },
    });

    created++;
    if (created % 10 === 0) {
      console.log(`   ${created}/${wargaList.length} created...`);
    }
  }

  console.log(`\n✅ Successfully created ${created} families & users\n`);

  // 6. Summary
  const families = await db.family.findMany();
  const aktifCount = families.filter(f => f.rondaStatus === 'AKTIF').length;
  const kasepuhanCount = families.filter(f => f.rondaStatus === 'KASEPUHAN').length;
  const bayarIuranCount = families.filter(f => f.rondaStatus === 'BAYAR_IURAN').length;
  const harianCount = families.filter(f => f.jimpitanType === 'HARIAN').length;
  const bulananCount = families.filter(f => f.jimpitanType === 'BULANAN').length;

  // Show group distribution
  console.log('📊 Ronda Group Distribution:');
  for (const group of rondaGroups) {
    const count = families.filter(f => f.rondaGroupId === group.id).length;
    console.log(`   ${group.name}: ${count} KK`);
  }

  console.log('\n📊 Summary:');
  console.log(`   Total KK: ${families.length}`);
  console.log(`   Aktif Ronda: ${aktifCount}`);
  console.log(`   Kasepuhan: ${kasepuhanCount}`);
  console.log(`   Bayar Iuran: ${bayarIuranCount}`);
  console.log(`   Jimpitan Harian: ${harianCount} (Rp.1.000/malam)`);
  console.log(`   Jimpitan Bulanan: ${bulananCount}`);

  console.log('\n🎉 Import completed!');
  console.log('👤 Admin login: username=admin, password=admin123');
  console.log('👤 Warga login: username=WL001..WL069, password=123456');
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
