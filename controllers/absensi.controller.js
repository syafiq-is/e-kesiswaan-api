import db from "../lib/database.js";

/* Get All Absensi */
export const getAllAbsensi = async (req, res) => {
  try {
    const { page = 1, limit = 10, tahun_ajaran, semester, date } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    let whereClause = "WHERE 1=1";
    const filterValues = [];

    // Filter tahun ajaran & semester
    if (tahun_ajaran) {
      whereClause += " AND ta.tahun_ajaran = ?";
      filterValues.push(tahun_ajaran);

      if (semester) {
        whereClause += " AND ta.semester = ?";
        filterValues.push(semester);
      }
    }

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
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT 
        a.id,
        a.created_at,
        a.tipe_absensi,
        s.nama,
        s.nisn,
        s.kelas,
        ta.tahun_ajaran,
        ta.semester
      FROM absensi a
      JOIN siswa s ON a.id_siswa = s.id
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
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
    res.status(500).json({ message: "Server error" });
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

    await db.query(
      `INSERT INTO absensi (id_siswa, id_tahun_ajaran, tipe_absensi) VALUES (?, ?, ?)`,
      [siswa[0].id, tahun_ajaran_aktif[0].id, tipe_absensi],
    );

    res.status(201).json({ message: "Absensi created successfully" });
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
