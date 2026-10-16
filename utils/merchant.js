const mongoose = require("mongoose");
const os = require("os");
const merchantModel = require("../models/merchant.model");
const JobLock = require("../models/jobLock.model");
const productModel = require("../models/product.model");
const Setting = require("../models/setting.model");
const cloudinary = require("./cloudinary");
const { audit } = require("./audit");
const { notifyAdmins, notifyMerchant } = require("./notify");

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DAYS = Number(process.env.MERCHANT_TRIAL_DAYS) || 7;
const DEFAULT_MONTHLY_FEE = Math.max(Number(process.env.MERCHANT_MONTHLY_FEE) || 0, 0);

/** Statuses in which a merchant may add and edit products. */
const OPERATING_STATUSES = ["trial", "active"];

/** Product filter that hides everything a merchant may not show yet. Products with no value are older store products. */
const VISIBLE_APPROVAL = { $nin: ["pending", "rejected"] };

const BN_DIGITS = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

/** NID number as digits only; Bangla digits are accepted. Smart cards have 10 digits, older cards 13 or 17. */
const normalizeNid = (value) =>
  String(value || "")
    .replace(/[০-৯]/g, (digit) => BN_DIGITS[digit])
    .replace(/\D/g, "");

const isValidNid = (nid) => [10, 13, 17].includes(nid.length);

/** A Facebook page link as a full URL, or "" when it is not one. */
const normalizeFacebookPage = (value) => {
  let text = String(value || "").trim();
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase().replace(/^(www|m|web|mbasic)\./, "");
    if (!["facebook.com", "fb.com", "fb.me"].includes(host) || url.pathname.length < 2) return "";
    url.protocol = "https:";
    return url.toString();
  } catch {
    return "";
  }
};

/** `date` moved on by whole calendar months, clamped to the end of shorter months. */
const addMonths = (date, months) => {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  return next;
};

/** The status a merchant's dates call for, ignoring any suspension. */
const statusFromDates = (merchant, now = new Date()) => {
  if (merchant.trialEndsAt && merchant.trialEndsAt > now) return "trial";
  if (merchant.paidUntil && merchant.paidUntil > now) return "active";
  if (!merchant.trialEndsAt && !merchant.payments?.length) return "approved";
  return "payment_due";
};

/**
 * The status shown to people, which is finer than the stored one:
 * pending_approval (applications only), trial, active, payment_pending (proof
 * waiting for verification or activation), payment_due, grace, suspended.
 * `hasOpenProof` is whether a pending or approved proof is waiting.
 */
const accountStatus = (merchant, hasOpenProof = false, now = new Date()) => {
  if (merchant.status === "suspended") return "suspended";
  if (merchant.status === "trial" || merchant.status === "active") return merchant.status;
  if (hasOpenProof) return "payment_pending";
  if (merchant.status === "payment_due" && merchant.graceEndsAt && new Date(merchant.graceEndsAt) > now) return "grace";
  return "payment_due";
};

/** When the merchant's trial or paid time runs (or ran) out; null when they never had any. */
const expiresAt = (merchant) => {
  const ends = [merchant.trialEndsAt, merchant.paidUntil].filter(Boolean).map((date) => new Date(date).getTime());
  return ends.length ? new Date(Math.max(...ends)) : null;
};

/** Subscription length, grace period, default fee and payment instructions from Store settings. */
const billingConfig = async () => {
  const settings = await Setting.getSettings();
  const billing = settings.merchantBilling || {};
  return {
    periodDays: Number.isInteger(billing.periodDays) && billing.periodDays > 0 ? billing.periodDays : 30,
    graceDays: Number.isInteger(billing.graceDays) && billing.graceDays >= 0 ? billing.graceDays : 3,
    defaultFee: Number.isFinite(billing.defaultFee) && billing.defaultFee >= 0 ? billing.defaultFee : DEFAULT_MONTHLY_FEE,
    instructions: billing.instructions || "",
  };
};

/**
 * Sets an unsuspended merchant's status from their dates. When that leaves
 * payment due, a grace deadline is set if there is not a future one already;
 * otherwise the deadline is cleared.
 */
const settleStatus = (merchant, graceDays, now = new Date()) => {
  merchant.status = statusFromDates(merchant, now);
  if (merchant.status !== "payment_due") merchant.graceEndsAt = null;
  else if (!merchant.graceEndsAt || merchant.graceEndsAt <= now) merchant.graceEndsAt = new Date(now.getTime() + graceDays * DAY_MS);
};

/** Days before the end of a trial or paid period when reminders go out, latest first. */
const REMINDER_DAYS = [1, 3];

/**
 * Reminders before a trial or paid period ends: 3 days and 1 day before, to
 * the merchant and to administrators. Each is keyed by merchant, period end
 * and window, so a rerun (or a second server) never sends one twice, and a
 * renewed period gets its own reminders. When the job was down across a
 * window, only the nearest one is sent, not every missed one.
 */
