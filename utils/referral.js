const crypto = require("crypto");
const merchantModel = require("../models/merchant.model");
const referralModel = require("../models/referral.model");
const accountModel = require("../models/referralCreditAccount.model");
const ledgerModel = require("../models/referralCreditTransaction.model");
const Setting = require("../models/setting.model");
const { audit } = require("./audit");
const { notifyMerchant } = require("./notify");

/*
 * Merchant referrals and referral credit.
 *
 * Every merchant has a referral code. An application that carries one links
 * the new merchant to the referrer when an administrator approves it. When an
 * administrator activates the new merchant's first cash subscription payment,
 * the referrer earns the referral credit set in Store settings — once per new
 * merchant, enforced by a status claim and by unique indexes.
 *
 * Credit only pays future subscription fees. Submitting a payment reserves
 * what the invoice uses; rejecting it gives the credit back; activating it
 * spends it. Balances move only through conditional `$inc` updates, and every
 * move is written to the append-only ledger.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PREFIX = "NH";
const CODE_LENGTH = 6;
const DEFAULT_CREDIT = Math.max(Number(process.env.MERCHANT_REFERRAL_CREDIT) || 100, 0);

/** A referral code as typed or taken from a link: upper case, letters and digits only. */
const normalizeReferralCode = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);

const randomCode = () => {
  let code = CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
};

/** Gives the merchant a referral code if they have none. Returns the code. */
const ensureReferralCode = async (merchant) => {
  if (merchant.referralCode) return merchant.referralCode;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const updated = await merchantModel.findOneAndUpdate(
        { _id: merchant._id, $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: "" }] },
        { referralCode: randomCode() },
        { returnDocument: "after" }
      );
      // Someone else set it first: use theirs.
      const code = updated?.referralCode || (await merchantModel.findById(merchant._id).select("referralCode").lean())?.referralCode;
      if (code) {
        merchant.referralCode = code;
        return code;
      }
    } catch (error) {
      if (error.code !== 11000) throw error; // Code already taken: try another.
    }
  }
  throw new Error("Could not assign a referral code");
};

/** Credit per eligible referral, from Store settings. */
const referralConfig = async () => {
  const settings = await Setting.getSettings();
  const amount = Number(settings.merchantReferral?.creditAmount);
  return { creditAmount: Number.isFinite(amount) && amount >= 0 ? amount : DEFAULT_CREDIT };
};

/** The merchant whose code this is, or null. */
const findReferrer = (code) => (code ? merchantModel.findOne({ referralCode: normalizeReferralCode(code) }).select("_id name nidHash phone") : null);

/**
 * Called once a referred application is approved. Records the referral as
 * pending, or as void when the "new" merchant is not new: the referrer
 * themselves (same NID or mobile number) or anyone who already had an account
 * on that NID. Never throws — a referral problem must not undo an approval.
 */
const linkReferral = async ({ req = null, merchant, application }) => {
  try {
    if (!application.referredBy) return null;
    const referrer = await merchantModel.findById(application.referredBy).select("_id name nidHash phone");
    if (!referrer || String(referrer._id) === String(merchant._id)) return null;

    let voidReason = "";
    if (referrer.nidHash === merchant.nidHash || referrer.phone === merchant.phone) voidReason = "same_person";
    else if (application.duplicateNid) voidReason = "existing_merchant";

    const referral = await referralModel.create({
      referrer: referrer._id,
      referred: merchant._id,
      application: application._id,
      referralCode: application.referralCode,
      status: voidReason ? "void" : "pending",
      voidReason,
    });
    await merchantModel.updateOne({ _id: merchant._id }, { referredBy: referrer._id });
    merchant.referredBy = referrer._id;
    await audit({
      req,
      action: voidReason ? "referral.voided" : "referral.linked",
      merchant,
      subject: referral,
      details: { referrer: referrer._id, referrerName: referrer.name, code: application.referralCode, reason: voidReason || undefined },
    });
    return referral;
  } catch (error) {
    console.error("Referral could not be linked:", error.message);
    return null;
  }
};

// ---------------------------------------------------------------- credit account

