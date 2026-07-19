import db from "../lib/database.js";

export const getRekapKehadiran = async (req, res) => {
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

    // FILTER TANGGAL ABSENSI
    let absensiWhere = `
      WHERE ta2.tahun_ajaran = ?
      AND ta2.semester = ?
    `;

    const absensiValues = [tahun_ajaran, semester];

    if (date) {
      absensiWhere += `
        AND a.created_at >= ?
        AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      absensiValues.push(date, date);
    }

    // FILTER TANGGAL PERIZINAN
    let perizinanWhere = `
      WHERE ta3.tahun_ajaran = ?
      AND ta3.semester = ?
    `;

    const perizinanValues = [tahun_ajaran, semester];

    if (date) {
      perizinanWhere += `
        AND p.created_at >= ?
        AND p.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      perizinanValues.push(date, date);
    }

    // FILTER TANGGAL PELANGGARAN
    let pelanggaranWhere = `
      WHERE ta4.tahun_ajaran = ?
      AND ta4.semester = ?
    `;

    const pelanggaranValues = [tahun_ajaran, semester];

    if (date) {
      pelanggaranWhere += `
        AND ps.created_at >= ?
        AND ps.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      pelanggaranValues.push(date, date);
    }

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) AS total

      FROM siswa s

      JOIN siswa_tahun_ajaran sta
        ON sta.id_siswa = s.id

      JOIN tahun_ajaran ta
        ON sta.id_tahun_ajaran = ta.id

      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        s.id,
        s.nisn,
        s.nama,
        s.jenis_kelamin,
        sta.kelas,

        COALESCE(a.total_hadir, 0) AS total_hadir,
        COALESCE(a.total_terlambat, 0) AS total_terlambat,

        COALESCE(p.total_izin, 0) AS total_izin,
        COALESCE(p.total_sakit, 0) AS total_sakit,

        COALESCE(ps.total_alpha, 0) AS total_alpha

      FROM siswa s

      JOIN siswa_tahun_ajaran sta
        ON sta.id_siswa = s.id

      JOIN tahun_ajaran ta
        ON sta.id_tahun_ajaran = ta.id

      LEFT JOIN (
        SELECT
          a.id_siswa,

          COUNT(DISTINCT CASE WHEN tipe_absensi IN ('datang', 'pulang') THEN DATE(a.created_at) END) AS total_hadir,
          SUM(a.status = 'terlambat') AS total_terlambat

        FROM absensi a

        JOIN tahun_ajaran ta2
          ON a.id_tahun_ajaran = ta2.id

        ${absensiWhere}

        GROUP BY a.id_siswa
      ) a ON a.id_siswa = s.id

      LEFT JOIN (
        SELECT
          p.id_siswa,

          SUM(p.status = 'izin') AS total_izin,
          SUM(p.status = 'sakit') AS total_sakit

        FROM perizinan_siswa p

        JOIN tahun_ajaran ta3
          ON p.id_tahun_ajaran = ta3.id

        ${perizinanWhere}

        GROUP BY p.id_siswa
      ) p ON p.id_siswa = s.id

      LEFT JOIN (
        SELECT
          ps.id_siswa,

          SUM(ps.id_jenis_pelanggaran = 1) AS total_alpha

        FROM pelanggaran_siswa ps

        JOIN tahun_ajaran ta4
          ON ps.id_tahun_ajaran = ta4.id

        ${pelanggaranWhere}

        GROUP BY ps.id_siswa
      ) ps ON ps.id_siswa = s.id

      ${whereClause}

      ORDER BY sta.kelas, s.nama ASC
      LIMIT ? OFFSET ?
    `;

    const [[{ total }]] = await db.query(countQuery, filterValues);

    const [rows] = await db.query(dataQuery, [
      ...absensiValues,
      ...perizinanValues,
      ...pelanggaranValues,
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

export const getRekapKehadiranBK = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tahun_ajaran,
      semester,
      kelas,
      bulan = 1, // default Januari
    } = req.query;

    if (!tahun_ajaran || !semester) {
      return res.status(400).json({
        message: "tahun_ajaran and semester are required",
      });
    }

    // =========================
    // GET TAHUN AJARAN
    // =========================

    const [[tahunAjaranData]] = await db.query(
      `
      SELECT *
      FROM tahun_ajaran
      WHERE tahun_ajaran = ?
      AND semester = ?
      LIMIT 1
      `,
      [tahun_ajaran, semester],
    );

    if (!tahunAjaranData) {
      return res.status(404).json({
        message: "Tahun ajaran not found",
      });
    }

    // =========================
    // DETERMINE YEAR
    // =========================

    const tahunMulai = Number(tahun_ajaran.split("/")[0]);
    const tahunSelesai = Number(tahun_ajaran.split("/")[1]);

    const month = Number(bulan);
    const year = semester === "Ganjil" ? tahunMulai : tahunSelesai;

    const daysInMonth = new Date(year, month, 0).getDate();

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

    const nextMonthDate =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // DEBUG
    // const tahunAjaranData = { id: 12 };
    // const startDate = "2026-07-1";
    // const nextMonthDate = "2026-08-1";
    // const daysInMonth = new Date("2026", "07", 0).getDate();

    // =========================
    // FILTER
    // =========================

    let whereClause = `
      WHERE sta.id_tahun_ajaran = ?
    `;

    const params = [tahunAjaranData.id];

    if (kelas) {
      whereClause += ` AND sta.kelas = ?`;
      params.push(kelas);
    }

    // =========================
    // DYNAMIC DAY COLUMN
    // =========================

    let selectDays = "";

    for (let d = 1; d <= 31; d++) {
      if (d <= daysInMonth) {
        selectDays += `
          MAX(
            CASE
              WHEN DAY(COALESCE(izin.tanggal, a.tanggal)) = ${d} THEN
                CASE
                  WHEN izin.status = 'sakit' THEN 'S'
                  WHEN izin.status = 'izin' THEN 'I'
                  WHEN a.hadir = 1 THEN 'H'
                  ELSE 'A'
                END
            END
          ) AS \`${d}\`,`;
      } else {
        selectDays += `NULL AS \`${d}\`,`;
      }
    }

    // =========================
    // QUERY
    // =========================

    const query = `
      SELECT
        s.nisn,
        s.nama,
        sta.kelas,
        s.jenis_kelamin,

        ${selectDays}

        COALESCE(att.total_hadir,0) AS total_hadir,
        COALESCE(iz.total_sakit,0) AS total_sakit,
        COALESCE(iz.total_izin,0) AS total_izin,
        COALESCE(att.total_terlambat,0) AS total_terlambat

      FROM siswa s

      JOIN siswa_tahun_ajaran sta
        ON sta.id_siswa = s.id

      /* Attendance per day */
      LEFT JOIN (
          SELECT
              id_siswa,
              id_tahun_ajaran,
              DATE(created_at) AS tanggal,
              1 AS hadir
          FROM absensi
          WHERE id_tahun_ajaran = ?
            AND created_at >= ?
            AND created_at < ?
          GROUP BY
              id_siswa,
              id_tahun_ajaran,
              DATE(created_at)
      ) a
          ON a.id_siswa = s.id
        AND a.id_tahun_ajaran = sta.id_tahun_ajaran

      /* Permission per day */
      LEFT JOIN (
          SELECT
              id_siswa,
              id_tahun_ajaran,
              tanggal,
              status
          FROM perizinan_siswa
          WHERE id_tahun_ajaran = ?
            AND tanggal >= ?
            AND tanggal < ?
      ) izin
          ON izin.id_siswa = s.id
        AND izin.id_tahun_ajaran = sta.id_tahun_ajaran
        AND izin.tanggal = a.tanggal

      /* Attendance totals */
      LEFT JOIN (
          SELECT
              id_siswa,
              COUNT(DISTINCT CASE WHEN tipe_absensi IN ('datang', 'pulang') THEN DATE(created_at) END) AS total_hadir,
              SUM(status = 'terlambat') AS total_terlambat
          FROM absensi
          WHERE id_tahun_ajaran = ?
            AND created_at >= ?
            AND created_at < ?
          GROUP BY id_siswa
      ) att
          ON att.id_siswa = s.id

      /* Permission totals */
      LEFT JOIN (
          SELECT
              id_siswa,
              SUM(status = 'izin') AS total_izin,
              SUM(status = 'sakit') AS total_sakit
          FROM perizinan_siswa
          WHERE id_tahun_ajaran = ?
            AND tanggal >= ?
            AND tanggal < ?
          GROUP BY id_siswa
      ) iz
          ON iz.id_siswa = s.id
        
      ${whereClause}

      GROUP BY
          s.id,
          s.nisn,
          s.nama,
          sta.kelas,
          s.jenis_kelamin,
          att.total_hadir,
          att.total_terlambat,
          iz.total_izin,
          iz.total_sakit

      ORDER BY
          sta.kelas,
          s.nama;
    `;

    const [rows] = await db.query(query, [
      // matrix
      tahunAjaranData.id,
      startDate,
      nextMonthDate,

      tahunAjaranData.id,
      startDate,
      nextMonthDate,

      tahunAjaranData.id,
      startDate,
      nextMonthDate,

      tahunAjaranData.id,
      startDate,
      nextMonthDate,

      // filter
      ...params,
    ]);

    return res.status(200).json({
      message: "Success",
      data: rows,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

export const getDataKehadiran = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas, search, date } = req.query;

    if (!tahun_ajaran || !semester) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    let params = [];

    let sql = `
      SELECT
          s.nama,
          sta.kelas,

          MAX(CASE WHEN a.tipe_absensi = 'datang' THEN TIME(a.created_at) END) AS jam_datang,
          MAX(CASE WHEN a.tipe_absensi = 'pulang' THEN TIME(a.created_at) END) AS jam_pulang,

          CASE
              WHEN MAX(CASE WHEN a.tipe_absensi IN ('datang','pulang') THEN 1 END) IS NOT NULL
                  THEN 'hadir'

              WHEN MAX(CASE WHEN ps.id_jenis_pelanggaran = 1 THEN 1 END) IS NOT NULL
                  THEN 'alfa'

              ELSE 'belum absen'
          END AS status

      FROM siswa s
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON ta.id = sta.id_tahun_ajaran

      LEFT JOIN absensi a
        ON a.id_siswa = s.id
    `;

    // DATE FILTER (ABSENSI JOIN SAFE)
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      sql += `
        AND a.created_at >= ?
        AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `;

      params.push(date, date);
    }

    sql += `
      LEFT JOIN pelanggaran_siswa ps
        ON ps.id_siswa = s.id
        AND ps.id_tahun_ajaran = ta.id
        AND ps.id_jenis_pelanggaran = 1
    `;

    if (date) {
      sql += ` AND DATE(ps.tanggal) = ? `;
      params.push(date);
    }

    sql += `
      WHERE ta.tahun_ajaran = ?
        AND ta.semester = ?
    `;

    params.push(tahun_ajaran, semester);

    if (tingkat) {
      sql += ` AND sta.kelas LIKE ? `;
      params.push(`%${tingkat}%`);
    }

    if (kelas) {
      sql += ` AND sta.kelas = ? `;
      params.push(kelas);
    }

    if (search) {
      sql += ` AND (s.nama LIKE ? OR s.nisn LIKE ?) `;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += `
      GROUP BY s.id, s.nama, sta.kelas
      ORDER BY sta.kelas, s.nama
    `;

    const [rows] = await db.query(sql, params);

    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
