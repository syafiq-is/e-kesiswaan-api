import db from "../lib/database.js";

/* Get All Siswa */
export const getAllSiswa = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tahun_ajaran,
      semester,
      kelas,
      search,
    } = req.query;

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

    // Filter kelas
    if (kelas) {
      whereClause += " AND s.kelas = ?";
      filterValues.push(kelas);
    }

    // Search nama / NISN
    if (search) {
      whereClause += " AND (s.nama LIKE ? OR s.nisn LIKE ?)";
      filterValues.push(`%${search}%`, `%${search}%`);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM siswa s
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        s.id,
        s.nama,
        s.nis,
        s.nisn,
        s.kelas,
        s.jenis_kelamin,
        s.tempat_lahir,
        s.tanggal_lahir,
        s.nama_ayah,
        s.pekerjaan_ayah,
        s.nama_ibu,
        s.pekerjaan_ibu,
        s.nama_wali,
        s.pekerjaan_wali,
        s.no_telepon,
        s.alamat,
        s.gambar,
        ta.tahun_ajaran
      FROM siswa s
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY s.nama ASC
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

/* Get All Kelas */
export const getAllKelas = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT DISTINCT kelas FROM siswa`);
    const kelasList = rows.map((r) => r.kelas);

    res.json({
      kelas_list: kelasList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Get Siswa by ID */
export const getSiswaById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM siswa WHERE id = ?", [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create Siswa */
export const createSiswa = async (req, res) => {
  try {
    const {
      id_tahun_ajaran,
      nama,
      nis,
      nisn,
      kelas,
      jenis_kelamin,
      tempat_lahir,
      tanggal_lahir,
      alamat,
      nama_ayah,
      pekerjaan_ayah,
      nama_ibu,
      pekerjaan_ibu,
      nama_wali,
      pekerjaan_wali,
      no_telepon,
      penghasilan_orang_tua,
    } = req.body;

    const gambarPath = req.file ? `uploads/${req.file.filename}` : null;

    if (
      !id_tahun_ajaran ||
      !nama ||
      !nis ||
      !nisn ||
      !kelas ||
      !jenis_kelamin
    ) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (!["L", "P"].includes(jenis_kelamin)) {
      return res.status(400).json({ message: "Invalid jenis_kelamin" });
    }

    await db.query(
      `
      INSERT INTO siswa (
        id_tahun_ajaran,
        nama,
        nis,
        nisn,
        kelas,
        jenis_kelamin,
        tempat_lahir,
        tanggal_lahir,
        alamat,
        nama_ayah,
        pekerjaan_ayah,
        nama_ibu,
        pekerjaan_ibu,
        nama_wali,
        pekerjaan_wali,
        no_telepon,
        penghasilan_orang_tua,
        gambar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id_tahun_ajaran,
        nama,
        nis,
        nisn,
        kelas,
        jenis_kelamin,
        tempat_lahir || null,
        tanggal_lahir || null,
        alamat || null,
        nama_ayah || null,
        pekerjaan_ayah || null,
        nama_ibu || null,
        pekerjaan_ibu || null,
        nama_wali || null,
        pekerjaan_wali || null,
        no_telepon || null,
        penghasilan_orang_tua || null,
        gambarPath || null,
      ],
    );

    res.status(201).json({ message: "Siswa created successfully" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "NISN already exists" });
    }

    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Siswa by ID */
export const updateSiswaById = async (req, res) => {
  try {
    const {
      nama,
      kelas,
      jenis_kelamin,
      tempat_lahir,
      tanggal_lahir,
      alamat,
      nama_ayah,
      pekerjaan_ayah,
      nama_ibu,
      pekerjaan_ibu,
      nama_wali,
      pekerjaan_wali,
      no_telepon,
      penghasilan_orang_tua,
    } = req.body;

    if (jenis_kelamin && !["L", "P"].includes(jenis_kelamin)) {
      return res.status(400).json({ message: "Invalid jenis_kelamin" });
    }

    const [result] = await db.query(
      `
      UPDATE siswa SET
        nama = COALESCE(?, nama),
        kelas = COALESCE(?, kelas),
        jenis_kelamin = COALESCE(?, jenis_kelamin),
        tempat_lahir = COALESCE(?, tempat_lahir),
        tanggal_lahir = COALESCE(?, tanggal_lahir),
        alamat = COALESCE(?, alamat),
        nama_ayah = COALESCE(?, nama_ayah),
        pekerjaan_ayah = COALESCE(?, pekerjaan_ayah),
        nama_ibu = COALESCE(?, nama_ibu),
        pekerjaan_ibu = COALESCE(?, pekerjaan_ibu),
        nama_wali = COALESCE(?, nama_wali),
        pekerjaan_wali = COALESCE(?, pekerjaan_wali),
        no_telepon = COALESCE(?, no_telepon),
        penghasilan_orang_tua = COALESCE(?, penghasilan_orang_tua)
      WHERE id = ?
      `,
      [
        nama || null,
        kelas || null,
        jenis_kelamin || null,
        tempat_lahir || null,
        tanggal_lahir || null,
        alamat || null,
        nama_ayah || null,
        pekerjaan_ayah || null,
        nama_ibu || null,
        pekerjaan_ibu || null,
        nama_wali || null,
        pekerjaan_wali || null,
        no_telepon || null,
        penghasilan_orang_tua || null,
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    res.json({ message: "Siswa updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Siswa by ID */
export const deleteSiswaById = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM siswa WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Siswa not found" });
    }

    res.json({ message: "Siswa deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
