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
      bulan,
      month,
    } = req.query;

    // ── 1. VALIDASI PARAMETER ──
    if (!tahun_ajaran || !semester) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const offset = (pageNumber - 1) * limitNumber;

    // ── 2. LOGIKA PENENTUAN TAHUN BERDASARKAN BULAN AKADEMIK ──
    const parts = tahun_ajaran.split("/");
    const yearStart = parseInt(parts[0]) || new Date().getFullYear();
    const yearEnd = parts[1] ? parseInt(parts[1]) : yearStart + 1;

    // Ambil target bulan (default ke bulan berjalan jika tidak dikirim dari Laravel)
    const targetBulan = parseInt(bulan || month || new Date().getMonth() + 1);

    // Jika bulan Juli-Desember ikut tahun awal (ex: 2025), Januari-Juni ikut tahun akhir (ex: 2026)
    const targetYear = targetBulan >= 7 ? yearStart : yearEnd;
    const daysInMonth = new Date(targetYear, targetBulan, 0).getDate(); // Mendapatkan total hari di bulan tersebut

    // ── 3. QUERY BUILDER (FILTER KELAS & SEARCH) ──
    let whereClause = "WHERE 1=1 AND ta.tahun_ajaran = ? AND ta.semester = ?";
    const filterValues = [tahun_ajaran, semester];

    if (tingkat) {
      whereClause += " AND (sta.kelas LIKE ?)";
      filterValues.push(`%${tingkat}%`);
    }

    if (kelas) {
      whereClause += " AND sta.kelas = ?";
      filterValues.push(kelas);
    }

    if (search) {
      whereClause += " AND (s.nama LIKE ? OR s.nisn LIKE ?)";
      filterValues.push(`%${search}%`, `%${search}%`);
    }

    // ── 4. FILTER BULAN & TAHUN UNTUK AKUMULASI TOTAL SUMMARY ──
    let absensiWhere = `
      WHERE ta2.tahun_ajaran = ?
      AND ta2.semester = ?
      AND MONTH(a.created_at) = ?
      AND YEAR(a.created_at) = ?
    `;
    const absensiValues = [tahun_ajaran, semester, targetBulan, targetYear];

    let perizinanWhere = `
      WHERE ta3.tahun_ajaran = ?
      AND ta3.semester = ?
      AND MONTH(p.tanggal) = ?
      AND YEAR(p.tanggal) = ?
    `;
    const perizinanValues = [tahun_ajaran, semester, targetBulan, targetYear];

    let pelanggaranWhere = `
      WHERE ta4.tahun_ajaran = ?
      AND ta4.semester = ?
      AND MONTH(ps.tanggal) = ?
      AND YEAR(ps.tanggal) = ?
    `;
    const pelanggaranValues = [tahun_ajaran, semester, targetBulan, targetYear];

    const countQuery = `
      SELECT COUNT(DISTINCT s.id) AS total
      FROM siswa s
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON sta.id_tahun_ajaran = ta.id
      ${whereClause}
    `;

    // ── 5. RAKIT MATRIKS STATUS HARIAN DINAMIS (H / I / S / A) ──
    let selectDays = "";
    for (let d = 1; d <= daysInMonth; d++) {
      selectDays += `
        COALESCE(
          (
            SELECT CASE 
              WHEN status = 'terlambat' THEN 'H'
              WHEN status = 'tepat waktu' THEN 'H'
              ELSE 'H'
            END 
            FROM absensi 
            WHERE id_siswa = s.id AND id_tahun_ajaran = ta.id AND DAY(created_at) = ${d} AND MONTH(created_at) = ${targetBulan} AND YEAR(created_at) = ${targetYear}
            LIMIT 1
          ),
          (
            SELECT CASE 
              WHEN status = 'izin' THEN 'I'
              WHEN status = 'sakit' THEN 'S'
            END 
            FROM perizinan_siswa 
            WHERE id_siswa = s.id AND id_tahun_ajaran = ta.id AND DAY(tanggal) = ${d} AND MONTH(tanggal) = ${targetBulan} AND YEAR(tanggal) = ${targetYear}
            LIMIT 1
          ),
          (
            SELECT 'A' 
            FROM pelanggaran_siswa 
            WHERE id_siswa = s.id AND id_tahun_ajaran = ta.id AND id_jenis_pelanggaran = 1 AND DAY(tanggal) = ${d} AND MONTH(tanggal) = ${targetBulan} AND YEAR(tanggal) = ${targetYear}
            LIMIT 1
          ),
          '-'
        ) AS \`d${d}\`,\n`;
    }

    // Pastikan mengisi nilai default 0 / '-' jika jumlah hari < 31 (ex: Februari) agar output blade Laravel kawan tidak error "Undefined index d30/d31"
    for (let d = daysInMonth + 1; d <= 31; d++) {
      selectDays += `'-' AS \`d${d}\`,\n`;
    }

    // ── 6. MAIN DATA QUERY ──
    const dataQuery = `
      SELECT
        s.id,
        s.nisn,
        s.nama,
        s.jenis_kelamin,
        sta.kelas,

        ${selectDays}

        COALESCE(a.total_hadir, 0) AS total_hadir,
        COALESCE(a.total_terlambat, 0) AS total_terlambat,
        COALESCE(p.total_izin, 0) AS total_izin,
        COALESCE(p.total_sakit, 0) AS total_sakit,
        COALESCE(ps.total_alpha, 0) AS total_alpha

      FROM siswa s
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON sta.id_tahun_ajaran = ta.id

      LEFT JOIN (
        SELECT
          a.id_siswa,
          COUNT(DISTINCT DATE(a.created_at)) AS total_hadir,
          SUM(a.status = 'terlambat') AS total_terlambat
        FROM absensi a
        JOIN tahun_ajaran ta2 ON a.id_tahun_ajaran = ta2.id
        ${absensiWhere}
        GROUP BY a.id_siswa
      ) a ON a.id_siswa = s.id

      LEFT JOIN (
        SELECT
          p.id_siswa,
          SUM(p.status = 'izin') AS total_izin,
          SUM(p.status = 'sakit') AS total_sakit
        FROM perizinan_siswa p
        JOIN tahun_ajaran ta3 ON p.id_tahun_ajaran = ta3.id
        ${perizinanWhere}
        GROUP BY p.id_siswa
      ) p ON p.id_siswa = s.id

      LEFT JOIN (
        SELECT
          ps.id_siswa,
          SUM(ps.id_jenis_pelanggaran = 1) AS total_alpha
        FROM pelanggaran_siswa ps
        JOIN tahun_ajaran ta4 ON ps.id_tahun_ajaran = ta4.id
        ${pelanggaranWhere}
        GROUP BY ps.id_siswa
      ) ps ON ps.id_siswa = s.id

      ${whereClause}
      ORDER BY s.nama ASC
      LIMIT ? OFFSET ?
    `;

    // ── 7. EKSEKUSI KUERI & RETURN RESPONSE ──
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
    console.error("Error at getRekapKehadiran:", err);
    res.status(500).json({ message: "Server error" });
  }
};
