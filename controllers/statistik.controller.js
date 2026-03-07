import db from "../lib/database.js";

/* Statistics Summary */
export const getAllStatistics = async (req, res) => {
  try {
    const { id_tahun_ajaran } = req.query;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "id_tahun_ajaran is required" });
    }

    // [1] Total Siswa
    const [totalSiswa] = await db.query(
      `SELECT COUNT(*) AS total_siswa
       FROM siswa
       WHERE id_tahun_ajaran = ?`,
      [id_tahun_ajaran],
    );

    // [2] Hadir Hari Ini
    const [hadirHariIni] = await db.query(
      `SELECT COUNT(DISTINCT id_siswa) AS hadir_hari_ini
       FROM absensi
       WHERE DATE(created_at) = CURDATE()
       AND id_tahun_ajaran = ?`,
      [id_tahun_ajaran],
    );

    // [3] Terlambat Hari Ini (dynamic from config)
    const [terlambatHariIni] = await db.query(
      `SELECT COUNT(*) AS terlambat_hari_ini
       FROM absensi
       WHERE DATE(created_at) = CURDATE()
       AND id_tahun_ajaran = ?
       AND TIME(created_at) > (
         SELECT config_value
         FROM config
         WHERE config_key = 'maks_waktu_terlambat'
         LIMIT 1
       )`,
      [id_tahun_ajaran],
    );

    // [4] Rata-rata Kedatangan
    const [rataRata] = await db.query(
      `SELECT IFNULL(
          SEC_TO_TIME(AVG(TIME_TO_SEC(TIME(created_at)))),
          '00:00:00'
        ) AS rata_rata_kedatangan
       FROM absensi
       WHERE DATE(created_at) = CURDATE()
       AND id_tahun_ajaran = ?`,
      [id_tahun_ajaran],
    );

    // [5] Attendance ratio (0–1)
    const total = totalSiswa[0].total_siswa;
    const hadir = hadirHariIni[0].hadir_hari_ini;

    const absent = total - hadir;

    const proporsiKetepatanWaktu =
      total > 0 ? Number((hadir / total).toFixed(2)) : 0;

    // [6] 5 Siswa Terlambat Terkini (Hari Ini)
    const [siswaTerlambatTerkini] = await db.query(
      `SELECT
          s.id,
          s.nama,
          s.kelas,
          TIME(a.created_at) AS jam_masuk
       FROM absensi a
       JOIN siswa s ON s.id = a.id_siswa
       WHERE DATE(a.created_at) = CURDATE()
       AND a.id_tahun_ajaran = ?
       AND TIME(a.created_at) > (
         SELECT config_value
         FROM config
         WHERE config_key = 'maks_waktu_terlambat'
         LIMIT 1
       )
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [id_tahun_ajaran],
    );

    res.json({
      total_siswa: totalSiswa[0].total_siswa,
      hadir_hari_ini: hadirHariIni[0].hadir_hari_ini,
      terlambat_hari_ini: terlambatHariIni[0].terlambat_hari_ini,
      rata_rata_kedatangan: rataRata[0].rata_rata_kedatangan,
      proporsiKetepatanWaktu,
      siswaTerlambatTerkini,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Statistics Summary */
export const getTrenPelanggaran = async (req, res) => {
  try {
    const { id_tahun_ajaran } = req.query;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "id_tahun_ajaran is required" });
    }

    // Tren Pelanggaran (Jan–Dec Tahun Ini)
    const [trenPelanggaran] = await db.query(`
      SELECT
        m.month,
        COALESCE(COUNT(p.id), 0) AS total_pelanggaran
      FROM (
        SELECT 1 AS month UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
        SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL
        SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL
        SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
      ) m
      LEFT JOIN pelanggaran_siswa p
        ON MONTH(p.tanggal) = m.month
        AND YEAR(p.tanggal) = YEAR(CURDATE())
      GROUP BY m.month
      ORDER BY m.month
    `);

    res.json({
      trenPelanggaran,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getRekapKehadiran = async (req, res) => {
  try {
    const { id_tahun_ajaran, type = "daily" } = req.query;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "id_tahun_ajaran is required" });
    }

    let dateConditionAbsensi = "";
    let dateConditionPerizinan = "";

    switch (type) {
      case "weekly":
        dateConditionAbsensi = `YEARWEEK(a.created_at,1)=YEARWEEK(CURDATE(),1)`;
        dateConditionPerizinan = `YEARWEEK(p.tanggal,1)=YEARWEEK(CURDATE(),1)`;
        break;

      case "monthly":
        dateConditionAbsensi = `
          YEAR(a.created_at)=YEAR(CURDATE())
          AND MONTH(a.created_at)=MONTH(CURDATE())
        `;
        dateConditionPerizinan = `
          YEAR(p.tanggal)=YEAR(CURDATE())
          AND MONTH(p.tanggal)=MONTH(CURDATE())
        `;
        break;

      default:
        dateConditionAbsensi = `DATE(a.created_at)=CURDATE()`;
        dateConditionPerizinan = `DATE(p.tanggal)=CURDATE()`;
    }

    const query = `
      SELECT
        LEFT(s.kelas,1) AS tingkat,

        COUNT(DISTINCT a.id) AS hadir,

        SUM(CASE WHEN p.status='izin' THEN 1 ELSE 0 END) AS izin,
        SUM(CASE WHEN p.status='sakit' THEN 1 ELSE 0 END) AS sakit,
        SUM(CASE WHEN p.status='alpha' THEN 1 ELSE 0 END) AS alpha

      FROM siswa s

      LEFT JOIN absensi a
        ON a.id_siswa = s.id
        AND ${dateConditionAbsensi}

      LEFT JOIN perizinan_siswa p
        ON p.id_siswa = s.id
        AND ${dateConditionPerizinan}

      WHERE s.id_tahun_ajaran = ?

      GROUP BY tingkat
      ORDER BY tingkat
    `;

    const [rows] = await db.query(query, [id_tahun_ajaran]);

    return res.json({
      tingkat: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