const ZERO_ACCOUNT = { available: 0, reserved: 0, earned: 0, used: 0, adjusted: 0 };

/** The merchant's credit account, created empty the first time. */
const ensureAccount = async (merchantId) => {
  try {
    return await accountModel.findOneAndUpdate(
      { merchant: merchantId },
      { $setOnInsert: { merchant: merchantId } },
      { upsert: true, returnDocument: "after" }
    );
  } catch (error) {
    // Two requests created it at once; the other one won.
    if (error.code === 11000) return accountModel.findOne({ merchant: merchantId });
    throw error;
  }
};

/** Balances as shown to people. */
const accountView = (account) => {
  const { available, reserved, earned, used, adjusted } = { ...ZERO_ACCOUNT, ...(account?.toObject?.() || account || {}) };
  return { available, reserved, earned, used, adjusted, unused: available + reserved };
};

/**
 * Applies `inc` to the account only while `guard` holds (e.g. enough
 * available credit). Returns the updated account, or null when the guard
 * failed and nothing changed.
 */
const moveCredit = async (merchantId, inc, guard = {}) => {
  await ensureAccount(merchantId);
  return accountModel.findOneAndUpdate({ merchant: merchantId, ...guard }, { $inc: inc }, { returnDocument: "after" });
};

/** Writes a ledger line. A failure is logged and never undoes the balance change it describes. */
const record = async (entry, account) => {
  try {
    return await ledgerModel.create({ ...entry, availableAfter: account?.available ?? 0, reservedAfter: account?.reserved ?? 0 });
  } catch (error) {
    console.error(`Referral credit ledger write failed (${entry.type}):`, error.message);
    return null;
  }
};

/** Rounds to paisa, so repeated arithmetic never leaves 0.30000000000000004 behind. */
const money = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * Reserves up to `fee` of the merchant's available credit for a new invoice.
 * Returns the amount reserved (0 when there is none). Retries when another
 * request changed the balance in between.
 */
const reserveCredit = async (merchantId, fee) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await ensureAccount(merchantId);
    const amount = money(Math.min(account.available, Math.max(fee, 0)));
    if (amount <= 0) return 0;
    const updated = await moveCredit(merchantId, { available: -amount, reserved: amount }, { available: { $gte: amount } });
    if (updated) return amount;
  }
  return 0;
};

/** Puts a reservation back when the payment it was for could not be stored. No ledger line: nothing was submitted. */
const cancelReservation = (merchantId, amount) =>
  amount > 0 ? moveCredit(merchantId, { available: amount, reserved: -amount }, { reserved: { $gte: amount } }) : null;

/** Ledger line for credit reserved by a stored payment proof. */
const recordReservation = async (submission) => {
  if (!(submission.creditApplied > 0)) return;
  const account = await accountModel.findOne({ merchant: submission.merchant }).lean();
  await record({ merchant: submission.merchant, type: "reserved", amount: submission.creditApplied, paymentSubmission: submission._id, createdBy: submission.submittedBy }, account);
};

/** The proof was rejected: its reserved credit becomes available again. */
const releaseCredit = async ({ submission, actorId = null, reason = "" }) => {
  if (!(submission.creditApplied > 0)) return null;
  const amount = submission.creditApplied;
  const account = await moveCredit(submission.merchant, { available: amount, reserved: -amount }, { reserved: { $gte: amount } });
  if (!account) {
    console.error(`Referral credit for payment ${submission._id} was not reserved; nothing released`);
    return null;
  }
  await record({ merchant: submission.merchant, type: "released", amount, paymentSubmission: submission._id, createdBy: actorId, note: reason }, account);
  return account;
};

/**
 * The proof is being activated: its reserved credit is spent. Throws when the
 * reservation is missing, so the activation stops before anything else
 * changes. The ledger line is written by `recordCreditUse` once the
 * activation has fully succeeded; `undoCreditUse` reverses this on failure.
 */
const spendCredit = async (submission) => {
  if (!(submission.creditApplied > 0)) return null;
  const amount = submission.creditApplied;
  const account = await moveCredit(submission.merchant, { reserved: -amount, used: amount }, { reserved: { $gte: amount } });
  if (!account) throw Object.assign(new Error("The referral credit for this payment is no longer reserved"), { statusCode: 409 });
  return account;
};

