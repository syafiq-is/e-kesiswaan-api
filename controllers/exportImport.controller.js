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
    const [rows] = await db.query(`
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
      GROUP BY s.id
      ORDER BY s.nisn ASC;
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Absensi");

    worksheet.columns = [
      { header: "NISN", key: "nisn", width: 20 },
      { header: "Nama", key: "nama", width: 25 },
      { header: "Jenis Kelamin", key: "jenis_kelamin", width: 15 },
      { header: "Kelas", key: "kelas", width: 10 },
      { header: "Total Hadir", key: "total_hadir", width: 15 },
      { header: "Total Izin", key: "total_izin", width: 15 },
      { header: "Total Sakit", key: "total_sakit", width: 15 },
      { header: "Total Alpha", key: "total_alpha", width: 15 },
      { header: "Total Terlambat", key: "total_terlambat", width: 15 },
    ];

    rows.forEach((row) => worksheet.addRow(row));
    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=data_absensi.xlsx",
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
    const [rows] = await db.query(`
      SELECT
        ps.tanggal,
        ps.keterangan,
        s.nama AS nama_siswa,
        s.nama_ayah,
        s.nama_ibu,
        s.nama_wali,
        s.jenis_kelamin,
        s.nisn,
        s.kelas,
        jp.pelanggaran,
        jp.poin
      FROM pelanggaran_siswa ps
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN jenis_pelanggaran jp ON ps.id_jenis_pelanggaran = jp.id
      ORDER BY jp.poin DESC
    `);

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
    const [rows] = await db.query(`
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
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ORDER BY p.tanggal DESC
    `);

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
    const { id_tahun_ajaran } = req.query;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "id_tahun_ajaran is required" });
    }

    const [rows] = await db.query(
      `SELECT 
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
        ta.tahun_ajaran
      FROM siswa s
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      WHERE id_tahun_ajaran = ?`,
      [id_tahun_ajaran],
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Siswa");

    // Define columns
    worksheet.columns = [
      { header: "Nama", key: "nama", width: 25 },
      { header: "NIS", key: "nis", width: 15 }, // 🔥 ADD THIS
      { header: "NISN", key: "nisn", width: 15 },
      { header: "Kelas", key: "kelas", width: 10 },
      { header: "Jenis Kelamin", key: "jenis_kelamin", width: 15 },
      { header: "Tempat Lahir", key: "tempat_lahir", width: 20 },
      { header: "Tanggal Lahir", key: "tanggal_lahir", width: 15 },
      { header: "Alamat", key: "alamat", width: 30 },
      { header: "Nama Ayah", key: "nama_ayah", width: 20 },
      { header: "Pekerjaan Ayah", key: "pekerjaan_ayah", width: 20 },
      { header: "Nama Ibu", key: "nama_ibu", width: 20 },
      { header: "Pekerjaan Ibu", key: "pekerjaan_ibu", width: 20 },
      { header: "Nama Wali", key: "nama_wali", width: 20 },
      { header: "Pekerjaan Wali", key: "pekerjaan_wali", width: 20 },
      { header: "No Telepon", key: "no_telepon", width: 15 },
      {
        header: "Penghasilan Orang Tua",
        key: "penghasilan_orang_tua",
        width: 20,
      },
      { header: "Tahun Ajaran", key: "tahun_ajaran", width: 15 },
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
      { header: "NIS", key: "nis", width: 15 },
      { header: "NISN", key: "nisn", width: 15 },
      { header: "Kelas", key: "kelas", width: 15 },
      { header: "Jenis Kelamin (L/P)", key: "jenis_kelamin", width: 20 },
      { header: "Tempat Lahir", key: "tempat_lahir", width: 20 },
      { header: "Tanggal Lahir (YYYY-MM-DD)", key: "tanggal_lahir", width: 22 },
      { header: "Alamat", key: "alamat", width: 30 },
      { header: "Nama Ayah", key: "nama_ayah", width: 20 },
      { header: "Pekerjaan Ayah", key: "pekerjaan_ayah", width: 20 },
      { header: "Nama Ibu", key: "nama_ibu", width: 20 },
      { header: "Pekerjaan Ibu", key: "pekerjaan_ibu", width: 20 },
      { header: "Nama Wali", key: "nama_wali", width: 20 },
      { header: "Pekerjaan Wali", key: "pekerjaan_wali", width: 20 },
      { header: "No Telepon", key: "no_telepon", width: 18 },
      {
        header: "Penghasilan Orang Tua",
        key: "penghasilan_orang_tua",
        width: 22,
      },
      { header: "Tahun Ajaran", key: "tahun_ajaran", width: 15 },
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
    const [rows] = await db.query(`
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
      GROUP BY s.id
      ORDER BY s.nisn ASC;
    `);

    const html = usePDFTemplate(`
      <h2 style="text-align:center;">DATA REKAP KEHADIRAN</h2>
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
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportPelanggaranPDF = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        ps.tanggal,
        ps.keterangan,
        s.nama AS nama_siswa,
        s.nisn,
        s.kelas,
        jp.pelanggaran,
        jp.poin
      FROM pelanggaran_siswa ps
      JOIN siswa s ON ps.id_siswa = s.id
      JOIN jenis_pelanggaran jp ON ps.id_jenis_pelanggaran = jp.id
      ORDER BY jp.poin DESC
    `);

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
    const [rows] = await db.query(`
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
      JOIN tahun_ajaran ta ON s.id_tahun_ajaran = ta.id
      ORDER BY p.tanggal DESC
    `);

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
      return res.status(400).json({ message: "Excel file is required" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    const dataToInsert = [];
    const errors = [];
    const nisSet = new Set();
    const nisnSet = new Set();
    const tahunAjaranCache = new Map();

    const rows = worksheet.getRows(2, worksheet.rowCount - 1);

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2;
      const v = rows[i].values;

      if (!v || v.length <= 1) continue;

      const nama = v[1]?.toString().trim();
      const nis = v[2]?.toString().trim();
      const nisn = v[3]?.toString().trim();
      const kelas = v[4]?.toString().trim();
      const jenis_kelamin = v[5]?.toString().trim();
      const tempat_lahir = v[6]?.toString().trim() || null;
      const tanggal_lahir = v[7] || null;
      const alamat = v[8]?.toString().trim() || null;
      const nama_ayah = v[9]?.toString().trim() || null;
      const pekerjaan_ayah = v[10]?.toString().trim() || null;
      const nama_ibu = v[11]?.toString().trim() || null;
      const pekerjaan_ibu = v[12]?.toString().trim() || null;
      const nama_wali = v[13]?.toString().trim() || null;
      const pekerjaan_wali = v[14]?.toString().trim() || null;
      const no_telepon = v[15]?.toString().trim() || null;
      const penghasilan_orang_tua = v[16] || 0;
      const tahun_ajaran_nama = v[17]?.toString().trim();

      // ===== REQUIRED VALIDATION =====
      if (
        !nama ||
        !nis ||
        !nisn ||
        !kelas ||
        !jenis_kelamin ||
        !tahun_ajaran_nama
      ) {
        errors.push(`Row ${rowNumber}: Required fields missing`);
        continue;
      }

      if (!["L", "P"].includes(jenis_kelamin)) {
        errors.push(`Row ${rowNumber}: Jenis Kelamin must be L or P`);
        continue;
      }

      if (!/^\d+$/.test(nis)) {
        errors.push(`Row ${rowNumber}: NIS must be numeric`);
        continue;
      }

      if (!/^\d+$/.test(nisn)) {
        errors.push(`Row ${rowNumber}: NISN must be numeric`);
        continue;
      }

      if (nisSet.has(nis)) {
        errors.push(`Row ${rowNumber}: Duplicate NIS in file`);
        continue;
      }

      if (nisnSet.has(nisn)) {
        errors.push(`Row ${rowNumber}: Duplicate NISN in file`);
        continue;
      }

      nisSet.add(nis);
      nisnSet.add(nisn);

      // ===== VALIDATE TAHUN AJARAN =====
      let id_tahun_ajaran;

      if (tahunAjaranCache.has(tahun_ajaran_nama)) {
        id_tahun_ajaran = tahunAjaranCache.get(tahun_ajaran_nama);
      } else {
        const [tahunRows] = await connection.query(
          "SELECT id FROM tahun_ajaran WHERE tahun_ajaran = ?",
          [tahun_ajaran_nama],
        );

        if (tahunRows.length === 0) {
          errors.push(`Row ${rowNumber}: Tahun Ajaran not found`);
          continue;
        }

        id_tahun_ajaran = tahunRows[0].id;
        tahunAjaranCache.set(tahun_ajaran_nama, id_tahun_ajaran);
      }

      dataToInsert.push([
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
      ]);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors,
      });
    }

    if (dataToInsert.length === 0) {
      return res.status(400).json({ message: "No valid data found" });
    }

    // DB duplicate check
    const [existing] = await connection.query(
      `SELECT nis, nisn FROM siswa 
       WHERE nis IN (?) OR nisn IN (?)`,
      [[...nisSet], [...nisnSet]],
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Duplicate NIS/NISN found in database",
        duplicates: existing,
      });
    }

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO siswa (
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
        penghasilan_orang_tua
      ) VALUES ?`,
      [dataToInsert],
    );

    await connection.commit();

    res.json({
      message: "Import successful",
      total_inserted: dataToInsert.length,
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: "Server error" });
  } finally {
    connection.release();
  }
};
