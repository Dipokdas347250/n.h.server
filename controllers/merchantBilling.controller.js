const submissionModel = require("../models/paymentSubmission.model");
const merchantModel = require("../models/merchant.model");
const auditLogModel = require("../models/auditLog.model");
const subscriptionModel = require("../models/subscription.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { DAY_MS, expiresAt, accountStatus, billingConfig, settleStatus } = require("../utils/merchant");
const { removeTempFiles, storePrivateFiles, destroyPrivateFiles, attachmentView } = require("../utils/secureUpload");
const { audit } = require("../utils/audit");
const { notifyAdmins, notifyMerchant } = require("../utils/notify");

/*
 * Manual subscription payments. The merchant pays by bKash, Nagad or bank
 * outside the site and submits proof; an administrator checks it, approves or
 * rejects it, and then activates the account, which starts a new period.
 *
 * Proof alone never activates anything: an account only becomes active when an
 * administrator presses Activate on an approved payment.
 *
 * Merchant handlers are mounted behind `requireMerchant` but deliberately not
 * behind a status check, so a suspended merchant can still pay. Every query is
 * filtered by `req.merchant._id`.
 */

const { PAYMENT_METHODS, SUBMISSION_STATUSES } = submissionModel;
const MAX_AMOUNT = 10_000_000;

/** Transaction IDs as the bank or wallet prints them: no spaces, upper case. */
const normalizeTransactionId = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();
const isValidTransactionId = (value) => /^[A-Z0-9][A-Z0-9._/-]{3,59}$/.test(value);

const text = (value, max) => String(value || "").trim().slice(0, max);

/** A submission as its merchant sees it. */
const submissionView = (submission) => ({
  _id: submission._id,
  method: submission.method,
  methodOther: submission.methodOther,
  amount: submission.amount,
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

const MERCHANT_FIELDS = "name phone email status locked monthlyFee trialEndsAt paidUntil graceEndsAt suspendedAuto";

// ---------------------------------------------------------------- merchant

/** The merchant's subscription, where to pay, and their own payment proofs. */
exports.myBillingController = asyncHandler(async (req, res) => {
  const merchant = req.merchant;
  const [config, submissions] = await Promise.all([
    billingConfig(),
    submissionModel.find({ merchant: merchant._id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

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
    methods: PAYMENT_METHODS,
    hasPending: submissions.some((submission) => submission.status === "pending"),
    submissions: submissions.map(submissionView),
  });
});

/** "Submit payment proof": method, amount, transaction ID, screenshot and an optional message. */
exports.submitPaymentController = asyncHandler(async (req, res) => {
  try {
    const merchant = req.merchant;
    const body = req.body || {};
    const method = String(body.method || "").toLowerCase();
    const methodOther = method === "other" ? text(body.methodOther, 50) : "";
    const amount = Number(body.amount);
    const transactionId = normalizeTransactionId(body.transactionId);
    const message = text(body.message, 1000);
    const screenshotFile = req.files?.screenshot?.[0];

    if (
      !PAYMENT_METHODS.includes(method) ||
      (method === "other" && !methodOther) ||
      !Number.isFinite(amount) || amount < 1 || amount > MAX_AMOUNT ||
      !isValidTransactionId(transactionId)
    ) {
      return apiResponse(res, 400, messages.paymentProofInvalid);
    }
    if (!screenshotFile) return apiResponse(res, 400, messages.paymentProofScreenshotRequired);

    // One proof at a time keeps the queue honest, and an ID may be used once.
    if (await submissionModel.exists({ merchant: merchant._id, status: "pending" })) {
      return apiResponse(res, 409, messages.paymentProofPending);
    }
    if (await submissionModel.exists({ transactionKey: transactionId })) {
      return apiResponse(res, 409, messages.paymentProofDuplicate);
    }

    const [screenshot] = await storePrivateFiles([screenshotFile], `nh-shop/merchant-private/${merchant._id}/payments`);
    let submission;
    try {
      submission = await submissionModel.create({
        merchant: merchant._id,
        submittedBy: req.session.user._id,
        method,
        methodOther,
        amount: Math.round(amount * 100) / 100,
        transactionId,
        transactionKey: transactionId,
        expectedAmount: merchant.monthlyFee,
        screenshot,
        message,
      });
    } catch (error) {
      await destroyPrivateFiles([screenshot]);
      // Two submissions of the same ID at once: the unique index stops the second.
      if (error.code === 11000) return apiResponse(res, 409, messages.paymentProofDuplicate);
      throw error;
    }

    await audit({ req, action: "payment.submitted", merchant, subject: submission, details: { method, amount: submission.amount, transactionId } });
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

  const [sameTransaction, history, trail] = await Promise.all([
    submissionModel
      .find({ transactionId: submission.transactionId, _id: { $ne: submission._id } })
      .populate({ path: "merchant", select: "name" })
      .select("merchant amount status createdAt")
      .lean(),
    submissionModel
      .find({ merchant: submission.merchant?._id, _id: { $ne: submission._id } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("method amount transactionId status createdAt")
      .lean(),
    auditLogModel.find({ subjectId: submission._id }).sort({ createdAt: 1 }).lean(),
  ]);

  apiResponse(res, 200, messages.paymentProofsFetched, { ...adminSubmissionView(submission), sameTransaction, history, trail });
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

  const merchant = await merchantModel.findById(submission.merchant);
  await audit({ req, action: "payment.rejected", merchant, subject: submission, details: { amount: submission.amount, transactionId: submission.transactionId, reason } });
  if (merchant) {
    await notifyMerchant({ merchant, type: "payment_rejected", params: { amount: submission.amount, reason }, link: "/merchant/billing" });
  }
  apiResponse(res, 200, messages.paymentProofRejected, submissionView(submission));
});

/**
 * "Activate account" on an approved payment. A new period of `periodDays`
 * starts at this moment — never from an earlier period's dates. Lifts any
 * suspension, records the period in the subscription history (at most once
 * per proof, enforced by a unique index) and tells the merchant and admins.
 */
exports.activateFromPaymentController = asyncHandler(async (req, res) => {
  const now = new Date();
  const claimed = await submissionModel.findOneAndUpdate(
    { _id: req.params.id, status: "approved" },
    { status: "activated", activatedBy: req.session.user._id, activatedAt: now },
    { returnDocument: "after" }
  );
  if (!claimed) {
    const existing = await submissionModel.findById(req.params.id).select("status").lean();
    if (!existing) return apiResponse(res, 404, messages.paymentProofNotFound);
    return apiResponse(res, 409, existing.status === "pending" ? messages.paymentProofNotApproved : messages.paymentProofDecided);
  }

  try {
    const merchant = await merchantModel.findById(claimed.merchant);
    if (!merchant) throw Object.assign(new Error("Merchant not found"), { statusCode: 404 });

    const { periodDays, graceDays } = await billingConfig();
    const periodStart = now;
    const periodEnd = new Date(periodStart.getTime() + periodDays * DAY_MS);
    const previousStatus = merchant.status;

    merchant.payments.push({
      amount: claimed.amount,
      months: Math.max(1, Math.round(periodDays / 30)),
      method: claimed.method === "other" ? claimed.methodOther || "other" : claimed.method,
      reference: claimed.transactionId,
      note: claimed.message,
      periodStart,
      periodEnd,
      recordedBy: req.session.user._id,
      submission: claimed._id,
    });
    merchant.paidUntil = periodEnd;
    merchant.suspendedReason = "";
    merchant.suspendedAt = null;
    merchant.suspendedAuto = false;
    settleStatus(merchant, graceDays, now);
    await merchant.save();

    claimed.periodStart = periodStart;
    claimed.periodEnd = periodEnd;
    await claimed.save();
    // Recorded once the account is saved. A proof starts one period only;
    // the unique index refuses a second.
    await subscriptionModel.create({
      merchant: merchant._id,
      kind: "paid",
      startsAt: periodStart,
      endsAt: periodEnd,
      fee: merchant.monthlyFee,
      amountPaid: claimed.amount,
      source: "payment_proof",
      paymentSubmission: claimed._id,
      createdBy: req.session.user._id,
      note: claimed.transactionId,
    });

    await audit({
      req,
      action: "account.activated",
      merchant,
      subject: claimed,
      details: { from: previousStatus, to: merchant.status, periodStart, periodEnd, amount: claimed.amount, transactionId: claimed.transactionId },
    });
    await notifyMerchant({ merchant, type: "account_activated", params: { paidUntil: periodEnd }, link: "/merchant/billing" });
    await notifyAdmins({
      type: "merchant_reactivated",
      params: { merchantName: merchant.name, paidUntil: periodEnd, from: previousStatus },
      merchant,
      link: `/merchants/payments?open=${claimed._id}`,
    });
    apiResponse(res, 200, messages.merchantActivated, { submission: submissionView(claimed), merchant });
  } catch (error) {
    // Hand the proof back so the activation can be tried again.
    await submissionModel.updateOne({ _id: claimed._id, status: "activated" }, { status: "approved", activatedBy: null, activatedAt: null });
    throw error;
  }
});