const sendExpiryReminders = async (filter, now) => {
  let sent = 0;
  const horizon = new Date(now.getTime() + Math.max(...REMINDER_DAYS) * DAY_MS);
  const merchants = await merchantModel
    .find({ ...filter, status: { $in: ["trial", "active"] }, $or: [{ trialEndsAt: { $gt: now, $lte: horizon } }, { paidUntil: { $gt: now, $lte: horizon } }] })
    .select("_id name email status trialEndsAt paidUntil")
    .lean();

  for (const merchant of merchants) {
    const endsAt = expiresAt(merchant);
    if (!endsAt || endsAt <= now || endsAt > horizon) continue;
    const daysLeft = (endsAt - now) / DAY_MS;
    const window = REMINDER_DAYS.find((days) => daysLeft <= days);
    const isTrial = merchant.trialEndsAt && endsAt.getTime() === new Date(merchant.trialEndsAt).getTime() && !(merchant.paidUntil > merchant.trialEndsAt);
    const key = `${merchant._id}:${endsAt.toISOString()}:${window}d`;
    const params = { endsAt, days: window };

    if (await notifyMerchant({ merchant, type: isTrial ? "trial_ending" : "subscription_expiring", params, link: "/merchant/billing", dedupeKey: `remind:${key}` })) sent += 1;
    await notifyAdmins({
      type: "merchant_expiring",
      params: { merchantName: merchant.name, endsAt, trial: Boolean(isTrial) },
      merchant,
      link: `/merchants?status=expiring`,
      dedupeKey: `remind-admin:${key}`,
    });
  }
  return sent;
};

/**
 * Brings every merchant's stored status up to date with the clock, and sends
 * the reminders and notices that go with it. Runs whenever merchant data is
 * read and on a schedule (`startMerchantBillingJob`). Everything is decided
 * from dates stored in the database, so after a restart or a missed run the
 * next run simply catches up.
 *
 * 1. trial → active when they paid beyond the trial;
 * 2. reminders 3 days and 1 day before the end of a trial or paid period;
 * 3. trial or active → payment due on the expiry day; merchant and admins are
 *    told, and the merchant has `graceDays` to pay (never less, even late);
 * 4. payment due → suspended once the grace deadline passes unpaid; merchant
 *    and admins are told.
 *
 * Each status change is claimed with a conditional update, and each notice has
 * a dedupe key, so overlapping or repeated runs change and send nothing twice.
 * Suspended merchants are left alone — only an administrator lifts that.
 */
const syncMerchantStatuses = async (filter = {}, { reminders = true } = {}) => {
  const now = new Date();
  const summary = { reminders: 0, expired: 0, suspended: 0 };

  await merchantModel.updateMany(
    { ...filter, status: "trial", trialEndsAt: { $lte: now }, paidUntil: { $gt: now } },
    { status: "active" }
  );

  if (reminders) summary.reminders = await sendExpiryReminders(filter, now);

  const lapsed = await merchantModel
    .find({
      ...filter,
      $or: [
        { status: "trial", trialEndsAt: { $lte: now } },
        { status: "active", $or: [{ paidUntil: null }, { paidUntil: { $lte: now } }] },
        // Accounts that fell due before grace periods existed.
        { status: "payment_due", graceEndsAt: null },
      ],
    })
    .select("_id status name email trialEndsAt paidUntil")
    .lean();

  const { graceDays } = lapsed.length ? await billingConfig() : { graceDays: 0 };

  for (const merchant of lapsed) {
    const expiredAt = expiresAt(merchant);
    const from = Math.max(now.getTime(), expiredAt?.getTime() || 0);
    const graceEndsAt = new Date(from + graceDays * DAY_MS);
    const claimed = await merchantModel.findOneAndUpdate(
      { _id: merchant._id, status: merchant.status, ...(merchant.status === "payment_due" ? { graceEndsAt: null } : {}) },
      { status: "payment_due", graceEndsAt },
      { returnDocument: "after" }
    );
    if (!claimed) continue;
    summary.expired += 1;
    const key = `${claimed._id}:${(expiredAt || now).toISOString()}`;
    await audit({ action: "subscription.expired", merchant: claimed, subject: claimed, details: { from: merchant.status, graceEndsAt } });
    await notifyMerchant({ merchant: claimed, type: "payment_due", params: { graceEndsAt }, link: "/merchant/billing", dedupeKey: `due:${key}` });
    await notifyAdmins({
      type: "merchant_payment_due",
      params: { merchantName: claimed.name, graceEndsAt },
      merchant: claimed,
      link: "/merchants?status=payment_due",
      dedupeKey: `due-admin:${key}`,
    });
  }

  const overdue = await merchantModel
    .find({ ...filter, status: "payment_due", graceEndsAt: { $ne: null, $lte: now } })
    .select("_id")
    .lean();

  for (const { _id } of overdue) {
    const suspended = await merchantModel.findOneAndUpdate(
      { _id, status: "payment_due", graceEndsAt: { $ne: null, $lte: now } },
      { status: "suspended", suspendedAuto: true, suspendedAt: now, suspendedReason: "Subscription not paid within the grace period" },
      { returnDocument: "after" }
    );
    if (!suspended) continue;
    summary.suspended += 1;
    const key = `${suspended._id}:${suspended.graceEndsAt.toISOString()}`;
    await audit({ action: "account.suspended", merchant: suspended, subject: suspended, details: { automatic: true, graceEndsAt: suspended.graceEndsAt } });
    await notifyMerchant({ merchant: suspended, type: "account_suspended", link: "/merchant/billing", dedupeKey: `suspend:${key}` });
    await notifyAdmins({
      type: "merchant_auto_suspended",
      params: { merchantName: suspended.name },
      merchant: suspended,
      link: "/merchants?status=suspended",
      dedupeKey: `suspend-admin:${key}`,
    });
  }

  return summary;
};

