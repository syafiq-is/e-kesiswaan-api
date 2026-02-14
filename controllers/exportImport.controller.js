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

export const exportAbsensiExcel = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        a.created_at,
        s.nama,
        s.nisn,
        s.kelas,
        ta.tahun_ajaran,
        ta.semester
      FROM absensi a
      JOIN siswa s ON a.id_siswa = s.id
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
      ORDER BY a.created_at DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Absensi");

    worksheet.columns = [
      { header: "Tanggal", key: "created_at", width: 20 },
      { header: "Nama", key: "nama", width: 25 },
      { header: "NISN", key: "nisn", width: 20 },
      { header: "Kelas", key: "kelas", width: 10 },
      { header: "Tahun Ajaran", key: "tahun_ajaran", width: 15 },
      { header: "Semester", key: "semester", width: 10 },
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
  } catch (error) {
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

/* Export Siswa to Excel */
export const exportSiswaExcel = async (req, res) => {
  try {
    const { id_tahun_ajaran } = req.query;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "id_tahun_ajaran is required" });
    }

    // Fetch data
    const [rows] = await db.query(
      `SELECT 
        id,
        nama,
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
        created_at
       FROM siswa
       WHERE id_tahun_ajaran = ?`,
      [id_tahun_ajaran],
    );

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Siswa");

    // Define columns
    worksheet.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Nama", key: "nama", width: 25 },
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
      { header: "Created At", key: "created_at", width: 20 },
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

export const exportAbsensiPDF = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        a.created_at,
        s.nama,
        s.nisn,
        s.kelas,
        ta.tahun_ajaran,
        ta.semester
      FROM absensi a
      JOIN siswa s ON a.id_siswa = s.id
      JOIN tahun_ajaran ta ON a.id_tahun_ajaran = ta.id
      ORDER BY a.created_at DESC
    `);

    const html = `
      <h2 style="text-align:center;">DATA ABSENSI</h2>
      <table border="1" cellspacing="0" cellpadding="4" width="100%">
        <tr>
          <th>No</th>
          <th>Tanggal</th>
          <th>Nama</th>
          <th>NISN</th>
          <th>Kelas</th>
          <th>Tahun Ajaran</th>
          <th>Semester</th>
        </tr>
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.created_at}</td>
            <td>${r.nama}</td>
            <td>${r.nisn}</td>
            <td>${r.kelas}</td>
            <td>${r.tahun_ajaran}</td>
            <td>${r.semester}</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    `;

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: "A4" });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=data_absensi.pdf",
    });

    res.send(pdf);
  } catch (err) {
    console.error(err);
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

    const html = `
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
    `;

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: "A4", landscape: true });
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

    const html = `
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
    `;

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: "A4", landscape: true });
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

/* Export Siswa to Excel */
export const exportSiswaPDF = async (req, res) => {
  try {
    const { id_tahun_ajaran } = req.query;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "id_tahun_ajaran is required" });
    }

    // Fetch data
    const [rows] = await db.query(
      `SELECT 
        id,
        nama,
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
        created_at
       FROM siswa
       WHERE id_tahun_ajaran = ?`,
      [id_tahun_ajaran],
    );

    const html = usePDFTemplate(
      `<table>
        <thead>
          <tr>
            <th>WAKTU DATANG</th>
            <th>NISN</th>
            <th>NAMA SISWA</th>
            <th>KELAS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              <td>${row.waktu}</td>
              <td>${row.nisn}</td>
              <td>${row.nama}</td>
              <td>${row.kelas}</td>
              <td>${row.status}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>`,
    );

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({ format: "A4" });
    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=rekap_siswa.pdf",
    });

    res.send(pdf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
