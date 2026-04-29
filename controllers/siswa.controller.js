import db from "../lib/database.js";

/* Get All Siswa */
export const getAllSiswa = async (req, res) => {
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
      SELECT COUNT(*) as total
      FROM siswa s 
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON sta.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        s.id,
        sta.kelas,
        s.nama,
        s.nipd,
        s.nik,
        s.nisn,
        s.agama,
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
        s.rt,
        s.rw,
        s.dusun,
        s.kelurahan,
        s.kecamatan,
        s.kode_pos,
        s.gambar,
        ta.tahun_ajaran
      FROM siswa s 
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON sta.id_tahun_ajaran = ta.id
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
    const [rows] = await db.query(
      `SELECT DISTINCT kelas FROM siswa_tahun_ajaran`,
    );
    const kelasList = rows.map((r) => r.kelas);

    res.json({
      kelas_list: kelasList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
/* Create Siswa */
export const createSiswa = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      nama,
      nipd,
      nik,
      nisn,
      kelas,
      agama,
      jenis_kelamin,
      tempat_lahir,
      tanggal_lahir,
      alamat,
      rt,
      rw,
      dusun,
      kelurahan,
      kecamatan,
      kode_pos,
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

    if (!nama || !nipd || !nik || !nisn || !kelas || !jenis_kelamin || !agama) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    if (!["L", "P"].includes(jenis_kelamin)) {
      return res.status(400).json({
        message: "Invalid jenis_kelamin",
      });
    }

    const [tahunAjaranAktif] = await connection.query(`
      SELECT id
      FROM tahun_ajaran
      WHERE status = 'aktif'
      LIMIT 1
    `);

    if (tahunAjaranAktif.length === 0) {
      return res.status(400).json({
        message: "No active academic year found",
      });
    }

    const id_tahun_ajaran = tahunAjaranAktif[0].id;

    await connection.beginTransaction();

    /* INSERT SISWA */
    const [result] = await connection.query(
      `
      INSERT INTO siswa (
        nama,
        nipd,
        nik,
        nisn,
        agama,
        jenis_kelamin,
        tempat_lahir,
        tanggal_lahir,
        alamat,
        rt,
        rw,
        dusun,
        kelurahan,
        kecamatan,
        kode_pos,
        nama_ayah,
        pekerjaan_ayah,
        nama_ibu,
        pekerjaan_ibu,
        nama_wali,
        pekerjaan_wali,
        no_telepon,
        penghasilan_orang_tua,
        gambar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nama,
        nipd,
        nik,
        nisn,
        agama,
        jenis_kelamin,
        tempat_lahir || null,
        tanggal_lahir || null,
        alamat || null,
        rt || null,
        rw || null,
        dusun || null,
        kelurahan || null,
        kecamatan || null,
        kode_pos || null,
        nama_ayah || null,
        pekerjaan_ayah || null,
        nama_ibu || null,
        pekerjaan_ibu || null,
        nama_wali || null,
        pekerjaan_wali || null,
        no_telepon || null,
        penghasilan_orang_tua || 0,
        gambarPath || null,
      ],
    );

    const id_siswa = result.insertId;

    /* INSERT SISWA TAHUN AJARAN */
    await connection.query(
      `
      INSERT INTO siswa_tahun_ajaran (
        id_siswa,
        id_tahun_ajaran,
        kelas
      ) VALUES (?, ?, ?)
      `,
      [id_siswa, id_tahun_ajaran, kelas],
    );

    await connection.commit();

    return res.status(201).json({
      message: "Siswa created successfully",
    });
  } catch (err) {
    await connection.rollback();

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "NIPD / NIK / NISN already exists",
      });
    }

    console.error(err);

    return res.status(500).json({
      message: "Server error",
    });
  } finally {
    connection.release();
  }
};

/* Update Siswa by ID */
export const updateSiswaById = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      nama,
      nipd,
      nik,
      nisn,
      kelas,
      agama,
      jenis_kelamin,
      tempat_lahir,
      tanggal_lahir,
      alamat,
      rt,
      rw,
      dusun,
      kelurahan,
      kecamatan,
      kode_pos,
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

    if (!nama || !nipd || !nik || !nisn || !kelas || !jenis_kelamin || !agama) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    if (!["L", "P"].includes(jenis_kelamin)) {
      return res.status(400).json({
        message: "Invalid jenis_kelamin",
      });
    }

    const [tahunAjaranAktif] = await connection.query(`
      SELECT id
      FROM tahun_ajaran
      WHERE status = 'aktif'
      LIMIT 1
    `);

    if (tahunAjaranAktif.length === 0) {
      return res.status(400).json({
        message: "No active academic year found",
      });
    }

    const id_tahun_ajaran = tahunAjaranAktif[0].id;

    await connection.beginTransaction();

    /* UPDATE SISWA */
    const [result] = await connection.query(
      `
      UPDATE siswa SET
        nama = COALESCE(?, nama),
        nipd = COALESCE(?, nipd),
        nik = COALESCE(?, nik),
        nisn = COALESCE(?, nisn),
        agama = COALESCE(?, agama),
        jenis_kelamin = COALESCE(?, jenis_kelamin),
        tempat_lahir = COALESCE(?, tempat_lahir),
        tanggal_lahir = COALESCE(?, tanggal_lahir),
        alamat = COALESCE(?, alamat),
        rt = COALESCE(?, rt),
        rw = COALESCE(?, rw),
        dusun = COALESCE(?, dusun),
        kelurahan = COALESCE(?, kelurahan),
        kecamatan = COALESCE(?, kecamatan),
        kode_pos = COALESCE(?, kode_pos),
        nama_ayah = COALESCE(?, nama_ayah),
        pekerjaan_ayah = COALESCE(?, pekerjaan_ayah),
        nama_ibu = COALESCE(?, nama_ibu),
        pekerjaan_ibu = COALESCE(?, pekerjaan_ibu),
        nama_wali = COALESCE(?, nama_wali),
        pekerjaan_wali = COALESCE(?, pekerjaan_wali),
        no_telepon = COALESCE(?, no_telepon),
        penghasilan_orang_tua = COALESCE(?, penghasilan_orang_tua),
        gambar = COALESCE(?, gambar)
      WHERE id = ?
      `,
      [
        nama,
        nipd,
        nik,
        nisn,
        agama,
        jenis_kelamin,
        tempat_lahir || null,
        tanggal_lahir || null,
        alamat || null,
        rt || null,
        rw || null,
        dusun || null,
        kelurahan || null,
        kecamatan || null,
        kode_pos || null,
        nama_ayah || null,
        pekerjaan_ayah || null,
        nama_ibu || null,
        pekerjaan_ibu || null,
        nama_wali || null,
        pekerjaan_wali || null,
        no_telepon || null,
        penghasilan_orang_tua || 0,
        gambarPath || null,
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "Siswa not found",
      });
    }

    /* UPDATE KELAS ON ACTIVE YEAR */
    const [existingSta] = await connection.query(
      `
      SELECT id
      FROM siswa_tahun_ajaran
      WHERE id_siswa = ?
      AND id_tahun_ajaran = ?
      LIMIT 1
      `,
      [req.params.id, id_tahun_ajaran],
    );

    if (existingSta.length > 0) {
      await connection.query(
        `
        UPDATE siswa_tahun_ajaran
        SET kelas = ?
        WHERE id_siswa = ?
        AND id_tahun_ajaran = ?
        `,
        [kelas, req.params.id, id_tahun_ajaran],
      );
    } else {
      await connection.query(
        `
        INSERT INTO siswa_tahun_ajaran (
          id_siswa,
          id_tahun_ajaran,
          kelas
        ) VALUES (?, ?, ?)
        `,
        [req.params.id, id_tahun_ajaran, kelas],
      );
    }

    await connection.commit();

    return res.json({
      message: "Siswa updated successfully",
    });
  } catch (err) {
    await connection.rollback();

    console.error(err);

    return res.status(500).json({
      message: "Server error",
    });
  } finally {
    connection.release();
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
