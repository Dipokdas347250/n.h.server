const submissionModel = require("../models/paymentSubmission.model");
const merchantModel = require("../models/merchant.model");
const auditLogModel = require("../models/auditLog.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { DAY_MS, expiresAt, accountStatus, billingConfig } = require("../utils/merchant");
const { removeTempFiles, storePrivateFiles, destroyPrivateFiles, attachmentView } = require("../utils/secureUpload");
const { audit } = require("../utils/audit");
const { notifyAdmins, notifyMerchant } = require("../utils/notify");
const { activateSubmission } = require("../utils/billing");
const { ensureAccount, accountView, money, reserveCredit, cancelReservation, recordReservation, releaseCredit } = require("../utils/referral");

/*
 * Manual subscription payments. The merchant sends the fee by bKash or Nagad
 * to the number in Store settings and submits proof; an administrator checks
 * it, approves or rejects it, and then activates the account, which starts a
 * new period.
 *
 * Referral credit is taken off the invoice automatically: submitting reserves
 * it, rejecting gives it back, activating spends it. When credit covers the
 * whole fee the merchant submits a "credit" proof with no cash, which goes
 * through the same verification.
 *
 * Proof alone never activates anything: an account only becomes active when an
 * administrator presses Activate on an approved payment.
 *
 * Merchant handlers are mounted behind `requireMerchant` but deliberately not
 * behind a status check, so a suspended merchant can still pay. Every query is
 * filtered by `req.merchant._id`.
 */

const { SUBMISSION_STATUSES } = submissionModel;
const MAX_AMOUNT = 10_000_000;
/** How far back a payment date may be. */
const MAX_PAYMENT_AGE_DAYS = 90;

/** Transaction IDs as the bank or wallet prints them: no spaces, upper case. */
const normalizeTransactionId = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();
const isValidTransactionId = (value) => /^[A-Z0-9][A-Z0-9._/-]{3,59}$/.test(value);

const text = (value, max) => String(value || "").trim().slice(0, max);

/**
 * The payment date the merchant typed. A bare `YYYY-MM-DD` is midday in Dhaka,
 * so it is the same calendar day everywhere. Null unless it is within the last
 * `MAX_PAYMENT_AGE_DAYS` days and not in the future.
 */
const parsePaidAt = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00+06:00` : raw);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  if (date.getTime() > now + DAY_MS || date.getTime() < now - MAX_PAYMENT_AGE_DAYS * DAY_MS) return null;
  return date;
};

/** A submission as its merchant sees it. */
const submissionView = (submission) => ({
  _id: submission._id,
  method: submission.method,
  methodOther: submission.methodOther,
  channel: submission.channel || "manual",
  amount: submission.amount,
  payTo: submission.payTo || "",
  paidAt: submission.paidAt || null,
  fee: submission.fee || 0,
  creditApplied: submission.creditApplied || 0,
  expectedAmount: submission.expectedAmount,
  transactionId: submission.transactionId,
  message: submission.message,
  screenshot: attachmentView(submission.screenshot),
  status: submission.status,
  rejectionReason: submission.rejectionReason,
  reviewedAt: submission.reviewedAt,
  activatedAt: submission.activatedAt,
  periodStart: submission.periodStart,
  periodEnd: submission.periodEnd,
  createdAt: submission.createdAt,
});

/** A submission as administrators see it: everything, with the merchant and the reviewers. */
const adminSubmissionView = (submission) => ({
  ...submissionView(submission),
  expectedAmount: submission.expectedAmount,
  viewedAt: submission.viewedAt,
  merchant: submission.merchant,
  submittedBy: submission.submittedBy,
  reviewedBy: submission.reviewedBy,
  activatedBy: submission.activatedBy,
});

const MERCHANT_FIELDS = "name businessName phone email status locked monthlyFee trialEndsAt paidUntil graceEndsAt suspendedAuto";

// ---------------------------------------------------------------- merchant

/**
 * The merchant's subscription, where to pay, the next invoice (fee less
 * referral credit) and their own payment proofs.
 */
exports.myBillingController = asyncHandler(async (req, res) => {
  const merchant = req.merchant;
  const [config, submissions, account] = await Promise.all([
    billingConfig(),
    submissionModel.find({ merchant: merchant._id }).sort({ createdAt: -1 }).limit(50).lean(),
    ensureAccount(merchant._id),
  ]);
  const credit = accountView(account);
  const fee = merchant.monthlyFee || 0;
  const creditApplied = money(Math.min(credit.available, fee));

  apiResponse(res, 200, messages.billingFetched, {
    status: merchant.status,
    accountStatus: accountStatus(merchant, submissions.some((submission) => ["pending", "approved"].includes(submission.status))),
    monthlyFee: merchant.monthlyFee,
    trialStartsAt: merchant.trialStartsAt,
    trialEndsAt: merchant.trialEndsAt,
    paidUntil: merchant.paidUntil,
    expiresAt: expiresAt(merchant),
    graceEndsAt: merchant.status === "payment_due" ? merchant.graceEndsAt : null,
    suspendedAuto: merchant.status === "suspended" && merchant.suspendedAuto,
    periodDays: config.periodDays,
    graceDays: config.graceDays,
    instructions: config.instructions,
    paymentAccounts: config.accounts,
    methods: config.methods,
    credit,
    // What the next payment proof will be: credit is applied automatically,
    // and what it does not cover stays available for later months.
    invoice: { fee, creditApplied, payable: money(fee - creditApplied), creditLeft: money(credit.available - creditApplied) },
    hasPending: submissions.some((submission) => submission.status === "pending"),
    submissions: submissions.map(submissionView),
  });
});

/**
 * "Submit payment request": method, the number paid to, amount, transaction
 * ID, payment date, screenshot and an optional message. Available referral
 * credit is reserved against the fee first. With `method: "credit"` (only when
 * credit covers the whole fee) no cash, transaction ID or screenshot is needed.
 * Nothing is activated until an administrator verifies it.
 */
exports.submitPaymentController = asyncHandler(async (req, res) => {
  try {
    const merchant = req.merchant;
    const body = req.body || {};
    const config = await billingConfig();
    const method = String(body.method || "").toLowerCase();
    const creditOnly = method === "credit";
    const amount = creditOnly ? 0 : Number(body.amount);
    const transactionId = creditOnly ? "" : normalizeTransactionId(body.transactionId);
    const paidAt = creditOnly ? null : parsePaidAt(body.paidAt);
    const message = text(body.message, 1000);
    const screenshotFile = req.files?.screenshot?.[0];

    if (!creditOnly) {
      if (!config.methods.includes(method) || !Number.isFinite(amount) || amount < 1 || amount > MAX_AMOUNT || !isValidTransactionId(transactionId)) {
        return apiResponse(res, 400, messages.paymentProofInvalid);
      }
      if (!paidAt) return apiResponse(res, 400, messages.paymentDateInvalid);
      if (!screenshotFile) return apiResponse(res, 400, messages.paymentProofScreenshotRequired);
    }

    // One proof at a time keeps the queue honest, and an ID may be used once.
    if (await submissionModel.exists({ merchant: merchant._id, status: "pending" })) {
      return apiResponse(res, 409, messages.paymentProofPending);
    }
    if (!creditOnly && (await submissionModel.exists({ transactionKey: transactionId }))) {
      return apiResponse(res, 409, messages.paymentProofDuplicate);
    }

    // The invoice: the fee less whatever referral credit is available.
    const fee = merchant.monthlyFee || 0;
    const creditApplied = await reserveCredit(merchant._id, fee);
    const expectedAmount = money(fee - creditApplied);
    if (creditOnly && (fee <= 0 || expectedAmount > 0)) {
      await cancelReservation(merchant._id, creditApplied);
      return apiResponse(res, 400, messages.creditNotEnough);
    }

    let screenshot = null;
    let submission;
    try {
      if (!creditOnly) [screenshot] = await storePrivateFiles([screenshotFile], `nh-shop/merchant-private/${merchant._id}/payments`);
      submission = await submissionModel.create({
        merchant: merchant._id,
        submittedBy: req.session.user._id,
        channel: "manual",
        method,
        amount: Math.round(amount * 100) / 100,
        payTo: config.accounts.find((account) => account.method === method)?.number || "",
        paidAt,
        transactionId,
        ...(transactionId ? { transactionKey: transactionId } : {}),
        fee,
        creditApplied,
        expectedAmount,
        ...(screenshot ? { screenshot } : {}),
        message,
      });
    } catch (error) {
      await cancelReservation(merchant._id, creditApplied);
      if (screenshot) await destroyPrivateFiles([screenshot]);
      // Two submissions of the same ID at once: the unique index stops the second.
      if (error.code === 11000) return apiResponse(res, 409, messages.paymentProofDuplicate);
      throw error;
    }
    await recordReservation(submission);

    await audit({
      req,
      action: "payment.submitted",
      merchant,
      subject: submission,
      details: { method, amount: submission.amount, transactionId, paidAt, fee, creditApplied },
    });
    await notifyAdmins({
      type: "payment_submitted",
      params: { merchantName: merchant.name, amount: submission.amount, method },
      merchant,
      link: `/merchants/payments?open=${submission._id}`,
    });
    await notifyMerchant({ merchant, type: "payment_pending", params: { amount: submission.amount }, link: "/merchant/billing" });

    return apiResponse(res, 201, messages.paymentProofSubmitted, submissionView(submission));
  } finally {
    removeTempFiles(req);
  }
});

// ---------------------------------------------------------------- admin

/** Payment proofs for review. `status` defaults to pending (`all` lists everything); `merchant` narrows to one. */
exports.allPaymentSubmissionsController = asyncHandler(async (req, res) => {
  const status = req.query.status || "new";
  const query = {};
  if (SUBMISSION_STATUSES.includes(status)) query.status = status;
  // "New": waiting and not yet opened by an administrator.
  if (status === "new") Object.assign(query, { status: "pending", viewedAt: null });
  if (req.query.merchant) query.merchant = String(req.query.merchant);

  const [submissions, statusCounts] = await Promise.all([
    submissionModel
      .find(query)
      .sort({ createdAt: ["new", "pending", "approved"].includes(status) ? 1 : -1 })
      .limit(200)
      .populate({ path: "merchant", select: MERCHANT_FIELDS })
      .populate({ path: "reviewedBy", select: "fullname" })
      .lean(),
    submissionModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(SUBMISSION_STATUSES.map((key) => [key, 0]));
  statusCounts.forEach(({ _id, count }) => {
    counts[_id] = count;
  });
  counts.new = await submissionModel.countDocuments({ status: "pending", viewedAt: null });
  apiResponse(res, 200, messages.paymentProofsFetched, { submissions: submissions.map(adminSubmissionView), counts });
});

/** One proof, with the merchant's subscription, other uses of the same transaction ID, and its audit trail. */
exports.singlePaymentSubmissionController = asyncHandler(async (req, res) => {
  // Opening a proof takes it out of "New".
  await submissionModel.updateOne({ _id: req.params.id, viewedAt: null }, { viewedAt: new Date() });
  const submission = await submissionModel
    .findById(req.params.id)
    .populate({ path: "merchant", select: MERCHANT_FIELDS })
    .populate({ path: "submittedBy reviewedBy activatedBy", select: "fullname email" })
    .lean();
  if (!submission) return apiResponse(res, 404, messages.paymentProofNotFound);

  const [sameTransaction, history, trail, account] = await Promise.all([
    // Credit-only proofs have no transaction ID to compare.
    submission.transactionId
      ? submissionModel
          .find({ transactionId: submission.transactionId, _id: { $ne: submission._id } })
          .populate({ path: "merchant", select: "name" })
          .select("merchant amount status createdAt")
          .lean()
      : [],
    submissionModel
      .find({ merchant: submission.merchant?._id, _id: { $ne: submission._id } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("method amount creditApplied transactionId status createdAt")
      .lean(),
    auditLogModel.find({ subjectId: submission._id }).sort({ createdAt: 1 }).lean(),
    submission.merchant ? ensureAccount(submission.merchant._id) : null,
  ]);

  apiResponse(res, 200, messages.paymentProofsFetched, {
    ...adminSubmissionView(submission),
    sameTransaction,
    history,
    trail,
    merchantCredit: accountView(account),
  });
});

/** The administrator checked the transaction and screenshot. Nothing is activated yet. */
exports.approvePaymentController = asyncHandler(async (req, res) => {
  const submission = await submissionModel.findOneAndUpdate(
    { _id: req.params.id, status: "pending" },
    { status: "approved", reviewedBy: req.session.user._id, reviewedAt: new Date(), rejectionReason: "" },
    { returnDocument: "after" }
  );
  if (!submission) {
    const exists = await submissionModel.exists({ _id: req.params.id });
    return apiResponse(res, exists ? 409 : 404, exists ? messages.paymentProofDecided : messages.paymentProofNotFound);
  }

  const merchant = await merchantModel.findById(submission.merchant);
  await audit({ req, action: "payment.approved", merchant, subject: submission, details: { amount: submission.amount, transactionId: submission.transactionId } });
  if (merchant) await notifyMerchant({ merchant, type: "payment_approved", params: { amount: submission.amount }, link: "/merchant/billing" });
  apiResponse(res, 200, messages.paymentProofApproved, submissionView(submission));
});

/** Not accepted. The reason is shown to the merchant and emailed to them. A proof that was already activated cannot be rejected. */
exports.rejectPaymentController = asyncHandler(async (req, res) => {
  const reason = text(req.body?.reason, 500);
  if (reason.length < 3) return apiResponse(res, 400, messages.paymentProofReasonRequired);

  const submission = await submissionModel.findOneAndUpdate(
    { _id: req.params.id, status: { $in: ["pending", "approved"] } },
    // Rejecting frees the transaction ID, so a corrected proof can use it again.
    { $set: { status: "rejected", rejectionReason: reason, reviewedBy: req.session.user._id, reviewedAt: new Date() }, $unset: { transactionKey: "" } },
    { returnDocument: "after" }
  );
  if (!submission) {
    const exists = await submissionModel.exists({ _id: req.params.id });
    return apiResponse(res, exists ? 409 : 404, exists ? messages.paymentProofDecided : messages.paymentProofNotFound);
  }

  // Credit reserved for this invoice is available again.
  await releaseCredit({ submission, actorId: req.session.user._id, reason });
  const merchant = await merchantModel.findById(submission.merchant);
  await audit({
    req,
    action: "payment.rejected",
    merchant,
    subject: submission,
    details: { amount: submission.amount, transactionId: submission.transactionId, reason, creditReleased: submission.creditApplied || 0 },
  });
  if (merchant) {
    await notifyMerchant({ merchant, type: "payment_rejected", params: { amount: submission.amount, reason }, link: "/merchant/billing" });
  }
  apiResponse(res, 200, messages.paymentProofRejected, submissionView(submission));
});

/**
 * "Activate account" on an approved payment: starts the new period, spends the
 * reserved referral credit and, for a referred merchant's first cash payment,
 * credits the referrer. See `activateSubmission` in utils/billing.js.
 */
exports.activateFromPaymentController = asyncHandler(async (req, res) => {
  const result = await activateSubmission({ submissionId: req.params.id, req });
  if (result.message) return apiResponse(res, result.status, result.message);
  apiResponse(res, 200, messages.merchantActivated, { submission: submissionView(result.submission), merchant: result.merchant });
});
