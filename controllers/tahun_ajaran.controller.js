import db from "../lib/database.js";

/* Get All Tahun Ajaran */
export const getAllTahunAjaran = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM tahun_ajaran ORDER BY tahun_ajaran DESC",
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Get Tahun Ajaran by ID */
export const getTahunAjaranById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM tahun_ajaran WHERE id = ?", [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Tahun Ajaran not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create Tahun Ajaran */
export const createTahunAjaran = async (req, res) => {
  try {
    const { tahun_ajaran, semester } = req.body;

    if (!tahun_ajaran || !semester) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    await db.query(
      "INSERT INTO tahun_ajaran (tahun_ajaran, semester) VALUES (?, ?)",
      [tahun_ajaran, semester],
    );

    res.status(201).json({ message: "Tahun Ajaran created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Tahun Ajaran by ID */
export const updateTahunAjaranById = async (req, res) => {
  try {
    const { tahun_ajaran, semester } = req.body;

    if (!tahun_ajaran && !semester) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const [result] = await db.query(
      `
      UPDATE tahun_ajaran
      SET
        tahun_ajaran = COALESCE(?, tahun_ajaran),
        semester = COALESCE(?, semester)
      WHERE id = ?
      `,
      [tahun_ajaran || null, semester ?? null, req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Tahun Ajaran not found" });
    }

    res.json({ message: "Tahun Ajaran updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Tahun Ajaran by ID */
export const updateTahunAjaranAktifById = async (req, res) => {
  try {
    const id_tahun_ajaran = req.params.id;

    if (!id_tahun_ajaran) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const [_] = await db.query(
      `
      UPDATE tahun_ajaran
      SET status = 'nonaktif'
      WHERE status = 'aktif';
      `,
    );

    const [result] = await db.query(
      `
      UPDATE tahun_ajaran
      SET status = 'aktif'
      WHERE id = ?;
      `,
      [id_tahun_ajaran],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Tahun Ajaran not found" });
    }

    res.json({ message: "Tahun Ajaran Aktif updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Tahun Ajaran by ID */
export const deleteTahunAjaranById = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM tahun_ajaran WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Tahun Ajaran not found" });
    }

    res.json({ message: "Tahun Ajaran deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
