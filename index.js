import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import routes from "./routes.js";

dotenv.config();

const app = express();

// ===== Logger ===== //
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
});

// ===== Global Middleware (ORDER MATTERS) ===== //
// app.use(express.urlencoded({ extended: true })); // parse URL-encoded body
app.use(express.json()); // parse JSON body
app.use(cookieParser()); // read cookies

// ===== Routes ===== //
app.use("/api", routes);

// ===== 404 handler ===== //
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ===== Global error handler ===== //
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

// ===== Start server ===== //
app.listen(process.env.PORT, () =>
  console.log(`🔥 Server running on http://localhost:`, process.env.PORT),
);