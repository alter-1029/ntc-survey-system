const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const { rateLimit } = require("express-rate-limit");
const router = express.Router();
const { readAll, insert, writeAll, remove } = require("../utils/jsonStore");
const { sign } = require("../utils/token");
const requireAuth = require("../middleware/requireAuth");

const QR_TTL_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 20 * 60 * 1000;
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password recovery attempts. Try again later." },
});

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordHash, passwordSalt: salt };
}

function passwordMatches(user, password) {
  if (user.passwordHash && user.passwordSalt) {
    const candidate = Buffer.from(hashPassword(password, user.passwordSalt).passwordHash, "hex");
    const stored = Buffer.from(user.passwordHash, "hex");
    return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  }
  return user.password === password;
}

function getProductionAdmin() {
  const stored = readAll("adminCredentials")[0];
  if (stored) return stored;

  const username = String(process.env.ADMIN_USERNAME || "").trim();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!username || !password) return null;
  return {
    id: 0,
    username,
    name: process.env.ADMIN_NAME || "Administrator",
    role: "admin",
    password,
    authVersion: 0,
  };
}

function saveAdminPassword(admin, password) {
  const authVersion = (Number(admin.authVersion) || 0) + 1;
  if (process.env.NODE_ENV === "production") {
    const stored = {
      id: admin.id > 0 ? admin.id : 1,
      username: admin.username,
      name: admin.name || process.env.ADMIN_NAME || "Administrator",
      role: "admin",
      authVersion,
      ...hashPassword(password),
    };
    writeAll("adminCredentials", [stored]);
    return stored;
  }

  const users = readAll("users");
  const index = users.findIndex((user) => user.id === admin.id && user.role === "admin");
  if (index < 0) return null;
  const { password: legacyPassword, ...userWithoutPlaintextPassword } = users[index];
  users[index] = {
    ...userWithoutPlaintextPassword,
    authVersion,
    ...hashPassword(password),
  };
  writeAll("users", users);
  return users[index];
}

function createMailer() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    auth: { user, pass },
  });
}

function removeResetToken(tokenId) {
  const tokens = readAll("adminPasswordResets").filter((entry) => entry.id !== tokenId);
  writeAll("adminPasswordResets", tokens);
}

async function createAccessCode(user, req) {
  const code = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date();
  const grant = {
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hash(code),
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + QR_TTL_MS).toISOString(),
    usedAt: null,
  };
  const baseUrl = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const signInUrl = `${baseUrl}/public/survey.html?code=${encodeURIComponent(code)}`;
  const qrCodeDataUrl = await QRCode.toDataURL(signInUrl, { width: 280, margin: 2 });
  const grants = readAll("surveyAccessCodes");
  grants.push(grant);
  writeAll("surveyAccessCodes", grants);
  return {
    code,
    signInUrl,
    qrCodeDataUrl,
    expiresAt: grant.expiresAt,
  };
}

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (process.env.NODE_ENV === "production") {
    let admin = getProductionAdmin();
    if (!admin) {
      return res.status(503).json({ error: "Production admin credentials have not been configured." });
    }
    if (String(username).toLowerCase() !== admin.username.toLowerCase() || !passwordMatches(admin, password)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    if (admin.id === 0) admin = saveAdminPassword(admin, password);
    if (!admin) return res.status(500).json({ error: "Could not initialize the admin account." });

    const token = sign({
      id: admin.id,
      username: admin.username,
      role: "admin",
      authVersion: Number(admin.authVersion) || 0,
    });
    return res.json({
      token,
      user: { id: admin.id, username: admin.username, name: admin.name, role: "admin" },
    });
  }

  const users = readAll("users");
  const user = users.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );

  if (!user || user.role !== "admin" || !passwordMatches(user, password)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const token = sign({
    id: user.id,
    username: user.username,
    role: user.role,
    authVersion: Number(user.authVersion) || 0,
  });

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

router.post("/change-password", requireAuth, (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ error: "The new password must be between 12 and 128 characters." });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "Choose a password different from your current password." });
  }

  const admin = process.env.NODE_ENV === "production"
    ? getProductionAdmin()
    : readAll("users").find((user) => user.id === req.user.id && user.role === "admin");
  if (!admin || !passwordMatches(admin, currentPassword)) {
    return res.status(401).json({ error: "Your current password is incorrect." });
  }

  const updated = saveAdminPassword(admin, newPassword);
  if (!updated) return res.status(500).json({ error: "Could not update the admin password." });
  res.json({ message: "Password updated. Sign in again with your new password." });
});

