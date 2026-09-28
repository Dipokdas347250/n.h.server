#!/usr/bin/env node
/**
 * Creates the dashboard administrator without the email verification step, or
 * promotes an existing account to administrator.
 *
 *   npm run admin:create -- <email> [full name]
 *
 * Asks for the password (at least 8 characters) on the terminal. For an
 * existing account, leave it blank to keep the current password. The account
 * is marked verified, so it can sign in to the dashboard straight away.
 */
require("dotenv").config({ quiet: true });

const readline = require("readline");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const userModel = require("../models/user.model");
const { vaildEmail } = require("../helpers/vaildEmail");

const [emailArg, ...nameParts] = process.argv.slice(2);
const email = String(emailArg || "").trim().toLowerCase();
const fullname = nameParts.join(" ").trim();

/** Reads a line from the terminal without echoing it. */
const askHidden = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (text) => {
    if (text.startsWith(question)) rl.output.write(text);
  };
  rl.question(question, (answer) => {
    rl.close();
    process.stdout.write("\n");
    resolve(answer);
  });
});

(async () => {
  if (!vaildEmail(email)) {
    console.error("Usage: npm run admin:create -- <email> [full name]");
    process.exit(1);
  }

  await mongoose.connect(process.env.DB_DATA_URL);
  const user = await userModel.findOne({ email });

  const password = await askHidden(user ? "New password (blank keeps the current one): " : "Password: ");
  if ((!user || password) && password.length < 8) {
    console.error("The password must be at least 8 characters.");
    process.exit(1);
  }

  const target = user || new userModel({ email, fullname: fullname || "Administrator" });
  if (fullname) target.fullname = fullname;
  if (password) target.password = await bcrypt.hash(password, 12);
  target.role = "admin";
  target.verified = true;
  target.otp = null;
  target.otpExpire = null;
  await target.save();

  console.log(`${user ? "Promoted" : "Created"} administrator ${email}. You can sign in to the dashboard now.`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error("Unable to create the administrator:", error.message);
  process.exit(1);
});
