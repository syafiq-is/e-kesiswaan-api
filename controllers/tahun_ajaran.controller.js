import db from "../lib/database.js";

/* Get All Tahun Ajaran */
export const getAllTahunAjaran = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM tahun_ajaran ORDER BY id DESC",
    );

    res.json(rows);
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

export const createNextTahunAjaranAndPromoteStudents = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    /* GET CURRENT ACTIVE */
    const [activeRows] = await connection.query(`
      SELECT *
      FROM tahun_ajaran
      WHERE status = 'aktif'
      LIMIT 1
    `);

    if (activeRows.length === 0) {
      return res.status(404).json({
        message: "No active tahun ajaran found",
      });
    }

    const current = activeRows[0];

    const currentTahun = current.tahun_ajaran; // 2025/2026
    const currentSemester = current.semester; // Ganjil / Genap

    let nextTahun;
    let nextSemester;

    if (currentSemester === "Ganjil") {
      nextSemester = "Genap";
      nextTahun = currentTahun;
    } else {
      nextSemester = "Ganjil";

      const [startYear, endYear] = currentTahun.split("/").map(Number);

      nextTahun = `${startYear + 1}/${endYear + 1}`;
    }

    /* DEACTIVATE CURRENT */
    await connection.query(`
      UPDATE tahun_ajaran
      SET status = 'nonaktif'
      WHERE status = 'aktif'
    `);

    /* CREATE NEW */
    const [result] = await connection.query(
      `
      INSERT INTO tahun_ajaran (
        tahun_ajaran,
        semester,
        status
      ) VALUES (?, ?, 'aktif')
      `,
      [nextTahun, nextSemester],
    );

    const newTahunAjaranId = result.insertId;

    /* PROMOTE STUDENTS */
    await promoteSiswaToNewAcademicYear(
      connection,
      newTahunAjaranId,
      nextSemester,
    );

    await connection.commit();

    return res.status(201).json({
      message: "Next tahun ajaran created successfully",
      data: {
        tahun_ajaran: nextTahun,
        semester: nextSemester,
      },
    });
  } catch (err) {
    await connection.rollback();

    console.error(err);

    return res.status(500).json({
      message: "Server error",
    });
  } finally {
    connection.release();
  }
};

// NOTE: THIS FUNCTION MUST NOT RUN ALONE, it must run after new tahun ajaran have been made due to this function reading second latest tahun ajaran
const promoteSiswaToNewAcademicYear = async (
  connection,
  newTahunAjaranId,
  semester,
) => {
  /* GET LATEST ENROLLMENTS */
  const [rows] = await connection.query(`
    SELECT
        sta.id_siswa,
        sta.kelas
    FROM siswa_tahun_ajaran sta
    JOIN (
        SELECT id AS previous_tahun
        FROM tahun_ajaran
        ORDER BY id DESC
        LIMIT 1 OFFSET 1
    ) ta
    ON sta.id_tahun_ajaran = ta.previous_tahun;
  `);

  console.log("LENGTH ", rows.length);

  const insertValues = [];

  for (const row of rows) {
    const { id_siswa, kelas } = row;

    /*
      EXAMPLES:
      7A
      8B
      9C
    */

    const match = kelas.match(/^(\d+)(.*)$/);

    if (!match) continue;

    let tingkat = parseInt(match[1]);
    const suffix = match[2];

    /*
      ONLY PROMOTE ON GANJIL

      GANJIL:
      7A -> 8A

      GENAP:
      7A -> 7A
    */
    if (semester === "Ganjil") {
      /* GRADE 9 = GRADUATED */
      if (tingkat >= 9) {
        continue;
      }

      tingkat += 1;
    }

    const newKelas = `${tingkat}${suffix}`;

    insertValues.push([id_siswa, newTahunAjaranId, newKelas]);
  }

  if (insertValues.length > 0) {
    await connection.query(
      `
      INSERT INTO siswa_tahun_ajaran (
        id_siswa,
        id_tahun_ajaran,
        kelas
      ) VALUES ?
      `,
      [insertValues],
    );
  }
};
