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
      SELECT COUNT(*) AS total
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

        COUNT(DISTINCT a.id) AS total_hadir,

        SUM(CASE WHEN ps.status = 'izin' THEN 1 ELSE 0 END) AS total_izin,
        SUM(CASE WHEN ps.status = 'sakit' THEN 1 ELSE 0 END) AS total_sakit,
        SUM(CASE WHEN ps.status = 'alpha' THEN 1 ELSE 0 END) AS total_alpha,

        SUM(
          CASE
            WHEN a.id IS NOT NULL AND TIME(a.created_at) > '07:00:00'
            THEN 1
            ELSE 0
          END
        ) AS total_terlambat

      FROM siswa s
      LEFT JOIN absensi a ON a.id_siswa = s.id
      LEFT JOIN perizinan_siswa ps ON ps.id_siswa = s.id
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ${whereClause}
      GROUP BY s.id
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