const JOB_NAME = "merchant-billing";
const LEASE_MS = 10 * 60 * 1000;
const INSTANCE = `${os.hostname()}:${process.pid}:${Date.now()}`;

/**
 * One run of the scheduled check, under a database lease so that only one API
 * process runs it at a time. Records when it ran and what it did. Returns the
 * summary, or null when another process holds the lease.
 */
const runMerchantBillingJob = async () => {
  const now = new Date();
  let lock;
  try {
    lock = await JobLock.findOneAndUpdate(
      { name: JOB_NAME, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
      { owner: INSTANCE, lockedUntil: new Date(now.getTime() + LEASE_MS), lastStartedAt: now },
      { upsert: true, returnDocument: "after" }
    );
  } catch (error) {
    if (error.code === 11000) return null; // Someone else holds the lease.
    throw error;
  }
  if (!lock || lock.owner !== INSTANCE) return null;

  let summary = null;
  let lastError = "";
  try {
    summary = await syncMerchantStatuses();
  } catch (error) {
    lastError = error.message;
    console.error("Merchant billing check failed:", error.message);
  }
  await JobLock.updateOne(
    { name: JOB_NAME, owner: INSTANCE },
    { lockedUntil: null, lastFinishedAt: new Date(), lastError, ...(summary ? { lastSummary: summary } : {}) }
  );
  return summary;
};

/**
 * Starts the scheduled check: shortly after startup (so a restart catches up
 * at once) and then every `intervalMs`. Safe with several processes.
 */
const startMerchantBillingJob = (intervalMs = 15 * 60 * 1000) => {
  const run = () => runMerchantBillingJob().catch((error) => console.error("Merchant billing job error:", error.message));
  setTimeout(run, 5 * 1000).unref();
  setInterval(run, intervalMs).unref();
};

/** When the scheduled check last ran, for the admin panel. */
const billingJobStatus = () => JobLock.findOne({ name: JOB_NAME }).select("-_id lastStartedAt lastFinishedAt lastError lastSummary").lean();

/** Merchants whose products must not appear on the storefront. Their data is kept. */
const hiddenMerchantIds = () => merchantModel.distinct("_id", { $or: [{ status: "suspended" }, { locked: true }] });

/** Mongo filter for products customers may see and buy. */
const publicProductFilter = async () => ({
  approvalStatus: VISIBLE_APPROVAL,
  listingStatus: { $ne: "hidden" },
  merchant: { $nin: await hiddenMerchantIds() },
});

/**
 * Whether one product may be shown to customers right now. Used by public
 * endpoints that take a product id (variants, reviews) so a suspended or
 * locked merchant's product cannot be reached by id either.
 */
const isPublicProduct = async (productId) =>
  Boolean(productId) && mongoose.isValidObjectId(productId) && Boolean(await productModel.exists({ _id: productId, ...(await publicProductFilter()) }));

/** A signed, admin-only link to an NID photo stored as an authenticated asset. */
const nidImageUrl = (image) =>
  image?.publicId
    ? cloudinary.url(image.publicId, { type: "authenticated", sign_url: true, secure: true, format: image.format || undefined })
    : "";

module.exports = {
  DAY_MS,
  TRIAL_DAYS,
  DEFAULT_MONTHLY_FEE,
  OPERATING_STATUSES,
  VISIBLE_APPROVAL,
  normalizeNid,
  isValidNid,
  normalizeFacebookPage,
  addMonths,
  statusFromDates,
  expiresAt,
  accountStatus,
  billingConfig,
  settleStatus,
  syncMerchantStatuses,
  sendExpiryReminders,
  runMerchantBillingJob,
  startMerchantBillingJob,
  billingJobStatus,
  hiddenMerchantIds,
  publicProductFilter,
  isPublicProduct,
  nidImageUrl,
};
