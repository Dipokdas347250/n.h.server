#!/usr/bin/env node
/**
 * Checks the mail setup end to end.
 *
 *   npm run mail:test                  -> sends to AUTH_EMAIL (the sender itself)
 *   npm run mail:test you@example.com  -> sends to that address
 *
 * Reports whether the SMTP login is accepted and whether the provider took the
 * message. If it says delivered but nothing arrives, check the spam folder.
 */
require("dotenv").config({ quiet: true });

const nodemailer = require("nodemailer");
const sendEmail = require("../helpers/sendEmail");

const recipient = process.argv[2] || process.env.AUTH_EMAIL;

const mask = (value) => (value ? `${value.slice(0, 3)}***${value.slice(-3)}` : "(not set)");

(async () => {
  console.log("Mail configuration");
  console.log("  host     :", process.env.SMTP_HOST || "smtp.gmail.com");
  console.log("  port     :", process.env.SMTP_PORT || 465);
  console.log("  user     :", mask(process.env.AUTH_EMAIL));
  console.log("  password :", process.env.AUTH_PASSWORD
    ? `${process.env.AUTH_PASSWORD.replace(/\s+/g, "").length} characters`
    : "(not set)");
  console.log("  to       :", recipient || "(not set)");
  console.log();

  if (!process.env.AUTH_EMAIL || !process.env.AUTH_PASSWORD) {
    console.error("AUTH_EMAIL and AUTH_PASSWORD must both be set in server/.env");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: { user: process.env.AUTH_EMAIL, pass: process.env.AUTH_PASSWORD.replace(/\s+/g, "") },
  });

  try {
    await transporter.verify();
    console.log("1. SMTP login accepted.");
  } catch (error) {
    console.error("1. SMTP login REJECTED:", error.message);
    if (error.responseCode === 535 || error.code === "EAUTH") {
      console.error("   For Gmail: turn on 2-Step Verification, then create an App Password");
      console.error("   at https://myaccount.google.com/apppasswords and put it in AUTH_PASSWORD.");
    }
    process.exit(1);
  } finally {
    transporter.close();
  }

  try {
    const info = await sendEmail(recipient, "Mail test", "123456");
    console.log("2. Message accepted by the provider.");
    console.log("   accepted :", info.accepted.join(", ") || "(none)");
    console.log("   rejected :", info.rejected.join(", ") || "(none)");
    console.log("   response :", info.response);
    console.log();
    console.log(`Check the inbox for ${recipient}. If it is not there, look in Spam —`);
    console.log("the transport is working, so anything missing has been filtered.");
  } catch (error) {
    console.error("2. Send FAILED:", error.message);
    process.exit(1);
  }

  process.exit(0);
})();