const undoCreditUse = (submission) =>
  submission.creditApplied > 0 ? moveCredit(submission.merchant, { reserved: submission.creditApplied, used: -submission.creditApplied }) : null;

const recordCreditUse = async ({ submission, account, actorId = null }) => {
  if (!(submission.creditApplied > 0)) return;
  await record({ merchant: submission.merchant, type: "used", amount: submission.creditApplied, paymentSubmission: submission._id, createdBy: actorId }, account);
};

/**
 * Called after an administrator verifies a cash subscription payment of the
 * `merchant` (activating a proof or recording a payment by hand). If they
 * were referred and this is the first such payment, the referrer earns the
 * credit from Store settings — exactly once: the referral is claimed with a
 * conditional update, and the ledger refuses a second "earned" line.
 * Never throws: the payment it follows is already done.
 */
const qualifyReferral = async ({ req = null, merchant, submission = null, amountPaid }) => {
  try {
    if (!(amountPaid > 0)) return null;
    const { creditAmount } = await referralConfig();
    const now = new Date();
    const referral = await referralModel.findOneAndUpdate(
      { referred: merchant._id, status: "pending" },
      { status: "credited", creditAmount, creditedAt: now, qualifyingSubmission: submission?._id || null },
      { returnDocument: "after" }
    );
    if (!referral) return null;

    let account = null;
    if (creditAmount > 0) {
      account = await moveCredit(referral.referrer, { available: creditAmount, earned: creditAmount });
      if (!account) {
        // Hand the referral back so the next verified payment tries again.
        await referralModel.updateOne({ _id: referral._id, status: "credited" }, { status: "pending", creditAmount: 0, creditedAt: null, qualifyingSubmission: null });
        return null;
      }
      await record(
        {
          merchant: referral.referrer,
          type: "earned",
          amount: creditAmount,
          referral: referral._id,
          paymentSubmission: submission?._id || null,
          createdBy: req?.session?.user?._id || null,
          note: merchant.businessName || merchant.name,
        },
        account
      );
    }

    const referrer = await merchantModel.findById(referral.referrer).select("_id name email");
    await audit({
      req,
      action: "referral.credited",
      merchant: referrer,
      subject: referral,
      details: { amount: creditAmount, referred: merchant._id, referredName: merchant.businessName || merchant.name, available: account?.available },
    });
    if (referrer && creditAmount > 0) {
      await notifyMerchant({
        merchant: referrer,
        type: "referral_credit_earned",
        params: { amount: creditAmount, merchantName: merchant.businessName || merchant.name },
        link: "/merchant/referrals",
      });
    }
    return referral;
  } catch (error) {
    console.error("Referral credit could not be granted:", error.message);
    return null;
  }
};

/**
 * An administrator's correction: adds (positive) or removes (negative) available
 * credit, with a reason. Removing never takes the balance below zero. Returns
 * the updated account, or null when there is not enough available credit.
 */
const adjustCredit = async ({ req, merchant, amount, reason }) => {
  const account = await moveCredit(merchant._id, { available: amount, adjusted: amount }, amount < 0 ? { available: { $gte: -amount } } : {});
  if (!account) return null;
  await record({ merchant: merchant._id, type: "adjusted", amount, createdBy: req.session.user._id, note: reason }, account);
  await audit({ req, action: "credit.adjusted", merchant, subject: account, details: { amount, reason, available: account.available } });
  await notifyMerchant({ merchant, type: "referral_credit_adjusted", params: { amount, reason }, link: "/merchant/referrals" });
  return account;
};

module.exports = {
  normalizeReferralCode,
  ensureReferralCode,
  referralConfig,
  findReferrer,
  linkReferral,
  ensureAccount,
  accountView,
  money,
  reserveCredit,
  cancelReservation,
  recordReservation,
  releaseCredit,
  spendCredit,
  undoCreditUse,
  recordCreditUse,
  qualifyReferral,
  adjustCredit,
};
