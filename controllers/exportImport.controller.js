import db from "../lib/database.js";
import ExcelJS from "exceljs";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoPath = path.join(__dirname, "../assets/logo_sekolah.png");
const logoBase64 = fs.readFileSync(logoPath).toString("base64");

const usePDFTemplate = (data) => {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Rekap Absensi</title>
    <style>
      body {
        font-family: "Times New Roman", serif;
        background: #ffffff;
      }

      .container {
        width: 700px;
        margin: 30px auto;
        text-align: center;
      }

      .header {
        position: relative;
        margin-bottom: 10px;
      }

      .header img {
        width: 80px;
        position: absolute;
        left: 10px;
        top: 10px;
      }

      .header h2,
      .header h3,
      .header h4 {
        margin: 2px 0;
      }

      .alamat {
        max-width: 70%;
        margin: 15px auto;
      }

      .line {
        border-top: 2px solid black;
        margin: 15px 0;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        text-align: center;
      }

      th,
      td {
        border: 1px solid black;
        padding: 5px;
      }

      th {
        background-color: #00e0d1;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="data:image/png;base64,${logoBase64}" width="80">

        <h3>PEMERINTAH KABUPATEN KLATEN</h3>
        <h3>DINAS PENDIDIKAN</h3>
        <h2>SMP NEGERI 1 POLANHARJO</h2>
        <p class="alamat">
          Padan, Kahuman, Polanharjo, Klaten; Telp/Fax : 0272-552013 / 0272 -
          557388; e-mail :
        </p>
      </div>

      <div class="line"></div>

      ${data}
    </div>
  </body>
</html>
`;

  return html;
};

/* Export Excel Functions */
export const exportRekapKehadiranExcel = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

    // =========================
    // GET TAHUN AJARAN DETAIL
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

    // ==================================
    // DETERMINE MONTH RANGE BY SEMESTER
    // ==================================

    // Example:
    // Ganjil -> Jul-Dec
    // Genap  -> Jan-Jun

    const tahunMulai = Number(tahun_ajaran.split("/")[0]);
    const tahunSelesai = Number(tahun_ajaran.split("/")[1]);

    let months = [];

    if (semester === "Ganjil") {
      months = [
        { month: 7, year: tahunMulai, label: "Juli" },
        { month: 8, year: tahunMulai, label: "Agustus" },
        { month: 9, year: tahunMulai, label: "September" },
        { month: 10, year: tahunMulai, label: "Oktober" },
        { month: 11, year: tahunMulai, label: "November" },
        { month: 12, year: tahunMulai, label: "Desember" },
      ];
    } else {
      months = [
        { month: 1, year: tahunSelesai, label: "Januari" },
        { month: 2, year: tahunSelesai, label: "Februari" },
        { month: 3, year: tahunSelesai, label: "Maret" },
        { month: 4, year: tahunSelesai, label: "April" },
        { month: 5, year: tahunSelesai, label: "Mei" },
        { month: 6, year: tahunSelesai, label: "Juni" },
      ];
    }

    // =========================
    // FILTER
    // =========================

    let whereClause = `
      WHERE sta.id_tahun_ajaran = ?
    `;

    const filterValues = [tahunAjaranData.id];

    if (tingkat) {
      whereClause += ` AND sta.kelas LIKE ?`;
      filterValues.push(`%${tingkat}%`);
    }

    if (kelas) {
      whereClause += ` AND sta.kelas = ?`;
      filterValues.push(kelas);
    }

    // =========================
    // EXCEL
    // =========================

    const workbook = new ExcelJS.Workbook();

    // =========================
    // LOOP EACH MONTH
    // =========================

    for (const item of months) {
      const { month, year, label } = item;

      const daysInMonth = new Date(year, month, 0).getDate();

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

      const nextMonthDate =
        month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      // =========================
      // BUILD DYNAMIC DAY COLUMNS
      // =========================

      let selectDays = "";

      for (let d = 1; d <= daysInMonth; d++) {
        selectDays += `
          COALESCE(
            MAX(
              CASE
                WHEN DAY(a.tanggal) = ${d}
                THEN a.hadir
              END
            ),
            0
          ) AS \`${d}\`,
        `;
      }

      // =========================
      // QUERY
      // =========================

      const query = `
        SELECT
          s.nisn,
          s.nama,
          s.jenis_kelamin,
          sta.kelas,

          ${selectDays}

          COALESCE(att.total_hadir, 0) AS total_hadir,
          COALESCE(att.total_terlambat, 0) AS total_terlambat,

          COALESCE(iz.total_izin, 0) AS total_izin,
          COALESCE(iz.total_sakit, 0) AS total_sakit,

          COALESCE(pl.total_alpha, 0) AS total_alpha

        FROM siswa s

        JOIN siswa_tahun_ajaran sta
          ON sta.id_siswa = s.id

        LEFT JOIN (

          SELECT
            id_siswa,
            id_tahun_ajaran,
            DATE(created_at) AS tanggal,

            CASE
              WHEN COUNT(DISTINCT tipe_absensi) = 2
              THEN 1
              ELSE 0
            END AS hadir

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

        LEFT JOIN (
          SELECT
            id_siswa,
            SUM(CASE WHEN tipe_absensi = 'pulang' THEN 1 ELSE 0 END) AS total_hadir,
            SUM(status = 'terlambat') AS total_terlambat
          FROM absensi
          WHERE id_tahun_ajaran = ?
            AND created_at >= ?
            AND created_at < ?
          GROUP BY id_siswa
        ) att
          ON att.id_siswa = s.id

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

        LEFT JOIN (
          SELECT
            id_siswa,
            SUM(id_jenis_pelanggaran = 1) AS total_alpha
          FROM pelanggaran_siswa
          WHERE id_tahun_ajaran = ?
            AND tanggal >= ?
            AND tanggal < ?
          GROUP BY id_siswa
        ) pl
          ON pl.id_siswa = s.id

        ${whereClause}

        GROUP BY
          s.id,
          s.nisn,
          s.nama,
          s.jenis_kelamin,
          sta.kelas

        ORDER BY
          sta.kelas ASC,
          s.nama ASC
      `;

      const [rows] = await db.query(query, [
        // attendance matrix
        tahunAjaranData.id,
        startDate,
        nextMonthDate,

        // attendance summary
        tahunAjaranData.id,
        startDate,
        nextMonthDate,

        // izin sakit
        tahunAjaranData.id,
        startDate,
        nextMonthDate,

        // alpha
        tahunAjaranData.id,
        startDate,
        nextMonthDate,

        // filter
        ...filterValues,
      ]);

      // =========================
      // CREATE SHEET
      // =========================

      const worksheet = workbook.addWorksheet(`${label} ${year}`);

      // =========================
      // BUILD COLUMNS
      // =========================

      const columns = [
        { header: "NISN", key: "nisn", width: 18 },
        { header: "Nama", key: "nama", width: 28 },
        { header: "JK", key: "jenis_kelamin", width: 8 },
        { header: "Kelas", key: "kelas", width: 10 },
      ];

      // dynamic dates
      for (let d = 1; d <= daysInMonth; d++) {
        columns.push({
          header: String(d),
          key: String(d),
          width: 5,
        });
      }

      // summary columns
      columns.push(
        { header: "Hadir", key: "total_hadir", width: 10 },
        { header: "Terlambat", key: "total_terlambat", width: 12 },
        { header: "Izin", key: "total_izin", width: 10 },
        { header: "Sakit", key: "total_sakit", width: 10 },
        { header: "Alpha", key: "total_alpha", width: 10 },
      );

      // ======================================
      // TOTAL DATE COLUMNS
      // ======================================

      const startTanggalCol = 5;
      const endTanggalCol = startTanggalCol + daysInMonth - 1;

      const startJumlahCol = endTanggalCol + 1;
      const endJumlahCol = startJumlahCol + 4;

      // ======================================
      // MERGED HEADER
      // ======================================

      // static columns
      worksheet.mergeCells("A1:A2");
      worksheet.mergeCells("B1:B2");
      worksheet.mergeCells("C1:C2");
      worksheet.mergeCells("D1:D2");

      // tanggal group
      worksheet.mergeCells(1, startTanggalCol, 1, endTanggalCol);

      // jumlah group
      worksheet.mergeCells(1, startJumlahCol, 1, endJumlahCol);

      // ======================================
      // HEADER VALUES
      // ======================================

      worksheet.getCell("A1").value = "NISN";
      worksheet.getCell("B1").value = "Nama";
      worksheet.getCell("C1").value = "JK";
      worksheet.getCell("D1").value = "Kelas";

      worksheet.getCell(1, startTanggalCol).value = "Tanggal";
      worksheet.getCell(1, startJumlahCol).value = "Jumlah";

      // ======================================
      // DATE HEADER
      // ======================================

      for (let d = 1; d <= daysInMonth; d++) {
        worksheet.getCell(2, startTanggalCol + d - 1).value = d;
      }

      // ======================================
      // SUMMARY HEADER
      // ======================================

      worksheet.getCell(2, startJumlahCol).value = "Hadir";
      worksheet.getCell(2, startJumlahCol + 1).value = "Terlambat";
      worksheet.getCell(2, startJumlahCol + 2).value = "Izin";
      worksheet.getCell(2, startJumlahCol + 3).value = "Sakit";
      worksheet.getCell(2, startJumlahCol + 4).value = "Alpha";

      // ======================================
      // HEADER STYLE
      // ======================================

      const headerRows = [1, 2];

      headerRows.forEach((rowNumber) => {
        const row = worksheet.getRow(rowNumber);

        row.font = {
          bold: true,
        };

        row.alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      });

      // ======================================
      // COLUMN WIDTHS
      // ======================================

      worksheet.getColumn("A").width = 18;
      worksheet.getColumn("B").width = 28;
      worksheet.getColumn("C").width = 8;
      worksheet.getColumn("D").width = 10;

      // tanggal columns
      for (let col = startTanggalCol; col <= endTanggalCol; col++) {
        worksheet.getColumn(col).width = 5;
      }

      // jumlah columns
      for (let col = startJumlahCol; col <= endJumlahCol; col++) {
        worksheet.getColumn(col).width = 12;
      }

      // ======================================
      // INSERT DATA
      // ======================================

      let currentRow = 3;

      rows.forEach((row) => {
        const rowData = [row.nisn, row.nama, row.jenis_kelamin, row.kelas];

        // tanggal
        for (let d = 1; d <= daysInMonth; d++) {
          rowData.push(row[d] ?? 0);
        }

        // jumlah
        rowData.push(
          row.total_hadir,
          row.total_terlambat,
          row.total_izin,
          row.total_sakit,
          row.total_alpha,
        );

        worksheet.insertRow(currentRow, rowData);

        currentRow++;
      });

      // ======================================
      // FREEZE HEADER
      // ======================================

      worksheet.views = [
        {
          state: "frozen",
          ySplit: 2,
        },
      ];
    }

    // =========================
    // RESPONSE
    // =========================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=rekap_kehadiran_${tahun_ajaran}_${semester}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportPelanggaranExcel = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

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
    const [rows] = await db.query(
      `
      SELECT
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
        jp.poin
      FROM pelanggaran_siswa ps
      JOIN tahun_ajaran ta ON ps.id_tahun_ajaran = ta.id
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN jenis_pelanggaran jp ON ps.id_jenis_pelanggaran = jp.id
      ${whereClause}
      ORDER BY jp.poin DESC
    `,
      filterValues,
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Pelanggaran");

    worksheet.columns = [
      { header: "Tanggal", key: "tanggal", width: 20 },
      { header: "Nama", key: "nama_siswa", width: 25 },
      { header: "NISN", key: "nisn", width: 20 },
      { header: "Kelas", key: "kelas", width: 10 },
      { header: "Pelanggaran", key: "pelanggaran", width: 30 },
      { header: "Poin", key: "poin", width: 10 },
      { header: "Keterangan", key: "keterangan", width: 30 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=data_pelanggaran.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportPrestasiExcel = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

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

    const [rows] = await db.query(
      `
      SELECT
        p.nama_lomba,
        p.tanggal,
        p.kategori,
        p.tingkat,
        p.peringkat,
        s.nama AS nama_siswa,
        s.nisn,
        ta.tahun_ajaran
      FROM prestasi_siswa p
      JOIN siswa s ON p.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON p.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY p.tanggal DESC
    `,
      filterValues,
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Prestasi");

    worksheet.columns = [
      { header: "Tanggal", key: "tanggal", width: 20 },
      { header: "Nama", key: "nama_siswa", width: 25 },
      { header: "NISN", key: "nisn", width: 20 },
      { header: "Nama Lomba", key: "nama_lomba", width: 30 },
      { header: "Kategori", key: "kategori", width: 20 },
      { header: "Tingkat", key: "tingkat", width: 20 },
      { header: "Peringkat", key: "peringkat", width: 15 },
      { header: "Tahun Ajaran", key: "tahun_ajaran", width: 15 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=data_prestasi.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportSiswaExcel = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

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

    const [rows] = await db.query(
      `SELECT
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
      ORDER BY sta.kelas ASC, s.nama ASC`,
      filterValues,
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Siswa");

    // Define columns
    worksheet.columns = [
      { header: "Nama", key: "nama", width: 25 },
      { header: "NIPD", key: "nipd", width: 15 },
      { header: "NIK", key: "nik", width: 20 },
      { header: "NISN", key: "nisn", width: 15 },
      { header: "Kelas", key: "kelas", width: 10 },
      { header: "Jenis Kelamin", key: "jenis_kelamin", width: 15 },
      { header: "Agama", key: "agama", width: 15 },
      { header: "Tempat Lahir", key: "tempat_lahir", width: 20 },
      { header: "Tanggal Lahir", key: "tanggal_lahir", width: 15 },
      { header: "Alamat", key: "alamat", width: 30 },
      { header: "RT", key: "rt", width: 8 },
      { header: "RW", key: "rw", width: 8 },
      { header: "Dusun", key: "dusun", width: 20 },
      { header: "Kelurahan", key: "kelurahan", width: 20 },
      { header: "Kecamatan", key: "kecamatan", width: 20 },
      { header: "Kode Pos", key: "kode_pos", width: 12 },
      { header: "Nama Ayah", key: "nama_ayah", width: 20 },
      { header: "Pekerjaan Ayah", key: "pekerjaan_ayah", width: 20 },
      { header: "Nama Ibu", key: "nama_ibu", width: 20 },
      { header: "Pekerjaan Ibu", key: "pekerjaan_ibu", width: 20 },
      { header: "Nama Wali", key: "nama_wali", width: 20 },
      { header: "Pekerjaan Wali", key: "pekerjaan_wali", width: 20 },
      { header: "No Telepon", key: "no_telepon", width: 15 },
      { header: "Tahun Ajaran", key: "tahun_ajaran", width: 20 },
    ];

    // Add rows
    rows.forEach((row) => {
      worksheet.addRow(row);
    });

    // Set header style bold
    worksheet.getRow(1).font = { bold: true };

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=data_siswa.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportSiswaExcelTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Template Data Siswa");

    worksheet.columns = [
      { header: "Nama", key: "nama", width: 25 },
      { header: "NIPD", key: "nipd", width: 15 },
      { header: "NIK", key: "nik", width: 20 },
      { header: "NISN", key: "nisn", width: 15 },
      { header: "Kelas", key: "kelas", width: 10 },
      { header: "Jenis Kelamin", key: "jenis_kelamin", width: 15 },
      { header: "Agama", key: "agama", width: 15 },
      { header: "Tempat Lahir", key: "tempat_lahir", width: 20 },
      { header: "Tanggal Lahir", key: "tanggal_lahir", width: 15 },
      { header: "Alamat", key: "alamat", width: 30 },
      { header: "RT", key: "rt", width: 8 },
      { header: "RW", key: "rw", width: 8 },
      { header: "Dusun", key: "dusun", width: 20 },
      { header: "Kelurahan", key: "kelurahan", width: 20 },
      { header: "Kecamatan", key: "kecamatan", width: 20 },
      { header: "Kode Pos", key: "kode_pos", width: 12 },
      { header: "Nama Ayah", key: "nama_ayah", width: 20 },
      { header: "Pekerjaan Ayah", key: "pekerjaan_ayah", width: 20 },
      { header: "Nama Ibu", key: "nama_ibu", width: 20 },
      { header: "Pekerjaan Ibu", key: "pekerjaan_ibu", width: 20 },
      { header: "Nama Wali", key: "nama_wali", width: 20 },
      { header: "Pekerjaan Wali", key: "pekerjaan_wali", width: 20 },
      { header: "No Telepon", key: "no_telepon", width: 15 },
      { header: "Tahun Ajaran", key: "tahun_ajaran", width: 20 },
    ];

    // Make header bold
    worksheet.getRow(1).font = { bold: true };

    // Send file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=template_data_siswa.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* Export PDF Functions */
export const exportRekapKehadiranPDF = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester) {
      return res.status(400).json({
        message: "Required fields missing",
      });
    }

    // Query Builder
    let whereClause = `
      WHERE 1=1
      AND ta.tahun_ajaran = ?
      AND ta.semester = ?
    `;

    const filterValues = [tahun_ajaran, semester];

    // Filter tingkat
    if (tingkat) {
      whereClause += ` AND sta.kelas LIKE ?`;
      filterValues.push(`%${tingkat}%`);
    }

    // Filter kelas
    if (kelas) {
      whereClause += ` AND sta.kelas = ?`;
      filterValues.push(kelas);
    }

    const query = `
      SELECT
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

          COUNT(*) AS total_hadir,

          SUM(a.status = 'terlambat') AS total_terlambat

        FROM absensi a

        JOIN tahun_ajaran ta2
          ON a.id_tahun_ajaran = ta2.id

        WHERE ta2.tahun_ajaran = ?
        AND ta2.semester = ?

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

        WHERE ta3.tahun_ajaran = ?
        AND ta3.semester = ?

        GROUP BY p.id_siswa
      ) p ON p.id_siswa = s.id

      LEFT JOIN (
        SELECT
          ps.id_siswa,

          SUM(ps.id_jenis_pelanggaran = 1) AS total_alpha

        FROM pelanggaran_siswa ps

        JOIN tahun_ajaran ta4
          ON ps.id_tahun_ajaran = ta4.id

        WHERE ta4.tahun_ajaran = ?
        AND ta4.semester = ?

        GROUP BY ps.id_siswa
      ) ps ON ps.id_siswa = s.id

      ${whereClause}

      ORDER BY sta.kelas ASC, s.nama ASC
    `;

    const [rows] = await db.query(query, [
      // absensi
      tahun_ajaran,
      semester,

      // perizinan
      tahun_ajaran,
      semester,

      // pelanggaran
      tahun_ajaran,
      semester,

      // main query
      ...filterValues,
    ]);

    const html = usePDFTemplate(`
      <h2 style="text-align:center;">
        DATA REKAP KEHADIRAN
      </h2>

      <table border="1" cellspacing="0" cellpadding="4" width="100%">
        <tr>
          <th>No</th>
          <th>NISN</th>
          <th>Nama</th>
          <th>Jenis Kelamin</th>
          <th>Kelas</th>
          <th>Total Hadir</th>
          <th>Total Izin</th>
          <th>Total Sakit</th>
          <th>Total Alpha</th>
          <th>Total Terlambat</th>
        </tr>

        ${rows
          .map(
            (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.nisn}</td>
            <td>${r.nama}</td>
            <td>${r.jenis_kelamin}</td>
            <td>${r.kelas}</td>
            <td>${r.total_hadir}</td>
            <td>${r.total_izin}</td>
            <td>${r.total_sakit}</td>
            <td>${r.total_alpha}</td>
            <td>${r.total_terlambat}</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    `);

    const browser = await puppeteer.launch({
      headless: "new",
    });

    const page = await browser.newPage();

    await page.setContent(html);

    const pdf = await page.pdf({
      format: "A4",
      landscape: false,
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=rekap_kehadiran.pdf",
    });

    res.send(pdf);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "Server error",
    });
  }
};

export const exportPelanggaranPDF = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

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

    const [rows] = await db.query(
      `
      SELECT
        ps.tanggal,
        ps.keterangan,
        s.nama AS nama_siswa,
        s.nisn,
        sta.kelas,
        jp.pelanggaran,
        jp.poin
      FROM pelanggaran_siswa ps
      JOIN tahun_ajaran ta ON ps.id_tahun_ajaran = ta.id
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN jenis_pelanggaran jp ON ps.id_jenis_pelanggaran = jp.id
      ${whereClause}
      ORDER BY jp.poin DESC
    `,
      filterValues,
    );

    const html = usePDFTemplate(`
      <h2 style="text-align:center;">DATA PELANGGARAN</h2>
      <table border="1" cellspacing="0" cellpadding="4" width="100%">
        <tr>
          <th>No</th>
          <th>Tanggal</th>
          <th>Nama</th>
          <th>NISN</th>
          <th>Kelas</th>
          <th>Pelanggaran</th>
          <th>Poin</th>
          <th>Keterangan</th>
        </tr>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.tanggal}</td>
            <td>${r.nama_siswa}</td>
            <td>${r.nisn}</td>
            <td>${r.kelas}</td>
            <td>${r.pelanggaran}</td>
            <td>${r.poin}</td>
            <td>${r.keterangan ?? "-"}</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    `);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: "A4", landscape: false });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=data_pelanggaran.pdf",
    });

    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportPrestasiPDF = async (req, res) => {
  try {
    const { tahun_ajaran, semester, tingkat, kelas } = req.query;

    // Required Field
    if (!tahun_ajaran || !semester)
      return res.status(400).json({ message: "Required fields missing" });

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

    const [rows] = await db.query(
      `
      SELECT
        p.nama_lomba,
        p.tanggal,
        p.kategori,
        p.tingkat,
        p.peringkat,
        s.nama AS nama_siswa,
        s.nisn,
        ta.tahun_ajaran
      FROM prestasi_siswa p
      JOIN siswa s ON p.id_siswa = s.id
      JOIN siswa_tahun_ajaran sta ON sta.id_siswa = s.id
      JOIN tahun_ajaran ta ON p.id_tahun_ajaran = ta.id
      ${whereClause}
      ORDER BY p.tanggal DESC
    `,
      filterValues,
    );

    const html = usePDFTemplate(`
      <h2 style="text-align:center;">DATA PRESTASI</h2>
      <table border="1" cellspacing="0" cellpadding="4" width="100%">
        <tr>
          <th>No</th>
          <th>Tanggal</th>
          <th>Nama</th>
          <th>NISN</th>
          <th>Nama Lomba</th>
          <th>Kategori</th>
          <th>Tingkat</th>
          <th>Peringkat</th>
          <th>Tahun Ajaran</th>
        </tr>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.tanggal}</td>
            <td>${r.nama_siswa}</td>
            <td>${r.nisn}</td>
            <td>${r.nama_lomba}</td>
            <td>${r.kategori}</td>
            <td>${r.tingkat}</td>
            <td>${r.peringkat}</td>
            <td>${r.tahun_ajaran}</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    `);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: "A4", landscape: false });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=data_prestasi.pdf",
    });

    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Import Functions */
