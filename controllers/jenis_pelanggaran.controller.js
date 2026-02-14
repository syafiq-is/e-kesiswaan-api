import db from "../lib/database.js";

/* Get All Jenis Pelanggaran */
export const getAllJenisPelanggaran = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM jenis_pelanggaran ORDER BY poin DESC",
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Get Jenis Pelanggaran by ID */
export const getJenisPelanggaranById = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM jenis_pelanggaran WHERE id = ?",
      [req.params.id],
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Jenis pelanggaran not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create Jenis Pelanggaran */
export const createJenisPelanggaran = async (req, res) => {
  try {
    const { pelanggaran, poin } = req.body;

    if (!pelanggaran || poin === undefined) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (isNaN(poin) || poin < 0) {
      return res.status(400).json({ message: "Invalid poin value" });
    }

    await db.query(
      "INSERT INTO jenis_pelanggaran (pelanggaran, poin) VALUES (?, ?)",
      [pelanggaran, poin],
    );

    res.status(201).json({ message: "Jenis pelanggaran created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Jenis Pelanggaran by ID */
export const updateJenisPelanggaranById = async (req, res) => {
  try {
    const { pelanggaran, poin } = req.body;

    if (!pelanggaran && poin === undefined) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (poin !== undefined && (isNaN(poin) || poin < 0)) {
      return res.status(400).json({ message: "Invalid poin value" });
    }

    const [result] = await db.query(
      `
      UPDATE jenis_pelanggaran
      SET
        pelanggaran = COALESCE(?, pelanggaran),
        poin = COALESCE(?, poin)
      WHERE id = ?
      `,
      [pelanggaran || null, poin ?? null, req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Jenis pelanggaran not found" });
    }

    res.json({ message: "Jenis pelanggaran updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Jenis Pelanggaran by ID */
export const deleteJenisPelanggaranById = async (req, res) => {
  try {
    const [result] = await db.query(
      "DELETE FROM jenis_pelanggaran WHERE id = ?",
      [req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Jenis pelanggaran not found" });
    }

    res.json({ message: "Jenis pelanggaran deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
