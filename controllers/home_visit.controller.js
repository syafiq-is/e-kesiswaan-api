import db from "../lib/database.js";

/* Get All Home Visit */
export const getAllHomeVisit = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tahun_ajaran,
      semester,
      tingkat,
      kelas,
      search,
      date,
    } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    // Query Builder
    let whereClause = "WHERE 1=1 AND ta.tahun_ajaran = ? AND ta.semester = ?";
    const filterValues = [tahun_ajaran, semester];

    // Filter tingkat
    if (tingkat) {
      whereClause += " AND (sta.kelas LIKE ?)";
      filterValues.push(`%${tingkat}%`);
    }

    // Filter kelas
    if (kelas) {
      whereClause += " AND sta.kelas = ?";
      filterValues.push(kelas);
    }

    // Search by Nama / NISN
    if (search) {
      whereClause += " AND (s.nama LIKE ? OR s.nisn LIKE ?)";
      filterValues.push(`%${search}%`, `%${search}%`);
    }

    // Filter date
    if (date) {
      whereClause += `
        AND hv.tanggal >= ?
        AND hv.tanggal < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      filterValues.push(date, date);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM home_visit hv
      JOIN siswa s ON s.id = hv.id_siswa
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = hv.id_tahun_ajaran
      JOIN tahun_ajaran ta ON hv.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        hv.id,
        hv.tanggal,
        hv.status,
        hv.created_at,
        s.nama AS nama_siswa,
        sta.kelas,
        ta.tahun_ajaran,
        ta.semester
      FROM home_visit hv
      JOIN siswa s ON s.id = hv.id_siswa
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = hv.id_tahun_ajaran
      JOIN tahun_ajaran ta ON hv.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY hv.tanggal DESC
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

/* Create Home Visit */
export const createHomeVisit = async (req, res) => {
  try {
    const { id_siswa, tanggal, keterangan, status } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (!id_siswa || !tanggal || !status) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const [tahun_ajaran_aktif] = await db.query(
      "SELECT id FROM tahun_ajaran WHERE status = 'aktif' LIMIT 1",
    );

    // Validate siswa
    const [siswa] = await db.query("SELECT id FROM siswa WHERE id = ?", [
      id_siswa,
    ]);

    if (!siswa.length) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    await db.query(
      `
      INSERT INTO home_visit
      (id_siswa, id_tahun_ajaran, tanggal, keterangan, gambar, status)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        id_siswa,
        tahun_ajaran_aktif[0].id,
        tanggal,
        keterangan,
        gambarPath,
        status,
      ],
    );

    res.status(201).json({ message: "Home visit created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Home Visit by ID */
export const updateHomeVisitById = async (req, res) => {
  try {
    const { tanggal, status, keterangan } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (!tanggal && !status && !keterangan) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (status && !["Rencana Kunjungan", "Sudah Terlaksana"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const [result] = await db.query(
      `
      UPDATE home_visit
      SET
        tanggal = COALESCE(?, tanggal),
        status = COALESCE(?, status),
        keterangan = COALESCE(?, keterangan),
        gambar = COALESCE(?, gambar)
      WHERE id = ?
      `,
      [
        tanggal || null,
        status || null,
        keterangan || null,
        gambarPath || null,
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Home visit not found" });
    }

    res.json({ message: "Home visit updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Home Visit by ID */
export const deleteHomeVisitById = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM home_visit WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Home visit not found" });
    }

    res.json({ message: "Home visit deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
