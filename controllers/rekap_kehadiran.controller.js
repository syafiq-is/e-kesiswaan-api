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

    // Filter date
    if (date) {
      whereClause += `
        AND a.created_at >= ?
        AND a.created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `;
      filterValues.push(date, date);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM siswa s
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON sta.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        s.id,
        s.nisn,
        s.nama,
        s.jenis_kelamin,
        sta.kelas,

        COALESCE(a.total_hadir,0) AS total_hadir,
        COALESCE(a.total_terlambat,0) AS total_terlambat,

        COALESCE(p.total_izin,0) AS total_izin,
        COALESCE(p.total_sakit,0) AS total_sakit,
        COALESCE(p.total_alpha,0) AS total_alpha

      FROM siswa s 
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON sta.id_tahun_ajaran = ta.id

      LEFT JOIN (
        SELECT
          a.id_siswa,
          COUNT(*) AS total_hadir,
          SUM(TIME(a.created_at) > '07:00:00') AS total_terlambat
        FROM absensi a
        JOIN tahun_ajaran ta2 ON a.id_tahun_ajaran = ta2.id
        WHERE 1=1
        ${tahun_ajaran ? "AND ta2.tahun_ajaran = ?" : ""}
        ${semester ? "AND ta2.semester = ?" : ""}
        GROUP BY a.id_siswa
      ) a ON a.id_siswa = s.id

      LEFT JOIN (
        SELECT
          id_siswa,
          SUM(status='izin') AS total_izin,
          SUM(status='sakit') AS total_sakit,
          SUM(status='alpha') AS total_alpha
        FROM perizinan_siswa
        GROUP BY id_siswa
      ) p ON p.id_siswa = s.id

      ${whereClause}

      ORDER BY s.nama ASC
      LIMIT ? OFFSET ?
    `;

    const [[{ total }]] = await db.query(countQuery, filterValues);

    const absensiFilters = [];
    if (tahun_ajaran) absensiFilters.push(tahun_ajaran);
    if (semester) absensiFilters.push(semester);

    const [rows] = await db.query(dataQuery, [
      ...absensiFilters,
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
