import bcrypt from "bcrypt";
import db from "./database.js";

// ===== FOR DEVELOPMENT PURPOSES ONLY ===== //

/* All Role User Seeder */
const seedUsers = async () => {
  const hashedPassword = await bcrypt.hash("password123", 10);

  const users = [
    {
      nama: "ADMIN",
      nip: "13245678",
      role: "admin",
    },
    {
      nama: "Guru BK",
      nip: "13245679",
      role: "guru_bk",
    },
    {
      nama: "Kepala Sekolah",
      nip: "13245670",
      role: "kepala_sekolah",
    },
    {
      nama: "Absensi",
      nip: "13245671",
      role: "absensi",
    },
  ];

  const values = users.map((u) => [u.nama, u.nip, hashedPassword, u.role]);

  await db.query(
    `INSERT INTO users (nama, nip, password, role)
     VALUES ?`,
    [values],
  );

  console.log("Users seeded successfully");
};

const runSeed = async () => {
  try {
    await seedUsers();
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

runSeed();
