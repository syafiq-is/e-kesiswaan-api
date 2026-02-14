import db from "../lib/database.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET not configured");
}

export const login = async (req, res) => {
  try {
    const { nip, password, rememberMe } = req.body;

    if (!nip || !password) {
      return res.status(400).json({ message: "NIP and password required" });
    }

    const [rows] = await db.query("SELECT * FROM users WHERE nip = ?", [nip]);

    if (!rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create token
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: rememberMe ? "30d" : "1d",
      },
    );

    // Send token as cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // true in production (HTTPS)
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        nama: user.nama,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
};
