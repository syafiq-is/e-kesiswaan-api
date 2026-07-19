import db from "../lib/database.js";

/* Get All Kelas in this Tahun Ajaran */
export const getAllKelas = async (req, res) => {
  try {
    const { id_tahun_ajaran } = req.query;

    const [rows] = await db.query(
      `SELECT DISTINCT kelas FROM siswa_tahun_ajaran WHERE id_tahun_ajaran = ${id_tahun_ajaran} ORDER BY kelas`,
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

export const getAllBulan = async (req, res) => {
  try {
    const { id_tahun_ajaran } = req.query;
    
    const [tahunAjaranAktif] = await db.query(`
      SELECT semester
      FROM tahun_ajaran
      WHERE id = ${id_tahun_ajaran}
      LIMIT 1
    `);

    if (tahunAjaranAktif.length === 0) {
      return res.status(400).json({
        message: "No active academic year found",
      });
    }

    const bulanSemesterGanjil = [7, 8, 9, 10, 11, 12];
    const bulanSemesterGenap = [1, 2, 3, 4, 5, 6];

    const bulanList =
      tahunAjaranAktif[0].semester === "Ganjil"
        ? bulanSemesterGanjil
        : bulanSemesterGenap;

    res.json({
      bulan_default: bulanList[0],
      bulan_list: bulanList,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
