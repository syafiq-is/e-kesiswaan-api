import db from "../lib/database.js";

/* Get All Config */
export const getAllConfig = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM config");

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Config by ID */
export const updateConfigById = async (req, res) => {
  try {
    const { config_key, config_value } = req.body;

    if (!config_key && config_value === undefined) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (config_value !== undefined && typeof config_value !== "string") {
      return res.status(400).json({ message: "Invalid config_value value" });
    }

    const [result] = await db.query(
      `
      UPDATE config
      SET
        config_value = COALESCE(?, config_value)
      WHERE id = ?
      `,
      [config_value || null, req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Config not found" });
    }

    res.json({ message: "Config updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
