import bcrypt from "bcrypt";
import db from "./database.js";

// ===== FOR DEVELOPMENT PURPOSES ONLY ===== //

/* All Role User Seeder */
const seedUsers = async () => {
  const hashedPassword = await bcrypt.hash("password123", 10);

  const users = [
    {
      nama: "ADMIN",
      username: "admin",
      role: "admin",
    },
    {
      nama: "Guru BK",
      username: "guru_bk",
      role: "guru_bk",
    },
    {
      nama: "Kepala Sekolah",
      username: "kepala_sekolah",
      role: "kepala_sekolah",
    },
    {
      nama: "Absensi",
      username: "absensi",
      role: "absensi",
    },
  ];

  const values = users.map((u) => [u.nama, u.username, hashedPassword, u.role]);

  await db.query(
    `INSERT INTO users (nama, username, password, role)
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
