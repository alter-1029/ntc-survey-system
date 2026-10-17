const { verify } = require("../utils/token");

function requireSurveyAccess(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verify(token);

  if (!payload || !["admin", "survey"].includes(payload.role)) {
    return res.status(401).json({ error: "Sign in with a valid survey QR code first." });
  }

  req.user = payload;
  next();
}

module.exports = requireSurveyAccess;