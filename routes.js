// Import Libraries
import express from "express";
import { upload, uploadImg } from "./lib/storage.js";

// Import Middlewares
import authMiddleware from "./middleware/auth.middleware.js";
import requireRole from "./middleware/role.middleware.js";
import ownerOrRoles from "./middleware/ownerOrRoles.middleware.js";

// Import Controllers
import * as AuthController from "./controllers/auth.controller.js";
import * as StatistikController from "./controllers/statistik.controller.js";
import * as TahunAjaranController from "./controllers/tahun_ajaran.controller.js";
import * as UserController from "./controllers/users.controller.js";
import * as SiswaController from "./controllers/siswa.controller.js";
import * as AbsensiController from "./controllers/absensi.controller.js";
import * as RekapKehadiranController from "./controllers/rekap_kehadiran.controller.js";
import * as PrestasiController from "./controllers/prestasi.controller.js";
import * as JenisPelanggaranController from "./controllers/jenis_pelanggaran.controller.js";
import * as PelanggaranController from "./controllers/pelanggaran.controller.js";
import * as PerizinanController from "./controllers/perizinan.controller.js";
import * as HomeVisitController from "./controllers/home_visit.controller.js";
import * as ConfigController from "./controllers/config.controller.js";
import * as ExportImportController from "./controllers/exportImport.controller.js";

// Initial Config
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET not configured");
}

const router = express.Router();

/* ===== Auth Routes ===== */

router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);

/* ===== Tahun Ajaran Routes ===== */

router.get(
  "/tahun_ajaran",
  authMiddleware,
  requireRole(["absensi", "admin", "guru_bk", "kepala_sekolah"]),
  TahunAjaranController.getAllTahunAjaran,
);

router.post(
  "/tahun_ajaran",
  authMiddleware,
  requireRole(["admin"]),
  TahunAjaranController.createTahunAjaran,
);

router.post(
  "/tahun_ajaran/next/promote",
  authMiddleware,
  requireRole(["admin"]),
  TahunAjaranController.createNextTahunAjaranAndPromoteStudents,
);

router.patch(
  "/tahun_ajaran/:id",
  authMiddleware,
  requireRole(["admin"]),
  TahunAjaranController.updateTahunAjaranById,
);

router.patch(
  "/tahun_ajaran/aktifkan/:id",
  authMiddleware,
  requireRole(["admin"]),
  TahunAjaranController.updateTahunAjaranAktifById,
);

router.delete(
  "/tahun_ajaran/:id",
  authMiddleware,
  requireRole(["admin"]),
  TahunAjaranController.deleteTahunAjaranById,
);

/* ===== Users Routes ===== */

router.get(
  "/users",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  UserController.getAllUsers,
);

router.get(
  "/users/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  UserController.getUserById,
);

router.post(
  "/users",
  authMiddleware,
  requireRole(["admin"]),
  UserController.createUser,
);

router.patch(
  "/users/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  UserController.updateUser,
);

router.delete(
  "/users/:id",
  authMiddleware,
  requireRole(["admin"]),
  UserController.deleteUser,
);

/* ===== Siswa Routes ===== */

router.get(
  "/siswa",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  SiswaController.getAllSiswa,
);

router.get(
  "/siswa/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  SiswaController.getSiswa,
);

router.get(
  "/siswa/kelas",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  SiswaController.getAllKelas,
);

router.post(
  "/siswa",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  SiswaController.createSiswa,
);

router.patch(
  "/siswa/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  SiswaController.updateSiswaById,
);

router.delete(
  "/siswa/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  SiswaController.deleteSiswaById,
);

/* ===== Absensi Siswa Routes ===== */

router.get(
  "/absensi",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah", "absensi"]),
  AbsensiController.getAllAbsensi,
);

router.post(
  "/absensi",
  authMiddleware,
  requireRole(["absensi"]),
  AbsensiController.createAbsensi,
);

router.delete(
  "/absensi/nipd/:nipd/:tipe_absensi",
  authMiddleware,
  requireRole(["absensi"]),
  AbsensiController.deleteAbsensiByNIPD,
);

router.delete(
  "/absensi/:id",
  authMiddleware,
  requireRole(["absensi"]),
  AbsensiController.deleteAbsensiById,
);

