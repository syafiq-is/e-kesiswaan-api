import db from "../lib/database.js";

export const getRekapKehadiran = async (req, res) => {
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

    // Optional filter kelas
    if (kelas) {
      whereClause += " AND s.kelas = ?";
      filterValues.push(kelas);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM siswa s
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    const dataQuery = `
      SELECT
        s.nisn,
        s.nama,
        s.jenis_kelamin,
        s.kelas,

        COALESCE(a.total_hadir,0) AS total_hadir,
        COALESCE(a.total_terlambat,0) AS total_terlambat,

        COALESCE(p.total_izin,0) AS total_izin,
        COALESCE(p.total_sakit,0) AS total_sakit,
        COALESCE(p.total_alpha,0) AS total_alpha

      FROM siswa s

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

      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
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
