import db from "../lib/database.js";

/* Get All Prestasi */
export const getAllPrestasi = async (req, res) => {
  try {
    const { page = 1, limit = 10, tahun_ajaran, semester } = req.query;

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

    const countQuery = `
      SELECT COUNT(*) as total
      FROM prestasi_siswa p
      JOIN siswa s ON p.id_siswa = s.id
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        p.id,
        p.nama_lomba,
        p.penyelenggara,
        p.tanggal,
        p.keterangan,
        p.kategori,
        p.tingkat,
        p.peringkat,
        p.gambar,
        s.nama AS nama_siswa,
        s.nisn,
        ta.tahun_ajaran
      FROM prestasi_siswa p
      JOIN siswa s ON p.id_siswa = s.id
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY p.tanggal DESC
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

/* Get Prestasi by ID */
export const getPrestasiById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        p.*,
        s.nama,
        s.kelas
      FROM prestasi_siswa p
      JOIN siswa s ON p.id_siswa = s.id
      WHERE p.id = ?
      `,
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Prestasi not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create Prestasi */
export const createPrestasi = async (req, res) => {
  try {
    const {
      id_siswa,
      nama_lomba,
      penyelenggara,
      tanggal,
      keterangan,
      kategori,
      tingkat,
      peringkat,
      // gambar,
    } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (
      !id_siswa ||
      !nama_lomba ||
      !penyelenggara ||
      !tanggal ||
      !keterangan ||
      !kategori ||
      !tingkat
    ) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (!["akademik", "non-akademik"].includes(kategori)) {
      return res.status(400).json({ message: "Invalid kategori" });
    }

    if (
      ![
        "kecamatan",
        "kabupaten/kota",
        "provinsi",
        "nasional",
        "internasional",
      ].includes(tingkat)
    ) {
      return res.status(400).json({ message: "Invalid tingkat" });
    }

    // Ensure siswa exists
    const [siswa] = await db.query("SELECT id FROM siswa WHERE id = ?", [
      id_siswa,
    ]);

    if (!siswa.length) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    await db.query(
      `
      INSERT INTO prestasi_siswa
      (id_siswa, nama_lomba, penyelenggara, tanggal, keterangan, kategori, tingkat, peringkat, gambar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id_siswa,
        nama_lomba,
        penyelenggara,
        tanggal,
        keterangan,

        tanggal,
        kategori,
        tingkat,
        peringkat,
        gambarPath || null,
      ],
    );

    res.status(201).json({ message: "Prestasi created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Prestasi by ID */
export const updatePrestasiById = async (req, res) => {
  try {
    const {
      nama_lomba,
      penyelenggara,
      tanggal,
      keterangan,
      kategori,
      tingkat,
      peringkat,
      gambar,
    } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (
      !nama_lomba &&
      !penyelenggara &&
      !tanggal &&
      !kategori &&
      !tingkat &&
      !peringkat &&
      !gambar
    ) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (kategori && !["akademik", "non-akademik"].includes(kategori)) {
      return res.status(400).json({ message: "Invalid kategori" });
    }

    if (
      tingkat &&
      ![
        "kecamatan",
        "kabupaten/kota",
        "provinsi",
        "nasional",
        "internasional",
      ].includes(tingkat)
    ) {
      return res.status(400).json({ message: "Invalid tingkat" });
    }

    const [result] = await db.query(
      `
      UPDATE prestasi_siswa SET
        nama_lomba = COALESCE(?, nama_lomba),
        penyelenggara = COALESCE(?, penyelenggara),
        tanggal = COALESCE(?, tanggal),
        keterangan = COALESCE(?, keterangan),
        kategori = COALESCE(?, kategori),
        tingkat = COALESCE(?, tingkat),
        peringkat = COALESCE(?, peringkat),
        gambar = COALESCE(?, gambar)
      WHERE id = ?
      `,
      [
        nama_lomba || null,
        penyelenggara || null,
        tanggal || null,
        keterangan || null,
        kategori || null,
        tingkat || null,
        peringkat || null,
        gambarPath || null,
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Prestasi not found" });
    }

    res.json({ message: "Prestasi updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Prestasi by ID */
export const deletePrestasiById = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM prestasi_siswa WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Prestasi not found" });
    }

    res.json({ message: "Prestasi deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