router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const isProduction = process.env.NODE_ENV === "production";
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const mailer = createMailer();
  if (isProduction && (!adminEmail || !mailer)) {
    return res.status(503).json({ error: "Email password recovery is not configured. Contact the system administrator." });
  }

  const admin = isProduction
    ? getProductionAdmin()
    : readAll("users").find((user) => user.role === "admin");
  if (!admin) {
    return res.status(503).json({ error: "Admin password recovery is not available." });
  }

  const matchesEmail = isProduction ? email === adminEmail : !adminEmail || email === adminEmail;
  const message = "If the address is eligible, password recovery instructions will be sent.";
  if (!matchesEmail) return res.status(202).json({ message });

  const token = crypto.randomBytes(32).toString("base64url");
  const resetRecord = {
    id: crypto.randomUUID(),
    username: admin.username,
    tokenHash: hash(token),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    usedAt: null,
  };
  const existingResets = readAll("adminPasswordResets").filter((entry) =>
    entry.username !== admin.username && !entry.usedAt && new Date(entry.expiresAt).getTime() > Date.now()
  );
  existingResets.push(resetRecord);
  writeAll("adminPasswordResets", existingResets);

  const baseUrl = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
  const resetUrl = `${baseUrl}/admin/reset-password.html?token=${encodeURIComponent(token)}`;
  if (mailer) {
    try {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: adminEmail || email,
        subject: "NTC admin password reset",
        text: `Use this link to reset your NTC admin password. It expires in 20 minutes and can only be used once:\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
      });
      return res.status(202).json({ message });
    } catch {
      removeResetToken(resetRecord.id);
      return res.status(503).json({ error: "The password reset email could not be sent. Check the mail server configuration." });
    }
  }

  if (isProduction) {
    removeResetToken(resetRecord.id);
    return res.status(503).json({ error: "Email password recovery is not configured. Contact the system administrator." });
  }
  res.status(202).json({ message, previewUrl: resetUrl });
});

router.post("/reset-password", passwordResetLimiter, (req, res) => {
  const token = String(req.body.token || "");
  const newPassword = String(req.body.newPassword || "");
  if (!token) return res.status(400).json({ error: "The password reset token is required." });
  if (newPassword.length < 12 || newPassword.length > 128) {
    return res.status(400).json({ error: "The new password must be between 12 and 128 characters." });
  }

  const tokens = readAll("adminPasswordResets");
  const reset = tokens.find((entry) => entry.tokenHash === hash(token));
  if (!reset || reset.usedAt || new Date(reset.expiresAt).getTime() <= Date.now()) {
    return res.status(400).json({ error: "This reset link is invalid, expired, or already used." });
  }

  const admin = process.env.NODE_ENV === "production"
    ? getProductionAdmin()
    : readAll("users").find((user) => user.role === "admin" && user.username === reset.username);
  if (!admin || admin.username !== reset.username) {
    return res.status(400).json({ error: "This reset link is no longer valid." });
  }

  const updated = saveAdminPassword(admin, newPassword);
  if (!updated) return res.status(500).json({ error: "Could not reset the admin password." });
  reset.usedAt = new Date().toISOString();
  writeAll("adminPasswordResets", tokens);
  res.json({ message: "Password reset complete. Sign in with your new password." });
});

router.get("/survey-users", requireAuth, (req, res) => {
  const now = Date.now();
  const grants = readAll("surveyAccessCodes");
  const users = readAll("users")
    .filter((user) => user.role === "survey")
    .map(({ id, username, name, active, deactivatedAt }) => {
      const userGrants = grants.filter((grant) => grant.userId === id);
      const activeGrant = userGrants
        .filter((grant) => !grant.usedAt && !grant.revokedAt && new Date(grant.expiresAt).getTime() > now)
        .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];
      return {
        id,
        username,
        name,
        active: active !== false,
        deactivatedAt: deactivatedAt || null,
        hasQrCodeRecords: userGrants.length > 0,
        hasActiveQr: Boolean(activeGrant),
        qrExpiresAt: activeGrant ? activeGrant.expiresAt : null,
        qrHistory: userGrants
          .map((grant) => ({
            id: grant.id,
            createdAt: grant.createdAt,
            expiresAt: grant.expiresAt,
            usedAt: grant.usedAt || null,
            status: grant.revokedAt
              ? "Revoked"
              : grant.usedAt
                ? "Used"
                : new Date(grant.expiresAt).getTime() <= now
                  ? "Expired"
                  : "Active",
          }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      };
    });
  res.json(users);
});

router.patch("/survey-users/:id/status", requireAuth, (req, res) => {
  if (typeof req.body.active !== "boolean") {
    return res.status(400).json({ error: "Choose whether the survey account should be active." });
  }
  const userId = Number(req.params.id);
  const users = readAll("users");
  const userIndex = users.findIndex((entry) => entry.id === userId && entry.role === "survey");
  if (userIndex < 0) return res.status(404).json({ error: "Survey user not found." });

  const active = req.body.active;
  const updatedAt = new Date().toISOString();
  users[userIndex] = { ...users[userIndex], active, deactivatedAt: active ? null : updatedAt };
  writeAll("users", users);

  if (!active) {
    const grants = readAll("surveyAccessCodes").map((grant) =>
      grant.userId === userId && !grant.revokedAt ? { ...grant, revokedAt: updatedAt } : grant
    );
    writeAll("surveyAccessCodes", grants);
  }

  res.json({ active, message: `Survey account ${users[userIndex].username} ${active ? "reactivated" : "deactivated"}.` });
});

function revokeSurveyAccessCodes(userIds) {
  const userIdSet = new Set(userIds);
  const grants = readAll("surveyAccessCodes");
  const remaining = grants.filter((grant) => !userIdSet.has(grant.userId));
  writeAll("surveyAccessCodes", remaining);
  return grants.length - remaining.length;
}

router.delete("/survey-access-codes", requireAuth, (req, res) => {
  const userIds = req.body.userIds;
  if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some((id) => !Number.isInteger(Number(id)))) {
    return res.status(400).json({ error: "Select at least one valid survey account." });
  }

  const normalizedIds = [...new Set(userIds.map(Number))];
  const surveyUserIds = new Set(
    readAll("users").filter((user) => user.role === "survey").map((user) => user.id)
  );
  if (normalizedIds.some((id) => !surveyUserIds.has(id))) {
    return res.status(400).json({ error: "One or more selected accounts are not survey accounts." });
  }

  const deletedCount = revokeSurveyAccessCodes(normalizedIds);
  res.json({ deletedCount, message: `${deletedCount} QR code record(s) deleted. Accounts and feedback were not changed.` });
});

router.delete("/survey-users", requireAuth, (req, res) => {
  const requestedIds = req.body.userIds;
  if (!Array.isArray(requestedIds) || requestedIds.length === 0) {
    return res.status(400).json({ error: "Select at least one survey account to delete." });
  }

  const userIds = [...new Set(requestedIds.map(Number))];
  if (userIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ error: "One or more selected account IDs are invalid." });
  }

  const users = readAll("users");
  const surveyUsers = users.filter((user) => user.role === "survey" && userIds.includes(user.id));
  if (surveyUsers.length !== userIds.length) {
    return res.status(400).json({ error: "One or more selected accounts are not available survey accounts." });
  }

  const removedIds = new Set(userIds);
  writeAll("users", users.filter((user) => !removedIds.has(user.id)));
  const deletedQrCount = revokeSurveyAccessCodes(userIds);
  res.json({
    deletedCount: surveyUsers.length,
    deletedQrCount,
    message: `${surveyUsers.length} survey account(s) deleted. Their QR codes were revoked; submitted responses were kept.`,
  });
});

router.delete("/survey-users/:id/access-code", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  const surveyUser = readAll("users").find((user) => user.id === userId && user.role === "survey");
  if (!surveyUser) return res.status(404).json({ error: "Survey user not found." });

  const deletedCount = revokeSurveyAccessCodes([userId]);
  res.json({ deletedCount, message: `${deletedCount} QR code record(s) deleted. The survey account and feedback were kept.` });
});

router.delete("/survey-users/:id", requireAuth, (req, res) => {
  const userId = Number(req.params.id);
  const surveyUser = readAll("users").find((user) => user.id === userId && user.role === "survey");
  if (!surveyUser) return res.status(404).json({ error: "Survey user not found." });

  const accountDeleted = remove("users", userId);
  if (!accountDeleted) return res.status(500).json({ error: "Could not delete the survey account." });
  const deletedQrCount = revokeSurveyAccessCodes([userId]);
  res.json({
    deletedQrCount,
    message: `Survey account ${surveyUser.username} deleted. Its QR codes were revoked; submitted responses were kept.`,
  });
});

router.post("/survey-users", requireAuth, async (req, res) => {
  const name = String(req.body.name || "").trim();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (name.length < 2 || username.length < 3 || password.length < 10) {
    return res.status(400).json({ error: "Enter a name, a username (3+ characters), and a password (10+ characters)." });
  }

  const users = readAll("users");
  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "That username is already in use." });
  }

  const credentials = hashPassword(password);
  const user = insert("users", {
    username,
    name,
    role: "survey",
    ...credentials,
  });

  try {
    const accessCode = await createAccessCode(user, req);
    res.status(201).json({
      user: { id: user.id, username: user.username, name: user.name },
      ...accessCode,
    });
  } catch {
    const grants = readAll("surveyAccessCodes").filter((grant) => grant.userId !== user.id);
    writeAll("surveyAccessCodes", grants);
    res.status(500).json({ error: "Could not create the sign-in QR code." });
  }
});

router.post("/survey-users/:id/access-code", requireAuth, async (req, res) => {
  const user = readAll("users").find(
    (entry) => entry.id === Number(req.params.id) && entry.role === "survey"
  );
  if (!user) return res.status(404).json({ error: "Survey user not found." });
  if (user.active === false) return res.status(409).json({ error: "Reactivate this survey account before issuing a QR code." });

  try {
    res.status(201).json({
      user: { id: user.id, username: user.username, name: user.name },
      ...(await createAccessCode(user, req)),
    });
  } catch {
    res.status(500).json({ error: "Could not create the sign-in QR code." });
  }
});

router.post("/survey-login", (req, res) => {
  const { username, password, code } = req.body;
  if (!username || !password || !code) {
    return res.status(400).json({ error: "Username, password, and QR code are required." });
  }

  const user = readAll("users").find(
    (entry) => entry.role === "survey" && entry.username.toLowerCase() === String(username).toLowerCase()
  );
  if (!user || user.active === false || !passwordMatches(user, String(password))) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const grants = readAll("surveyAccessCodes");
  const grant = grants.find((entry) => entry.tokenHash === hash(String(code)) && entry.userId === user.id);
  if (!grant || grant.usedAt || grant.revokedAt || new Date(grant.expiresAt).getTime() <= Date.now()) {
    return res.status(401).json({ error: "This QR code is invalid, expired, or already used." });
  }

  grant.usedAt = new Date().toISOString();
  writeAll("surveyAccessCodes", grants);
  const token = sign({ id: user.id, username: user.username, role: "survey" });
  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

module.exports = router;
