const crypto = require("crypto");
const nodemailer = require("nodemailer");
const mailConfig = require("../config/mail.config");

/**
 * Sends the account verification code.
 *
 * The message is deliberately plain and correct: a real sender name, a subject
 * that carries the code, a plain-text alternative alongside the HTML, and no
 * unfilled template placeholders or broken links. Gmail treats a message with
 * literal `{{placeholders}}`, malformed markup or an HTML-only body as spam,
 * which is what used to bury these codes in the spam folder.
 *
 * Two details keep it in the Primary inbox rather than Promotions or a
 * collapsed thread:
 *
 * - No marketing-style call-to-action button. Banks and large services send
 *   verification codes as plain text for exactly this reason.
 * - A unique `X-Entity-Ref-ID` per message. Gmail groups messages that look
 *   alike into one conversation, so a resent code can arrive but stay hidden
 *   inside an older collapsed thread and look like it never came.
 */

let transporter;

/** One pooled connection, reused across sends rather than rebuilt per email. */
const getTransporter = () => {
  if (!process.env.AUTH_EMAIL || !process.env.AUTH_PASSWORD) {
    throw new Error("AUTH_EMAIL and AUTH_PASSWORD must be configured");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      auth: {
        user: process.env.AUTH_EMAIL,
        // App passwords are shown in groups of four; the spaces are display only.
        pass: process.env.AUTH_PASSWORD.replace(/\s+/g, ""),
      },
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
    });
  }

  return transporter;
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

/** Western digits to Bangla, so the Bangla lines read naturally. */
const toBnDigits = (value) => String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);

/** Escapes anything from the database before it goes into the HTML body. */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildText = ({ fullname, otp, storeName, storeNameBn, expiryMinutes, storeUrl, supportEmail }) =>
  [
    `Hello ${fullname},`,
    "",
    `Your ${storeName} verification code is: ${otp}`,
    "",
    `The code expires in ${expiryMinutes} minutes. Please do not share it with anyone.`,
    "",
    `আপনার ${storeNameBn} যাচাইকরণ কোড: ${otp}`,
    `কোডটি ${toBnDigits(expiryMinutes)} মিনিট পর মেয়াদোত্তীর্ণ হবে। কারও সাথে শেয়ার করবেন না।`,
    "",
    `If you did not try to create an account, you can ignore this email.`,
    "",
    storeUrl,
    supportEmail ? `Need help? ${supportEmail}` : "",
  ]
    .filter((line) => line !== null)
    .join("\n");

const buildHtml = ({ fullname, otp, storeName, storeNameBn, expiryMinutes, storeUrl, supportEmail, year }) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(storeName)} verification code</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f7fb; font-family:Arial,Helvetica,sans-serif; color:#1f2937;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f7fb; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="background-color:#062B63; padding:24px; text-align:center;">
                <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:bold;">${escapeHtml(storeName)}</h1>
                <p style="margin:6px 0 0; color:#c7d7f0; font-size:13px;">${escapeHtml(storeNameBn)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px;">
                <p style="margin:0 0 16px; font-size:16px;">Hello <strong>${escapeHtml(fullname)}</strong>,</p>
                <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#374151;">
                  Use the code below to confirm your email address.
                </p>
                <p style="margin:0 0 24px; font-size:15px; line-height:1.6; color:#374151;">
                  আপনার ইমেইল ঠিকানা নিশ্চিত করতে নিচের কোডটি ব্যবহার করুন।
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="background-color:#f0f6ff; border:1px solid #c7d7f0; border-radius:10px; padding:20px;">
                      <div style="font-size:32px; font-weight:bold; letter-spacing:6px; color:#062B63;">${escapeHtml(otp)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <p style="margin:0 0 8px; font-size:14px; color:#4b5563;">
                  This code expires in ${expiryMinutes} minutes. Please do not share it with anyone.
                </p>
                <p style="margin:0 0 24px; font-size:14px; color:#4b5563;">
                  কোডটি ${toBnDigits(expiryMinutes)} মিনিট পর মেয়াদোত্তীর্ণ হবে। অনুগ্রহ করে কারও সাথে শেয়ার করবেন না।
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;">
                <p style="margin:0; font-size:13px; line-height:1.6; color:#6b7280;">
                  If you did not try to create an account, you can safely ignore this email.<br />
                  আপনি যদি অ্যাকাউন্ট তৈরির চেষ্টা না করে থাকেন, এই ইমেইলটি উপেক্ষা করতে পারেন।
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb; border-top:1px solid #e5e7eb; padding:18px 32px; text-align:center;">
                ${supportEmail ? `<p style="margin:0 0 6px; font-size:12px; color:#6b7280;">Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#16863D; text-decoration:none;">${escapeHtml(supportEmail)}</a></p>` : ""}
                <p style="margin:0; font-size:12px; color:#9ca3af;">&copy; ${year} ${escapeHtml(storeName)}. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const sendEmail = async (email, fullname, otp) => {
  const { storeName, storeNameBn, storeUrl, supportEmail, OTP_EXPIRY_MINUTES } = mailConfig;
  const values = {
    fullname: String(fullname || "there").trim(),
    otp: String(otp),
    storeName,
    storeNameBn,
    storeUrl,
    supportEmail,
    expiryMinutes: OTP_EXPIRY_MINUTES,
    year: new Date().getFullYear(),
  };

  try {
    return await getTransporter().sendMail({
      // A named sender reads as a real business rather than a bare address.
      from: { name: storeName, address: process.env.AUTH_EMAIL },
      to: email,
      replyTo: supportEmail || undefined,
      // Leading with the code is what banks and large services do: it is the
      // least spam-like phrasing and the customer can read it from the preview.
      subject: `${otp} is your ${storeName} verification code`,
      text: buildText(values),
      html: buildHtml(values),
      headers: {
        // Keeps every code in its own conversation instead of being folded
        // into the previous one, and marks the mail as transactional.
        "X-Entity-Ref-ID": crypto.randomUUID(),
        "Auto-Submitted": "auto-generated",
      },
    });
  } catch (error) {
    if (error.responseCode === 534 || error.responseCode === 535 || error.code === "EAUTH") {
      throw new Error(
        "SMTP authentication was rejected. For Gmail, turn on 2-Step Verification and paste a newly generated 16-character App Password into AUTH_PASSWORD."
      );
    }
    throw error;
  }
};

module.exports = sendEmail;