router.get(
  "/rekap_kehadiran",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  RekapKehadiranController.getRekapKehadiran,
);

router.post(
  "/absensi/tandaiAlpha",
  authMiddleware,
  requireRole(["absensi"]),
  AbsensiController.flagUnattendedAsAlpha,
);

/* ===== Prestasi Siswa Routes ===== */

router.get(
  "/prestasi",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  PrestasiController.getAllPrestasi,
);

router.post(
  "/prestasi",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  PrestasiController.createPrestasi,
);

router.patch(
  "/prestasi/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  PrestasiController.updatePrestasiById,
);

router.delete(
  "/prestasi/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  PrestasiController.deletePrestasiById,
);

/* ===== Jenis Pelanggaran Routes ===== */

router.get(
  "/jenis_pelanggaran",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  JenisPelanggaranController.getAllJenisPelanggaran,
);

router.post(
  "/jenis_pelanggaran",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  JenisPelanggaranController.createJenisPelanggaran,
);

router.patch(
  "/jenis_pelanggaran/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  JenisPelanggaranController.updateJenisPelanggaranById,
);

router.delete(
  "/jenis_pelanggaran/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  JenisPelanggaranController.deleteJenisPelanggaranById,
);

/* ===== Pelanggaran Siswa Routes ===== */

router.get(
  "/pelanggaran",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  PelanggaranController.getAllPelanggaran,
);

router.get(
  "/pelanggaran/total",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  PelanggaranController.getAllTotalPoinSiswa,
);

router.post(
  "/pelanggaran",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  PelanggaranController.createPelanggaran,
);

router.patch(
  "/pelanggaran/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  PelanggaranController.updatePelanggaranById,
);

router.delete(
  "/pelanggaran/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  PelanggaranController.deletePelanggaranById,
);

/* ===== Perizinan Siswa Routes ===== */

router.get(
  "/perizinan",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  PerizinanController.getAllPerizinan,
);

router.post(
  "/perizinan",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  PerizinanController.createPerizinan,
);

router.patch(
  "/perizinan/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  PerizinanController.updatePerizinanById,
);

router.delete(
  "/perizinan/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  PerizinanController.deletePerizinanById,
);

/* ===== Home Visit Routes ===== */

router.get(
  "/home_visit",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  HomeVisitController.getAllHomeVisit,
);

router.post(
  "/home_visit",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  HomeVisitController.createHomeVisit,
);

router.patch(
  "/home_visit/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  upload.single("gambar"),
  HomeVisitController.updateHomeVisitById,
);

router.delete(
  "/home_visit/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  HomeVisitController.deleteHomeVisitById,
);

/* ===== Statistics Routes ===== */

router.get(
  "/statistik",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  StatistikController.getAllStatistics,
);

router.get(
  "/statistik/tren-pelanggaran",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  StatistikController.getTrenPelanggaran,
);

router.get(
  "/statistik/rekap-kehadiran",
  authMiddleware,
  requireRole(["admin", "guru_bk", "kepala_sekolah"]),
  StatistikController.getRekapKehadiran,
);

/* ===== Config Routes ===== */

router.get(
  "/config",
  authMiddleware,
  requireRole(["absensi", "admin", "guru_bk"]),
  ConfigController.getAllConfig,
);

router.patch(
  "/config/:id",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ConfigController.updateConfigById,
);

/* ===== Export Import Routes ===== */
router.get(
  "/export/absensi/excel",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportRekapKehadiranExcel,
);
router.get(
  "/export/pelanggaran/excel",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportPelanggaranExcel,
);
router.get(
  "/export/prestasi/excel",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportPrestasiExcel,
);

router.get(
  "/export/absensi/pdf",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportRekapKehadiranPDF,
);
router.get(
  "/export/pelanggaran/pdf",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportPelanggaranPDF,
);
router.get(
  "/export/prestasi/pdf",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportPrestasiPDF,
);

router.post(
  "/import/siswa/excel",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  uploadImg.single("file"),
  ExportImportController.importSiswaExcel,
);
router.get(
  "/export/siswa/excel-template",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportSiswaExcelTemplate,
);
router.get(
  "/export/siswa/excel",
  authMiddleware,
  requireRole(["admin", "guru_bk"]),
  ExportImportController.exportSiswaExcel,
);

export default router;
