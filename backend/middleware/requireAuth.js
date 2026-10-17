const { verify } = require("../utils/token");
const { readAll } = require("../utils/jsonStore");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verify(token);

  if (!payload) {
    return res.status(401).json({ error: "Unauthorized. Please log in again." });
  }

  if (payload.role !== "admin") {
    return res.status(403).json({ error: "Administrator access is required." });
  }

  const collection = process.env.NODE_ENV === "production" ? "adminCredentials" : "users";
  const account = readAll(collection).find((user) => user.id === payload.id && user.role === "admin");
  if (!account || (Number(account.authVersion) || 0) !== (Number(payload.authVersion) || 0)) {
    return res.status(401).json({ error: "Your admin session has expired. Please sign in again." });
  }

  req.user = payload;
  next();
}

module.exports = requireAuth;
