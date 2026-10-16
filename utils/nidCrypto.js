const crypto = require("crypto");

/*
 * NID numbers are never stored in plain text.
 *
 * - `nidHash`       HMAC-SHA256 of the digits, for finding the same NID on
 *                   another account without decrypting anything;
 * - `nidEncrypted`  AES-256-GCM ciphertext, decrypted only when an
 *                   administrator presses "Show full NID" (which is audited);
 * - `nidLast4`      the last four digits, for the masked "••••••7890" shown
 *                   everywhere else.
 *
 * The key comes from NID_ENCRYPTION_KEY (any long random string). Keep it
 * safe and never change it: NIDs encrypted with one key cannot be read with
 * another. Without it the key is derived from SESSION_SECRET, with a warning.
 */

let warned = false;
const keySource = () => {
  if (process.env.NID_ENCRYPTION_KEY) return process.env.NID_ENCRYPTION_KEY;
  if (!warned) {
    console.warn("NID_ENCRYPTION_KEY is not set; deriving the NID key from SESSION_SECRET. Set NID_ENCRYPTION_KEY and keep it unchanged.");
    warned = true;
  }
  if (!process.env.SESSION_SECRET) throw new Error("NID_ENCRYPTION_KEY (or SESSION_SECRET) must be set to store NID numbers");
  return process.env.SESSION_SECRET;
};

// Separate keys for encryption and hashing, both derived from the one secret.
const deriveKey = (purpose) => crypto.createHash("sha256").update(`nh-shop:${purpose}:${keySource()}`).digest();

/** Deterministic keyed hash: the same NID always gives the same value. */
const hashNid = (nid) => crypto.createHmac("sha256", deriveKey("nid-hash")).update(String(nid)).digest("hex");

const encryptNid = (nid) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey("nid-encrypt"), iv);
  const encrypted = Buffer.concat([cipher.update(String(nid), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
};

const decryptNid = (value) => {
  if (!value) return "";
  const [version, iv, tag, data] = String(value).split(":");
  if (version !== "v1") throw new Error("Unknown NID encryption format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey("nid-encrypt"), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
};

/** The stored fields for a normalised NID number. */
const protectNid = (nid) => ({ nidHash: hashNid(nid), nidEncrypted: encryptNid(nid), nidLast4: String(nid).slice(-4) });

/** "••••••7890" — what staff see unless they ask for the full number. */
const maskNid = (last4) => (last4 ? `••••••${last4}` : "");

module.exports = { hashNid, encryptNid, decryptNid, protectNid, maskNid };
