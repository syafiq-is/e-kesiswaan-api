import db from "../lib/database.js";

/* Get All Home Visit */
export const getAllHomeVisit = async (req, res) => {
  try {
    const { page = 1, limit = 10, tahun_ajaran, semester, kelas } = req.query;

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

    // Filter by kelas
    if (kelas) {
      whereClause += " AND s.kelas = ?";
      filterValues.push(kelas);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM home_visit hv
      JOIN siswa s ON s.id = hv.id_siswa
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        hv.id,
        hv.tanggal,
        hv.status,
        hv.created_at,
        s.id AS id_siswa,
        s.nama AS nama_siswa,
        s.kelas
      FROM home_visit hv
      JOIN siswa s ON s.id = hv.id_siswa
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY hv.created_at DESC
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

/* Get Home Visit by ID */
export const getHomeVisitById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        hv.*,
        s.nama AS nama_siswa,
        s.kelas
      FROM home_visit hv
      JOIN siswa s ON s.id = hv.id_siswa
      WHERE hv.id = ?
      `,
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Home visit not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create Home Visit */
export const createHomeVisit = async (req, res) => {
  try {
    const { id_siswa, tanggal, status } = req.body;

    if (!id_siswa || !tanggal || !status) {
      return res.status(400).json({ message: "Required fields missing" });
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
      INSERT INTO home_visit
      (id_siswa, tanggal, status)
      VALUES (?, ?, ?)
      `,
      [id_siswa, tanggal, status],
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
    const { tanggal, status } = req.body;

    if (!tanggal && !status) {
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
        status = COALESCE(?, status)
      WHERE id = ?
      `,
      [tanggal || null, status || null, req.params.id],
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
