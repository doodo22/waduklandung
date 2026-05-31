import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const db = new PrismaClient();

// Nama hari untuk ronda: 0=Minggu, 1=Senin, ..., 6=Sabtu
// Malam Minggu = Sabtu malam (hari Minggu = dayOfWeek 0)
// Malam Senin = Minggu malam (hari Senin = dayOfWeek 1)
const RONDA_GROUPS = [
  { name: 'Grup 1 - Malam Minggu', dayOfWeek: 0, description: 'Jaga malam Minggu (Sabtu malam)' },
  { name: 'Grup 2 - Malam Senin', dayOfWeek: 1, description: 'Jaga malam Senin (Minggu malam)' },
  { name: 'Grup 3 - Malam Selasa', dayOfWeek: 2, description: 'Jaga malam Selasa (Senin malam)' },
  { name: 'Grup 4 - Malam Rabu', dayOfWeek: 3, description: 'Jaga malam Rabu (Selasa malam)' },
  { name: 'Grup 5 - Malam Kamis', dayOfWeek: 4, description: 'Jaga malam Kamis (Rabu malam)' },
  { name: 'Grup 6 - Malam Jumat', dayOfWeek: 5, description: 'Jaga malam Jumat (Kamis malam)' },
  { name: 'Grup 7 - Malam Sabtu', dayOfWeek: 6, description: 'Jaga malam Sabtu (Jumat malam)' },
];

const DEFAULT_SETTINGS = [
  { key: 'jimpitan_amount', value: '1000', description: 'Besaran jimpitan harian per KK (Rp)' },
  { key: 'rt_name', value: 'RT 01/RW 01', description: 'Nama RT' },
  { key: 'rt_address', value: '', description: 'Alamat RT' },
  { key: 'ketua_rt_name', value: '', description: 'Nama Ketua RT' },
];

const SAMPLE_FAMILIES = [
  { familyHead: 'Budi Santoso', address: 'Jl. Melati No. 1', memberCount: 4 },
  { familyHead: 'Ahmad Hidayat', address: 'Jl. Melati No. 2', memberCount: 5 },
  { familyHead: 'Siti Rahayu', address: 'Jl. Mawar No. 3', memberCount: 3 },
  { familyHead: 'Dewi Lestari', address: 'Jl. Mawar No. 4', memberCount: 4 },
  { familyHead: 'Eko Prasetyo', address: 'Jl. Dahlia No. 5', memberCount: 6 },
  { familyHead: 'Rina Wulandari', address: 'Jl. Dahlia No. 6', memberCount: 3 },
  { familyHead: 'Hendra Gunawan', address: 'Jl. Anggrek No. 7', memberCount: 4 },
  { familyHead: 'Maya Sari', address: 'Jl. Anggrek No. 8', memberCount: 2 },
];

const SAMPLE_INVENTORY = [
  { name: 'Kentongan', quantity: 2, condition: 'BAIK', location: 'Pos Ronda 1', notes: 'Untuk ronda malam' },
  { name: 'Senter', quantity: 4, condition: 'BAIK', location: 'Pos Ronda 1', notes: '' },
  { name: 'Peluit', quantity: 3, condition: 'BAIK', location: 'Pos Ronda 2', notes: '' },
  { name: 'Kursi Lipat', quantity: 20, condition: 'BAIK', location: 'Balai RT', notes: 'Untuk rapat' },
  { name: 'Meja Lipat', quantity: 5, condition: 'RUSAK_RINGAN', location: 'Balai RT', notes: '1 meja kaki longgar' },
  { name: 'Sound System', quantity: 1, condition: 'BAIK', location: 'Balai RT', notes: '' },
];

const SAMPLE_ANNOUNCEMENTS = [
  {
    title: 'Selapanan Bulan Ini',
    content: 'Diberitahukan kepada seluruh warga bahwa selapanan bulan ini akan dilaksanakan pada hari Sabtu malam Minggu Pon. Harap semua warga hadir tepat waktu.',
    isPinned: true,
    isActive: true,
  },
  {
    title: 'Jadwal Ronda Update',
    content: 'Jadwal ronda untuk bulan ini telah diperbarui. Silakan cek halaman Ronda untuk jadwal terbaru.',
    isPinned: false,
    isActive: true,
  },
  {
    title: 'Iuran Bulanan',
    content: 'Diharapkan seluruh warga membayar iuran bulanan tepat waktu. Iuran dapat dibayar melalui bendahara RT.',
    isPinned: false,
    isActive: true,
  },
];

async function main() {
  // 1. Create admin user
  const adminPassword = hashPassword('admin123');
  const admin = await db.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: 'Ketua RT',
      role: 'KETUA_RT',
      status: 'ACTIVE',
      phone: '08123456789',
      address: 'RT 01/RW 01',
    },
  });
  console.log('✅ Admin user created (username: admin, password: admin123)');

  // 2. Create 7 ronda groups
  const existingGroups = await db.rondaGroup.count();
  if (existingGroups === 0) {
    for (const g of RONDA_GROUPS) {
      await db.rondaGroup.create({ data: g });
    }
    console.log('✅ 7 Ronda groups created');
  }

  // 3. Create sample families and assign to groups
  const existingFamilies = await db.family.count();
  if (existingFamilies === 0) {
    const groups = await db.rondaGroup.findMany({ orderBy: { dayOfWeek: 'asc' } });
    for (let i = 0; i < SAMPLE_FAMILIES.length; i++) {
      const f = SAMPLE_FAMILIES[i];
      const groupIndex = i % groups.length;
      await db.family.create({
        data: {
          familyHead: f.familyHead,
          address: f.address,
          memberCount: f.memberCount,
          rondaGroupId: groups[groupIndex].id,
        },
      });
    }
    console.log('✅ Sample families created & assigned to ronda groups');

    // 4. Enroll some families in jimpitan (all except the last 2)
    const families = await db.family.findMany({ orderBy: { familyHead: 'asc' } });
    for (let i = 0; i < families.length - 2; i++) {
      await db.jimpitanEnrollment.create({
        data: { familyId: families[i].id, isActive: true },
      });
    }
    console.log('✅ Sample jimpitan enrollments created');
  }

  // 5. Create settings
  const existingSettings = await db.settings.count();
  if (existingSettings === 0) {
    for (const s of DEFAULT_SETTINGS) {
      await db.settings.create({ data: s });
    }
    console.log('✅ Default settings created (jimpitan_amount=1000)');
  }

  // 6. Create sample inventory
  const existingInventory = await db.inventory.count();
  if (existingInventory === 0) {
    await db.inventory.createMany({ data: SAMPLE_INVENTORY });
    console.log('✅ Sample inventory created');
  }

  // 7. Create sample announcements (with admin as author)
  const existingAnnouncements = await db.announcement.count();
  if (existingAnnouncements === 0) {
    for (const a of SAMPLE_ANNOUNCEMENTS) {
      await db.announcement.create({
        data: { ...a, createdBy: admin.id },
      });
    }
    console.log('✅ Sample announcements created');
  }

  console.log('\n🎉 Seed completed!');
  console.log('Login: username=admin, password=admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
