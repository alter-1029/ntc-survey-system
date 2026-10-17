/**
 * Minimal signed-token helper (HMAC-SHA256), so we don't need an external
 * JWT dependency for a demo-scale admin session. Format: base64(payload).signature
 */

const crypto = require("crypto");

const SECRET = process.env.TOKEN_SECRET || "ntc-guest-satisfaction-dev-secret";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

if (process.env.NODE_ENV === "production" && !process.env.TOKEN_SECRET) {
  throw new Error("TOKEN_SECRET must be configured in production.");
}

function sign(payloadObj) {
  const payload = { ...payloadObj, exp: Date.now() + TOKEN_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${signature}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, signature, extra] = token.split(".");
  if (!payloadB64 || !signature || extra) return null;
  const expectedSignature = crypto
    .createHmac("sha256", SECRET)
    .update(payloadB64)
    .digest("base64url");

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