export const importSiswaExcel = async (req, res) => {
  const connection = await db.getConnection();

  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Excel file is required",
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.getWorksheet(1);

    const siswaData = [];
    const errors = [];

    const nipdSet = new Set();
    const nisnSet = new Set();

    const tahunAjaranCache = new Map();

    const rows = worksheet.getRows(2, worksheet.rowCount - 1);

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;

      const v = rows[i].values;

      if (!v || v.length <= 1) continue;

      const nama = v[1]?.toString().trim();
      const nipd = v[2]?.toString().trim();
      const nik = v[3]?.toString().trim();
      const nisn = v[4]?.toString().trim();
      const kelas = v[5]?.toString().trim();
      const jenis_kelamin = v[6]?.toString().trim();
      const agama = v[7]?.toString().trim();

      const tempat_lahir = v[8]?.toString().trim() || null;
      const tanggal_lahir = v[9] || null;
      const alamat = v[10]?.toString().trim() || null;
      const rt = v[11]?.toString().trim() || null;
      const rw = v[12]?.toString().trim() || null;
      const dusun = v[13]?.toString().trim() || null;
      const kelurahan = v[14]?.toString().trim() || null;
      const kecamatan = v[15]?.toString().trim() || null;
      const kode_pos = v[16]?.toString().trim() || null;
      const nama_ayah = v[17]?.toString().trim() || null;
      const pekerjaan_ayah = v[18]?.toString().trim() || null;
      const nama_ibu = v[19]?.toString().trim() || null;
      const pekerjaan_ibu = v[20]?.toString().trim() || null;
      const nama_wali = v[21]?.toString().trim() || null;
      const pekerjaan_wali = v[22]?.toString().trim() || null;
      const no_telepon = v[23]?.toString().trim() || null;
      const tahun_ajaran_nama = v[24]?.toString().trim();

      /* =========================
         REQUIRED VALIDATION
         ========================= */

      if (
        !nama ||
        !nipd ||
        !nik ||
        !nisn ||
        !kelas ||
        !jenis_kelamin ||
        !agama ||
        !tahun_ajaran_nama
      ) {
        errors.push(`Row ${rowNumber}: Required fields missing`);
        continue;
      }

      if (!["L", "P"].includes(jenis_kelamin)) {
        errors.push(`Row ${rowNumber}: Jenis Kelamin must be L or P`);
        continue;
      }

      if (!/^\d+$/.test(nipd)) {
        errors.push(`Row ${rowNumber}: NIPD must be numeric`);
        continue;
      }

      if (!/^\d+$/.test(nik)) {
        errors.push(`Row ${rowNumber}: NIK must be numeric`);
        continue;
      }

      if (!/^\d+$/.test(nisn)) {
        errors.push(`Row ${rowNumber}: NISN must be numeric`);
        continue;
      }

      if (nipdSet.has(nipd)) {
        errors.push(`Row ${rowNumber}: Duplicate NIPD in file`);
        continue;
      }

      if (nisnSet.has(nisn)) {
        errors.push(`Row ${rowNumber}: Duplicate NISN in file`);
        continue;
      }

      nipdSet.add(nipd);
      nisnSet.add(nisn);

      /* =========================
         VALIDATE TAHUN AJARAN
         ========================= */

      let id_tahun_ajaran;

      if (tahunAjaranCache.has(tahun_ajaran_nama)) {
        id_tahun_ajaran = tahunAjaranCache.get(tahun_ajaran_nama);
      } else {
        const [tahunRows] = await connection.query(
          `
            SELECT id
            FROM tahun_ajaran
            WHERE tahun_ajaran = ?
          `,
          [tahun_ajaran_nama],
        );

        if (tahunRows.length === 0) {
          errors.push(`Row ${rowNumber}: Tahun Ajaran not found`);
          continue;
        }

        id_tahun_ajaran = tahunRows[0].id;

        tahunAjaranCache.set(tahun_ajaran_nama, id_tahun_ajaran);
      }

      siswaData.push({
        nama,
        nipd,
        nik,
        nisn,
        kelas,
        jenis_kelamin,
        agama,
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
        id_tahun_ajaran,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors,
      });
    }

    if (siswaData.length === 0) {
      return res.status(400).json({
        message: "No valid data found",
      });
    }

    /* =========================
       CHECK DUPLICATES DB
       ========================= */

    const [existing] = await connection.query(
      `
      SELECT nipd, nisn
      FROM siswa
      WHERE nipd IN (?) OR nisn IN (?)
    `,
      [[...nipdSet], [...nisnSet]],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Duplicate NIPD/NISN found in database",
        duplicates: existing,
      });
    }

    await connection.beginTransaction();

    /* =========================
       INSERT SISWA
       ========================= */

    const siswaValues = siswaData.map((s) => [
      s.nama,
      s.nipd,
      s.nik,
      s.nisn,
      s.jenis_kelamin,
      s.agama,
      s.tempat_lahir,
      s.tanggal_lahir,
      s.alamat,
      s.rt,
      s.rw,
      s.dusun,
      s.kelurahan,
      s.kecamatan,
      s.kode_pos,
      s.nama_ayah,
      s.pekerjaan_ayah,
      s.nama_ibu,
      s.pekerjaan_ibu,
      s.nama_wali,
      s.pekerjaan_wali,
      s.no_telepon,
    ]);

    const [insertResult] = await connection.query(
      `
        INSERT INTO siswa (
          nama,
          nipd,
          nik,
          nisn,
          jenis_kelamin,
          agama,
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
          no_telepon
        ) VALUES ?
      `,
      [siswaValues],
    );

    /* =========================
       INSERT SISWA TAHUN AJARAN
       ========================= */

    const firstInsertedId = insertResult.insertId;

    const enrollmentValues = siswaData.map((s, index) => [
      firstInsertedId + index,
      s.id_tahun_ajaran,
      s.kelas,
      "aktif",
    ]);

    await connection.query(
      `
      INSERT INTO siswa_tahun_ajaran (
        id_siswa,
        id_tahun_ajaran,
        kelas,
        status
      ) VALUES ?
    `,
      [enrollmentValues],
    );

    await connection.commit();

    return res.json({
      message: "Import successful",
      total_inserted: siswaData.length,
    });
  } catch (error) {
    await connection.rollback();

    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  } finally {
    connection.release();
  }
};
