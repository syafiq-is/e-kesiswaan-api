import db from "../lib/database.js";

/* Get All Prestasi */
export const getAllPrestasi = async (req, res) => {
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

    // Filter by kelas
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

    const countQuery = `
      SELECT COUNT(*) as total
      FROM prestasi_siswa p
      JOIN siswa s ON p.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON p.id_tahun_ajaran = ta.id
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
        sta.kelas,
        ta.tahun_ajaran,
        ta.semester
      FROM prestasi_siswa p
      JOIN siswa s ON p.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON p.id_tahun_ajaran = ta.id
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

    const [tahun_ajaran_aktif] = await db.query(
      "SELECT id FROM tahun_ajaran WHERE status = 'aktif' LIMIT 1",
    );

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
      (id_siswa, id_tahun_ajaran, nama_lomba, penyelenggara, tanggal, keterangan, kategori, tingkat, peringkat, gambar)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id_siswa,
        tahun_ajaran_aktif[0].id,
        nama_lomba,
        penyelenggara,
        tanggal,
        keterangan,
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
