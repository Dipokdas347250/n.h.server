/**
 * Store identity used in outgoing email, and the OTP lifetime.
 *
 * The OTP lifetime lives here rather than in the auth controller so the number
 * quoted in the email can never drift from the number actually enforced.
 */
const OTP_EXPIRY_MINUTES = Math.max(Number(process.env.OTP_EXPIRY_MINUTES) || 5, 1);

module.exports = {
  OTP_EXPIRY_MINUTES,
  OTP_EXPIRY_MS: OTP_EXPIRY_MINUTES * 60 * 1000,
  storeName: process.env.STORE_NAME || "N H Shop",
  storeNameBn: process.env.STORE_NAME_BN || "এন এইচ শপ",
  storeUrl: process.env.STORE_URL || "http://localhost:3000",
  supportEmail: process.env.SUPPORT_EMAIL || process.env.AUTH_EMAIL || "",
};
