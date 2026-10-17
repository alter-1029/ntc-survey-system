/**
 * NTC Guest Satisfaction Survey System — API Server
 * Vanilla Node.js + Express, JSON-file storage (see /data and /utils/jsonStore.js).
 * The storage layer is written so that swapping in a real database (e.g. MySQL)
 * later only means rewriting utils/jsonStore.js — routes/controllers stay the same.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const responseRoutes = require("./routes/responses");
const questionRoutes = require("./routes/questions");
const categoryRoutes = require("./routes/categories");
const analyticsRoutes = require("./routes/analytics");
const divisionRoutes = require("./routes/divisions");

const app = express();
const PORT = process.env.PORT || 4179;
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

// Serve the frontend as static files so the whole app can run from one server.
// (You can also run the frontend from its own static host — the API works
// the same either way, CORS is already enabled.)
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.use("/api/auth", authRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/divisions", divisionRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Fallback 404 for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`NTC Guest Satisfaction API running on http://localhost:${PORT}`);
});
