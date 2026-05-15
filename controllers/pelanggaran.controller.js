import db from "../lib/database.js";

/* Get All Pelanggaran Siswa */
export const getAllPelanggaran = async (req, res) => {
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
        AND ps.tanggal >= ?
        AND ps.tanggal < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      filterValues.push(date, date);
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM pelanggaran_siswa ps
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = ps.id_tahun_ajaran
      JOIN jenis_pelanggaran jp ON ps.id_jenis_pelanggaran = jp.id
      JOIN tahun_ajaran ta ON ps.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        ps.id,
        ps.tanggal,
        ps.keterangan,
        s.nama AS nama_siswa,
        s.nama_ayah,
        s.nama_ibu,
        s.nama_wali,
        s.jenis_kelamin,
        s.nisn,
        sta.kelas,
        jp.pelanggaran,
        jp.poin,
        ta.tahun_ajaran,
        ta.semester
      FROM pelanggaran_siswa ps
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = ps.id_tahun_ajaran
      JOIN jenis_pelanggaran jp ON ps.id_jenis_pelanggaran = jp.id
      JOIN tahun_ajaran ta ON ps.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY ps.tanggal DESC
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

/* Get All Siswa with Total Poin + Riwayat */
export const getAllTotalPoinSiswa = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tahun_ajaran,
      semester,
      tingkat,
      kelas,
      search,
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

    const countQuery = `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM pelanggaran_siswa ps
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = ps.id_tahun_ajaran
      JOIN tahun_ajaran ta ON ps.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        s.id,
        s.nama AS nama_siswa,
        s.nisn,
        sta.kelas,

        SUM(jp.poin) AS total_poin,

        JSON_ARRAYAGG(
          JSON_OBJECT(
            'tanggal', ps.tanggal,
            'pelanggaran', jp.pelanggaran,
            'poin', jp.poin,
            'keterangan', ps.keterangan
          )
        ) AS riwayat_pelanggaran

      FROM pelanggaran_siswa ps
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id AND sta.id_tahun_ajaran = ps.id_tahun_ajaran
      JOIN jenis_pelanggaran jp ON ps.id_jenis_pelanggaran = jp.id
      JOIN tahun_ajaran ta ON ps.id_tahun_ajaran = ta.id
      ${whereClause}
      GROUP BY s.id, s.nama, s.nisn, sta.kelas
      ORDER BY total_poin DESC
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

/* Create Pelanggaran Siswa */
export const createPelanggaran = async (req, res) => {
  try {
    const { id_siswa, id_jenis_pelanggaran, tanggal, keterangan } = req.body;

    if (!id_siswa || !id_jenis_pelanggaran || !tanggal) {
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

    // Validate jenis pelanggaran
    const [jenis] = await db.query(
      "SELECT id, poin FROM jenis_pelanggaran WHERE id = ?",
      [id_jenis_pelanggaran],
    );

    if (!jenis.length) {
      return res.status(404).json({ message: "Jenis pelanggaran not found" });
    }

    await db.query(
      `
      INSERT INTO pelanggaran_siswa
      (id_siswa, id_jenis_pelanggaran, id_tahun_ajaran, tanggal, keterangan)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        id_siswa,
        id_jenis_pelanggaran,
        tahun_ajaran_aktif[0].id,
        tanggal,
        keterangan || null,
      ],
    );

    res.status(201).json({
      message: "Pelanggaran siswa created successfully",
      poin: jenis[0].poin,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Pelanggaran Siswa by ID */
export const updatePelanggaranById = async (req, res) => {
  try {
    const { tanggal, keterangan } = req.body;

    if (!tanggal && !keterangan) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const [result] = await db.query(
      `
      UPDATE pelanggaran_siswa
      SET
        tanggal = COALESCE(?, tanggal),
        keterangan = COALESCE(?, keterangan)
      WHERE id = ?
      `,
      [tanggal || null, keterangan || null, req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pelanggaran siswa not found" });
    }

    res.json({ message: "Pelanggaran siswa updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Pelanggaran Siswa by ID */
export const deletePelanggaranById = async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM pelanggaran_siswa WHERE id = ?",
      [req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pelanggaran siswa not found" });
    }

    res.json({ message: "Pelanggaran siswa deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
