import db from "../lib/database.js";

/* Get All Perizinan Siswa */
export const getAllPerizinan = async (req, res) => {
  try {
    const { tahun_ajaran, semester } = req.query;

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

    const [rows] = await db.query(
      `
      SELECT 
        p.id,
        p.status,
        p.keterangan,
        p.tanggal,
        p.created_at,
        s.id AS id_siswa,
        s.nama AS nama_siswa,
        s.kelas,
        p.gambar,
        ta.tahun_ajaran,
        ta.semester
      FROM perizinan_siswa p
      JOIN siswa s ON s.id = p.id_siswa
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

/* Get Perizinan Siswa by ID */
export const getPerizinanById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        p.*,
        s.nama AS nama_siswa,
        s.kelas
      FROM perizinan_siswa p
      JOIN siswa s ON s.id = p.id_siswa
      WHERE p.id = ?
      `,
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Perizinan siswa not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create Perizinan Siswa */
export const createPerizinan = async (req, res) => {
  try {
    const { id_siswa, id_tahun_ajaran, status, keterangan, tanggal } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (!id_siswa || !id_tahun_ajaran || !status || !tanggal) {
      return res.status(400).json({ message: "Required fields missing" });
    }

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
      (id_siswa, id_tahun_ajaran, status, keterangan, tanggal, gambar)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id_siswa, id_tahun_ajaran, status, keterangan, tanggal, gambarPath || null],
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
    const { status, keterangan, tanggal } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (!status && !keterangan && !tanggal) {
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
        gambar = COALESCE(?, gambar)
      WHERE id = ?
      `,
      [status, keterangan, tanggal, gambarPath || null, req.params.id],
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
