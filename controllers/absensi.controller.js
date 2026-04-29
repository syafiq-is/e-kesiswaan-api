import db from "../lib/database.js";

/* Get All Absensi */
export const getAllAbsensi = async (req, res) => {
  try {
    const { page = 1, limit = 10, tahun_ajaran, semester, date } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    // Query Builder
    let whereClause = "WHERE 1=1 AND ta.tahun_ajaran = ? AND ta.semester = ?";
    const filterValues = [tahun_ajaran, semester];

    // Filter date
    if (date) {
      whereClause += `
        AND a.created_at >= ?
        AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      filterValues.push(date, date);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM absensi a
      JOIN siswa s ON a.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT 
        a.id,
        a.created_at,
        a.tipe_absensi,
        a.status,

        s.nama,
        s.nisn,

        sta.kelas,

        ta.tahun_ajaran,
        ta.semester,

        COALESCE(p.total_poin, 0) AS total_poin,
        COALESCE(aaa.total_terlambat, 0) AS total_terlambat

      FROM absensi a
      JOIN siswa s ON a.id_siswa = s.id
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id

      /* TOTAL POIN */
      LEFT JOIN (
        SELECT 
          ps.id_siswa,
          ps.id_tahun_ajaran,
          SUM(jp.poin) AS total_poin

        FROM pelanggaran_siswa ps

        JOIN jenis_pelanggaran jp
          ON ps.id_jenis_pelanggaran = jp.id

        GROUP BY ps.id_siswa, ps.id_tahun_ajaran
      ) p 
        ON p.id_siswa = s.id
        AND p.id_tahun_ajaran = a.id_tahun_ajaran

      /* TOTAL TERLAMBAT */
      LEFT JOIN (
        SELECT
          a2.id_siswa,
          a2.id_tahun_ajaran,

          SUM(
            a2.tipe_absensi = 'datang'
            AND TIME(a2.created_at) > '07:00:00'
          ) AS total_terlambat

        FROM absensi a2

        GROUP BY a2.id_siswa, a2.id_tahun_ajaran
      ) aaa
        ON aaa.id_siswa = s.id
        AND aaa.id_tahun_ajaran = a.id_tahun_ajaran

      ${whereClause}

      ORDER BY a.created_at DESC

      LIMIT ? OFFSET ?
    `;

    const [[{ total }]] = await db.query(countQuery, filterValues);

    const [rows] = await db.query(dataQuery, [
      ...filterValues,
      limitNumber,
      offset,
    ]);

    return res.json({
      data: rows,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* Create Absensi */
export const createAbsensi = async (req, res) => {
  try {
    const { nisn, tipe_absensi } = req.body;

    if (!nisn || !tipe_absensi)
      return res.status(400).json({ message: "Required fields missing" });

    const [tahun_ajaran_aktif] = await db.query(
      "SELECT id FROM tahun_ajaran WHERE status = 'aktif' LIMIT 1",
    );

    // ensure siswa exists
    const [siswa] = await db.query("SELECT id FROM siswa WHERE nisn = ?", [
      nisn,
    ]);

    if (!siswa.length) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    // GET CONFIG
    const [rows] = await db.query(
      "SELECT config_key, config_value FROM config",
    );

    const config = {};
    rows.forEach((row) => {
      config[row.config_key] = row.config_value;
    });

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);

    const jamMasuk = config.jam_masuk;
    const jamTerlambat = config.jam_terlambat;
    const jamBolehPulang = config.jam_boleh_pulang;
    const batasAkhirPulang = config.batas_akhir_pulang;

    // ABSEN MASUK
    if (tipe_absensi === "datang") {
      if (currentTime < jamMasuk) {
        return res.status(400).json({ message: "Belum waktunya absen masuk" });
      }

      const status = currentTime > jamTerlambat ? "terlambat" : "tepat_waktu";

      await db.query(
        `INSERT INTO absensi (id_siswa, id_tahun_ajaran, tipe_absensi, status) VALUES (?, ?, ?, ?)`,
        [siswa[0].id, tahun_ajaran_aktif[0].id, tipe_absensi, status],
      );

      res.status(201).json({ message: "Absensi created successfully" });
    }

    // ABSEN PULANG
    if (tipe_absensi === "pulang") {
      if (currentTime < jamBolehPulang) {
        return res.status(400).json({ message: "Belum waktunya absen pulang" });
      }

      if (currentTime > batasAkhirPulang) {
        return res
          .status(400)
          .json({ message: "Sudah lewat batas absen pulang" });
      }

      await db.query(
        `INSERT INTO absensi (id_siswa, id_tahun_ajaran, tipe_absensi, status) VALUES (?, ?, ?, ?)`,
        [siswa[0].id, tahun_ajaran_aktif[0].id, tipe_absensi, status],
      );

      res.status(201).json({ message: "Absensi created successfully" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Absensi by ID */
export const deleteAbsensiById = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM absensi WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Absensi not found" });
    }

    res.json({ message: "Absensi deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Absensi by nisn */
export const deleteAbsensiByNISN = async (req, res) => {
  try {
    const { nisn, tipe_absensi } = req.params;

    console.log(req.params);

    if (!tipe_absensi) {
      return res.status(400).json({ message: "tipe_absensi is required" });
    }

    // cari siswa
    const [siswa] = await db.query("SELECT id FROM siswa WHERE nisn = ?", [
      nisn,
    ]);

    if (!siswa.length) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    // delete spesifik hari ini + tipe
    const [result] = await db.query(
      `DELETE FROM absensi 
       WHERE id_siswa = ?
       AND tipe_absensi = ?
       AND created_at >= CURDATE()
       AND created_at < CURDATE() + INTERVAL 1 DAY`,
      [siswa[0].id, tipe_absensi],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: `No absensi ${tipe_absensi} found for today`,
      });
    }

    res.json({ message: `absensi ${tipe_absensi} deleted successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
