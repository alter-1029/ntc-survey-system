const { verify } = require("../utils/token");
const { readAll } = require("../utils/jsonStore");

function requireSurveyAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verify(token);

  if (!payload || payload.role !== "survey") {
    return res.status(401).json({ error: "A valid survey sign-in is required." });
  }

  const user = readAll("users").find((entry) => entry.id === payload.id && entry.role === "survey");
  if (!user || user.active === false) {
    return res.status(401).json({ error: "This survey account is no longer available. Please contact the office." });
  }

  req.user = payload;
  next();
}

module.exports = requireSurveyAuth;