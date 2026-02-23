import db from "../lib/database.js";
import bcrypt from "bcrypt";

/* Get All User */
export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Get User by ID */
export const getUserById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [
      req.params.id,
    ]);

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Create User */
export const createUser = async (req, res) => {
  try {
    const { nama, username, password, role } = req.body;

    if (!nama || !username || !password || !role) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (!["guru_bk", "kepala_sekolah", "absensi"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (nama, username, password, role) VALUES (?, ?, ?, ?)",
      [nama, username, hashedPassword, role],
    );

    res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Username already exists" });
    }

    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update User */
export const updateUser = async (req, res) => {
  try {
    const { nama, username, role, password } = req.body;

    if (!nama && !username && !role && !password) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const [result] = await db.query(
      `
      UPDATE users 
      SET 
        nama = COALESCE(?, nama),
        username = COALESCE(?, username),
        role = COALESCE(?, role),
        password = COALESCE(?, password)
      WHERE id = ?
      `,
      [
        nama || null,
        username || null,
        role || null,
        password ? await bcrypt.hash(password, 10) : null,
        req.params.id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete User */
export const deleteUser = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM users WHERE id = ?", [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
