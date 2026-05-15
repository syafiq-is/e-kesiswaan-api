import db from "../lib/database.js";

/* Get All Perizinan Siswa */
export const getAllPerizinan = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas, search, date } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

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
        AND p.tanggal >= ?
        AND p.tanggal < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      filterValues.push(date, date);
    }

    const [rows] = await db.query(
      `
      SELECT 
        p.id,
        p.status,
        p.keterangan,
        p.tanggal,
        p.jam_mulai,
        p.jam_selesai,
        p.created_at,
        s.id AS id_siswa,
        s.nama AS nama_siswa,
        sta.kelas,
        p.gambar,
        ta.tahun_ajaran,
        ta.semester
      FROM perizinan_siswa p
      JOIN siswa s ON s.id = p.id_siswa
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = p.id_tahun_ajaran
      JOIN tahun_ajaran ta ON p.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY p.tanggal DESC
    `,
      filterValues,
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create Perizinan Siswa */
export const createPerizinan = async (req, res) => {
  try {
    const { id_siswa, status, keterangan, tanggal, jam_mulai, jam_selesai } =
      req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (!id_siswa || !status || !tanggal || !jam_mulai || !jam_selesai) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const [tahun_ajaran_aktif] = await db.query(
      "SELECT id FROM tahun_ajaran WHERE status = 'aktif' LIMIT 1",
    );

    if (!["izin", "sakit", "alpha"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Validate siswa
    const [siswa] = await db.query("SELECT id FROM siswa WHERE id = ?", [
      id_siswa,
    ]);

    if (!siswa.length) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    await db.query(
      `
      INSERT INTO perizinan_siswa
      (id_siswa, id_tahun_ajaran, status, keterangan, tanggal, jam_mulai, jam_selesai, gambar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id_siswa,
        tahun_ajaran_aktif[0].id,
        status,
        keterangan,
        tanggal,
        jam_mulai,
        jam_selesai,
        gambarPath || null,
      ],
    );

    res.status(201).json({ message: "Perizinan siswa created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Perizinan Siswa by ID */
export const updatePerizinanById = async (req, res) => {
  try {
    const { status, keterangan, tanggal, jam_mulai, jam_selesai } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (!status && !keterangan && !tanggal && !jam_mulai && !jam_selesai) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (status && !["izin", "sakit", "alpha"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const [result] = await db.query(
      `
      UPDATE perizinan_siswa
      SET
        status = COALESCE(?, status),
        keterangan = COALESCE(?, keterangan),
        tanggal = COALESCE(?, tanggal),
        jam_mulai = COALESCE(?, jam_mulai),
        jam_selesai = COALESCE(?, jam_selesai),
        gambar = COALESCE(?, gambar)
      WHERE id = ?
      `,
      [
        status,
        keterangan,
        tanggal,
        jam_mulai,
        jam_selesai,
        gambarPath || null,
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Perizinan siswa not found" });
    }

    res.json({ message: "Perizinan siswa updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Perizinan Siswa by ID */
export const deletePerizinanById = async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM perizinan_siswa WHERE id = ?",
      [req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Perizinan siswa not found" });
    }

    res.json({ message: "Perizinan siswa deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
