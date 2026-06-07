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
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = a.id_tahun_ajaran
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    // FIX: Menggunakan DATE_FORMAT agar Node.js tidak memundurkan waktu 7 jam (UTC/WIB)
    const dataQuery = `
      SELECT 
        a.id, 
        DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, 
        a.tipe_absensi, 
        a.status,
      
        s.nama, 
        s.nipd,
        
        sta.kelas,
        COALESCE(p.total_poin, 0) AS total_poin,
        COALESCE(aaa.total_terlambat, 0) AS total_terlambat

      FROM absensi a
      JOIN siswa s ON a.id_siswa = s.id
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = a.id_tahun_ajaran

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
      ) p ON p.id_siswa = s.id AND p.id_tahun_ajaran = a.id_tahun_ajaran

      /* TOTAL TERLAMBAT */
      LEFT JOIN (
        SELECT 
          a2.id_siswa, 
          a2.id_tahun_ajaran, 
          SUM(a2.status = 'terlambat') AS total_terlambat
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
    const { nipd, tipe_absensi } = req.body;

    if (!nipd || !tipe_absensi) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    if (!["datang", "pulang"].includes(tipe_absensi)) {
      return res.status(400).json({
        message: "Invalid tipe_absensi",
      });
    }

    const [tahun_ajaran_aktif] = await db.query(
      `
      SELECT id
      FROM tahun_ajaran
      WHERE status = 'aktif'
      LIMIT 1
      `,
    );

    if (tahun_ajaran_aktif.length === 0) {
      return res.status(400).json({
        message: "No active academic year found",
      });
    }

    // ENSURE SISWA EXISTS
    const [siswa] = await db.query(
      `
      SELECT id
      FROM siswa
      WHERE nipd = ?
      `,
      [nipd],
    );

    if (!siswa.length) {
      return res.status(404).json({
        message: "Siswa not found",
      });
    }

    const id_siswa = siswa[0].id;

    // CHECK ALREADY ABSEN TODAY
    const [existingAbsensi] = await db.query(
      `
      SELECT id
      FROM absensi
      WHERE id_siswa = ?
      AND tipe_absensi = ?
      AND DATE(created_at) = CURDATE()
      LIMIT 1
      `,
      [id_siswa, tipe_absensi],
    );

    if (existingAbsensi.length > 0) {
      return res.status(400).json({
        message: `Siswa already absensi ${tipe_absensi} today`,
      });
    }

    // GET CONFIG
    const [rows] = await db.query(
      `
      SELECT config_key, config_value
      FROM config
      `,
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

    // ABSEN DATANG
    if (tipe_absensi === "datang") {
      if (currentTime < jamMasuk) {
        return res.status(400).json({
          message: "Belum waktunya absen masuk",
        });
      }

      const status = currentTime > jamTerlambat ? "terlambat" : "tepat waktu";

      await db.query(
        `
    INSERT INTO absensi (
      id_siswa,
      id_tahun_ajaran,
      tipe_absensi,
      status
    ) VALUES (?, ?, ?, ?)
    `,
        [id_siswa, tahun_ajaran_aktif[0].id, tipe_absensi, status],
      );

      // Tambah poin jika terlambat
      if (status === "terlambat") {
        await db.query(
          `
      INSERT INTO pelanggaran_siswa (
        id_siswa,
        id_jenis_pelanggaran,
        id_tahun_ajaran,
        tanggal,
        keterangan
      ) VALUES (?, ?, ?, CURDATE(), ?)
      `,
          [
            id_siswa,
            6, // id_jenis_pelanggaran = 6 (terlambat)
            tahun_ajaran_aktif[0].id,
            "Terlambat absensi (+5 poin)",
          ],
        );
      }

      return res.status(201).json({
        message: "Absensi datang created successfully",
      });
    }

    // ABSEN PULANG
    if (tipe_absensi === "pulang") {
      if (currentTime < jamBolehPulang) {
        return res.status(400).json({
          message: "Belum waktunya absen pulang",
        });
      }

      if (currentTime > batasAkhirPulang) {
        return res.status(400).json({
          message: "Sudah lewat batas absen pulang",
        });
      }

      // ENSURE SUDAH ABSEN DATANG
      const [absenDatang] = await db.query(
        `
        SELECT id
        FROM absensi
        WHERE id_siswa = ?
        AND tipe_absensi = 'datang'
        AND DATE(created_at) = CURDATE()
        LIMIT 1
        `,
        [id_siswa],
      );

      if (absenDatang.length === 0) {
        return res.status(400).json({
          message: "Siswa belum absensi datang hari ini",
        });
      }

      await db.query(
        `
        INSERT INTO absensi (
          id_siswa,
          id_tahun_ajaran,
          tipe_absensi,
          status
        ) VALUES (?, ?, ?, ?)
        `,
        [id_siswa, tahun_ajaran_aktif[0].id, tipe_absensi, "tepat waktu"],
      );

      return res.status(201).json({
        message: "Absensi pulang created successfully",
      });
    }
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Server error",
    });
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

/* Delete Absensi by nipd */
export const deleteAbsensiByNIPD = async (req, res) => {
  try {
    const { nipd, tipe_absensi } = req.params;

    console.log(req.params);

    if (!tipe_absensi) {
      return res.status(400).json({ message: "tipe_absensi is required" });
    }

    // cari siswa
    const [siswa] = await db.query("SELECT id FROM siswa WHERE nipd = ?", [
      nipd,
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

/* Flag Unattended Students As Alpha */
export const flagUnattendedAsAlpha = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    /* GET ACTIVE TAHUN AJARAN */
    const [tahunAjaran] = await db.query(`
      SELECT id
      FROM tahun_ajaran
      WHERE status = 'aktif'
      LIMIT 1
    `);

    if (tahunAjaran.length === 0) {
      return res.status(400).json({
        message: "No active academic year found",
      });
    }

    const id_tahun_ajaran = tahunAjaran[0].id;

    /* GET CONFIG */
    const [configRows] = await db.query(`
      SELECT config_key, config_value
      FROM config
    `);

    const config = {};

    configRows.forEach((row) => {
      config[row.config_key] = row.config_value;
    });

    const batasAkhirPulang = config.batas_akhir_pulang;
    const lastFlagAlpha = config.last_flag_alpha;

    // Memastikan fungsi hanya dijalankan sekali
    if (lastFlagAlpha == today) {
      return res.status(400).json({
        message: "Alpha sudah ditandai hari ini",
      });
    }

    const currentTime = new Date().toTimeString().slice(0, 8);

    /* ONLY RUN AFTER BATAS AKHIR PULANG */
    if (currentTime < batasAkhirPulang) {
      return res.status(400).json({
        message: "Belum melewati batas akhir absensi pulang",
      });
    }

    /*
      CONDITIONS:

      1. Tidak absensi datang sampai batas akhir pulang
      2. Datang tapi tidak pulang
      3. Tidak punya izin/sakit hari ini
    */

    const [students] = await db.query(
      `
      SELECT s.id AS id_siswa
      FROM siswa s

      LEFT JOIN perizinan_siswa ps
        ON ps.id_siswa = s.id
        AND ps.tanggal = CURDATE()

      WHERE
        ps.id IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM absensi a
          WHERE a.id_siswa = s.id
          AND DATE(a.created_at) = CURDATE()
        )
      `,
    );

    if (students.length === 0) {
      return res.json({
        message: "No students need to be flagged as alpha",
      });
    }

    const alphaValues = students.map((student) => [
      student.id_siswa,
      id_tahun_ajaran,
      1,
      today,
      "Alpha ditandai oleh sistem",
    ]);

    await db.query(
      `
      INSERT INTO pelanggaran_siswa (
        id_siswa, 
        id_tahun_ajaran, 
        id_jenis_pelanggaran, 
        tanggal, 
        keterangan
      ) VALUES ?
      `,
      [alphaValues],
    );

    await db.query(
      `
      UPDATE config
      SET
        config_value = ?
      WHERE config_key = 'last_flag_alpha'
      `,
      [today],
    );

    return res.json({
      message: "Students flagged as alpha successfully",
      total_alpha: students.length,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Server error",
    });
  }
};
