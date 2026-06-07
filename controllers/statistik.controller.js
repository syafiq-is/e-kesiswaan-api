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
      `SELECT COUNT(DISTINCT id_siswa) AS total_siswa
       FROM siswa s
       JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
       WHERE sta.id_tahun_ajaran = ?`,
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

    // [3] Terlambat Hari Ini
    const [terlambatHariIni] = await db.query(
      `SELECT COUNT(DISTINCT id_siswa) AS terlambat_hari_ini
       FROM absensi
       WHERE DATE(created_at) = CURDATE()
       AND status = "terlambat"
       AND id_tahun_ajaran = ?`,
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

    const total = totalSiswa[0].total_siswa;
    const hadir = hadirHariIni[0].hadir_hari_ini;

    const proporsiKetepatanWaktu =
      total > 0 ? Number((hadir / total).toFixed(2)) : 0;

    // [6] 5 Siswa Terlambat Terkini (Hari Ini)
    const [siswaTerlambatTerkini] = await db.query(
      `SELECT
          s.id,
          s.nama,
          sta.kelas,
          TIME(a.created_at) AS jam_masuk
       FROM absensi a
       JOIN siswa s ON s.id = a.id_siswa
       JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = a.id_tahun_ajaran
       WHERE DATE(a.created_at) = CURDATE()
       AND status = "terlambat"
       AND sta.id_tahun_ajaran = ?
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [id_tahun_ajaran],
    );

    // [7] 3 Siswa Paling Disiplin (Rata-rata Datang Paling Pagi)
    const [siswaRajin] = await db.query(
      `SELECT
        s.id,
        s.nama,
        sta.kelas,

        SEC_TO_TIME(
          AVG(
            TIME_TO_SEC(TIME(a.created_at))
          )
        ) AS rata_rata_datang

      FROM absensi a

      JOIN siswa s
        ON s.id = a.id_siswa

      JOIN siswa_tahun_ajaran sta
        ON sta.id_siswa = s.id
        AND sta.id_tahun_ajaran = a.id_tahun_ajaran

      WHERE MONTH(a.created_at) = MONTH(CURDATE())
        AND YEAR(a.created_at) = YEAR(CURDATE())
        AND a.tipe_absensi = 'datang'
        AND a.status IN ('tepat waktu', 'terlambat')
        AND sta.id_tahun_ajaran = ?

      GROUP BY s.id, s.nama, sta.kelas

      ORDER BY AVG(
        TIME_TO_SEC(TIME(a.created_at))
      ) ASC

      LIMIT 3`,
      [id_tahun_ajaran],
    );

    res.json({
      total_siswa: totalSiswa[0].total_siswa,
      hadir_hari_ini: hadirHariIni[0].hadir_hari_ini,
      terlambat_hari_ini: terlambatHariIni[0].terlambat_hari_ini,
      rata_rata_kedatangan: rataRata[0].rata_rata_kedatangan,
      proporsiKetepatanWaktu,
      siswaTerlambatTerkini,
      siswaRajin,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Statistics Summary - Tren Pelanggaran */
export const getTrenPelanggaran = async (req, res) => {
  try {
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

/* Statistics Summary - Rekap Kehadiran */
/* Get Rekap Kehadiran (Harian, Mingguan, Bulanan) */
export const getRekapKehadiran = async (req, res) => {
  try {
    const { id_tahun_ajaran, type } = req.query;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "id_tahun_ajaran is required" });
    }

    let dateConditionAbsensi = "";
    let dateConditionPerizinan = "";
    let dateConditionPelanggaran = "";

    // Logika rentang waktu dinamis
    if (type === "daily") {
      dateConditionAbsensi = "DATE(created_at) = CURDATE()";
      dateConditionPerizinan = "DATE(tanggal) = CURDATE()";
      dateConditionPelanggaran =
        "DATE(tanggal) = CURDATE() AND id_jenis_pelanggaran = 1";
    } else if (type === "weekly") {
      dateConditionAbsensi = "YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)";
      dateConditionPerizinan = "YEARWEEK(tanggal, 1) = YEARWEEK(CURDATE(), 1)";
      dateConditionPelanggaran =
        "YEARWEEK(tanggal, 1) = YEARWEEK(CURDATE(), 1) AND id_jenis_pelanggaran = 1";
    } else if (type === "monthly") {
      dateConditionAbsensi =
        "MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())";
      dateConditionPerizinan =
        "MONTH(tanggal) = MONTH(CURDATE()) AND YEAR(tanggal) = YEAR(CURDATE())";
      dateConditionPelanggaran =
        "MONTH(tanggal) = MONTH(CURDATE()) AND YEAR(tanggal) = YEAR(CURDATE()) AND id_jenis_pelanggaran = 1";
    } else {
      return res.status(400).json({ message: "Invalid type parameter" });
    }

    // Kueri Utama Anti-Bug dengan LIKE CONCAT
    const [tingkatRows] = await db.query(
      `
      SELECT
        t.tingkat,
        COUNT(DISTINCT sta.id_siswa) AS total_siswa,
        COALESCE(SUM(a.hadir), 0) AS hadir,
        COALESCE(SUM(p.izin), 0) AS izin,
        COALESCE(SUM(p.sakit), 0) AS sakit,
        COALESCE(SUM(ps.alpha), 0) AS alpha
      FROM (
        SELECT 7 AS tingkat
        UNION ALL SELECT 8
        UNION ALL SELECT 9
      ) t
      LEFT JOIN siswa_tahun_ajaran sta 
        ON sta.kelas LIKE CONCAT(t.tingkat, '%') 
        AND sta.id_tahun_ajaran = ?
      LEFT JOIN (
        SELECT id_siswa, COUNT(DISTINCT DATE(created_at)) AS hadir
        FROM absensi
        WHERE ${dateConditionAbsensi} AND id_tahun_ajaran = ?
        GROUP BY id_siswa
      ) a ON a.id_siswa = sta.id_siswa
      LEFT JOIN (
        SELECT id_siswa, 
               SUM(status = 'izin') AS izin,
               SUM(status = 'sakit') AS sakit
        FROM perizinan_siswa
        WHERE ${dateConditionPerizinan} AND id_tahun_ajaran = ?
        GROUP BY id_siswa
      ) p ON p.id_siswa = sta.id_siswa
      LEFT JOIN (
        SELECT id_siswa, 
               SUM(id_jenis_pelanggaran = 1) AS alpha
        FROM pelanggaran_siswa
        WHERE ${dateConditionPelanggaran} AND id_tahun_ajaran = ?
        GROUP BY id_siswa
      ) ps ON ps.id_siswa = sta.id_siswa
      GROUP BY t.tingkat
      ORDER BY t.tingkat ASC
      `,
      [id_tahun_ajaran, id_tahun_ajaran, id_tahun_ajaran, id_tahun_ajaran],
    );

    res.json({ tingkat: tingkatRows });
  } catch (err) {
    console.error("Error getRekapKehadiran:", err);
    res.status(500).json({ message: "Server error" });
  }
};
