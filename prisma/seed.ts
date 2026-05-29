import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const db = new PrismaClient();

async function main() {
  // Create admin user (Ketua RT)
  const adminPassword = hashPassword('admin123');

  const existingAdmin = await db.user.findUnique({ where: { username: 'admin' } });

  if (!existingAdmin) {
    await db.user.create({
      data: {
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
  } else {
    console.log('ℹ️ Admin user already exists');
  }

  // Create some ronda groups
  const existingGroups = await db.rondaGroup.count();
  if (existingGroups === 0) {
    await db.rondaGroup.createMany({
      data: [
        { name: 'Grup 1', description: 'Blok A sisi utara' },
        { name: 'Grup 2', description: 'Blok A sisi selatan' },
        { name: 'Grup 3', description: 'Blok B sisi utara' },
        { name: 'Grup 4', description: 'Blok B sisi selatan' },
      ],
    });
    console.log('✅ Ronda groups created');
  }

  // Create sample families
  const existingFamilies = await db.family.count();
  if (existingFamilies === 0) {
    await db.family.createMany({
      data: [
        { familyHead: 'Budi Santoso', address: 'Jl. Melati No. 1', memberCount: 4, rondaGroup: 'Grup 1' },
        { familyHead: 'Ahmad Hidayat', address: 'Jl. Melati No. 2', memberCount: 5, rondaGroup: 'Grup 1' },
        { familyHead: 'Siti Rahayu', address: 'Jl. Mawar No. 3', memberCount: 3, rondaGroup: 'Grup 2' },
        { familyHead: 'Dewi Lestari', address: 'Jl. Mawar No. 4', memberCount: 4, rondaGroup: 'Grup 2' },
        { familyHead: 'Eko Prasetyo', address: 'Jl. Dahlia No. 5', memberCount: 6, rondaGroup: 'Grup 3' },
        { familyHead: 'Rina Wulandari', address: 'Jl. Dahlia No. 6', memberCount: 3, rondaGroup: 'Grup 3' },
        { familyHead: 'Hendra Gunawan', address: 'Jl. Anggrek No. 7', memberCount: 4, rondaGroup: 'Grup 4' },
        { familyHead: 'Maya Sari', address: 'Jl. Anggrek No. 8', memberCount: 2, rondaGroup: 'Grup 4' },
      ],
    });
    console.log('✅ Sample families created');
  }

  // Create sample inventory
  const existingInventory = await db.inventory.count();
  if (existingInventory === 0) {
    await db.inventory.createMany({
      data: [
        { name: 'Kentongan', quantity: 2, condition: 'BAIK', location: 'Pos Ronda 1', notes: 'Untuk ronda malam' },
        { name: 'Senter', quantity: 4, condition: 'BAIK', location: 'Pos Ronda 1', notes: '' },
        { name: 'Peluit', quantity: 3, condition: 'BAIK', location: 'Pos Ronda 2', notes: '' },
        { name: 'Kursi Lipat', quantity: 20, condition: 'BAIK', location: 'Balai RT', notes: 'Untuk rapat' },
        { name: 'Meja Lipat', quantity: 5, condition: 'RUSAK_RINGAN', location: 'Balai RT', notes: '1 meja kaki longgar' },
        { name: 'Sound System', quantity: 1, condition: 'BAIK', location: 'Balai RT', notes: '' },
      ],
    });
    console.log('✅ Sample inventory created');
  }

  // Create sample announcement
  const existingAnnouncements = await db.announcement.count();
  if (existingAnnouncements === 0) {
    await db.announcement.createMany({
      data: [
        {
          title: 'Selapanan Bulan Ini',
          content: 'Diberitahukan kepada seluruh warga bahwa selapanan bulan ini akan dilaksanakan pada hari Sabtu malam Minggu Pon. Harap semua warga hadir tepat waktu.',
          isPinned: true,
          isActive: true,
          createdBy: 'admin',
        },
        {
          title: 'Jadwal Ronda Update',
          content: 'Jadwal ronda untuk bulan ini telah diperbarui. Silakan cek halaman Ronda untuk jadwal terbaru.',
          isPinned: false,
          isActive: true,
          createdBy: 'admin',
        },
        {
          title: 'Iuran Bulanan',
          content: 'Diharapkan seluruh warga membayar iuran bulanan tepat waktu. Iuran dapat dibayar melalui bendahara RT.',
          isPinned: false,
          isActive: true,
          createdBy: 'admin',
        },
      ],
    });
    console.log('✅ Sample announcements created');
  }

  console.log('\n🎉 Seed completed!');
  console.log('Login credentials: username=admin, password=admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
