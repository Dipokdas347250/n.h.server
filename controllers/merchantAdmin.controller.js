const applicationModel = require("../models/merchantApplication.model");
const merchantModel = require("../models/merchant.model");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/checkout.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const {
  DAY_MS,
  TRIAL_DAYS,
  addMonths,
  billingConfig,
  settleStatus,
  syncMerchantStatuses,
  nidImageUrl,
  expiresAt,
  accountStatus,
  billingJobStatus,
} = require("../utils/merchant");
const { audit } = require("../utils/audit");
const { notifyMerchant } = require("../utils/notify");
const { decryptNid, maskNid } = require("../utils/nidCrypto");
const subscriptionModel = require("../models/subscription.model");
const auditLogModel = require("../models/auditLog.model");
const submissionModel = require("../models/paymentSubmission.model");
const { buildMerchantSummary } = require("./merchant.controller");

/*
 * The super-admin side of the merchant system. Mounted behind
 * `isAuthorizeRole("admin")`, so only administrators reach any of it.
 */

const MERCHANT_STATUSES = ["approved", "trial", "active", "payment_due", "suspended"];
/** How far ahead "Expiring soon" looks. */
const EXPIRING_DAYS = 7;

const parseFee = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 ? fee : undefined;
};

const reason = (body) => String(body?.reason || "").trim().slice(0, 500);

/** Drops the NID fields and adds the masked number, for any application or merchant sent to the browser. */
const withMaskedNid = ({ nidHash, nidEncrypted, nidNumber, ...rest }) => ({ ...rest, nidMasked: maskNid(rest.nidLast4) });

// ---------------------------------------------------------------- applications

exports.allApplicationsController = asyncHandler(async (req, res) => {
  const status = req.query.status || "pending";
  const query = ["pending", "approved", "rejected"].includes(status) ? { status } : {};

  const applications = await applicationModel
    .find(query)
    .sort({ createdAt: -1 })
    .select("-nidFront -nidBack")
    .populate({ path: "duplicateOf", select: "name email status" })
    .populate({ path: "reviewedBy", select: "fullname" })
    .lean();
  const pending = await applicationModel.countDocuments({ status: "pending" });
  apiResponse(res, 200, messages.merchantApplicationsFetched, { applications: applications.map(withMaskedNid), pending });
});

/** One application with signed links to its NID photos and every merchant already using that NID. */
exports.singleApplicationController = asyncHandler(async (req, res) => {
  const application = await applicationModel
    .findById(req.params.id)
    .populate({ path: "reviewedBy", select: "fullname" })
    .lean();
  if (!application) return apiResponse(res, 404, messages.merchantApplicationNotFound);

  const sameNid = await merchantModel
    .find({ nidHash: application.nidHash })
    .select("name businessName email phone status locked createdAt")
    .lean();

  const { nidFront, nidBack, ...rest } = application;
  apiResponse(res, 200, messages.merchantApplicationsFetched, {
    ...withMaskedNid(rest),
    nidFrontUrl: nidImageUrl(nidFront),
    nidBackUrl: nidImageUrl(nidBack),
    sameNidMerchants: sameNid,
  });
});

/**
 * Approves an application and creates the merchant account.
 *
 * A first account for an NID gets the free trial. When the NID already
 * belongs to a merchant the request is refused unless `allowDuplicateNid` is
 * true, and the second account gets no trial unless `grantTrial` is true — so
 * one person cannot collect a fresh trial with every new account.
 */
exports.approveApplicationController = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const application = await applicationModel.findById(req.params.id).select("+passwordHash +nidEncrypted");
  if (!application) return apiResponse(res, 404, messages.merchantApplicationNotFound);
  if (application.status !== "pending" || !application.passwordHash) {
    return apiResponse(res, 409, messages.merchantApplicationDecided);
  }

  const duplicates = await merchantModel.find({ nidHash: application.nidHash }).select("name email status").lean();
  if (duplicates.length && body.allowDuplicateNid !== true) {
    return apiResponse(res, 409, messages.merchantDuplicateNid, { duplicates });
  }
  if (application.email && (await userModel.exists({ email: application.email }))) return apiResponse(res, 409, messages.merchantEmailInUse);
  if (!application.email && (await userModel.exists({ phone: application.phone, role: "merchant" }))) return apiResponse(res, 409, messages.merchantPhoneInUse);

  const grantTrial = duplicates.length ? body.grantTrial === true : body.grantTrial !== false;
  const monthlyFee = parseFee(body.monthlyFee) ?? (await billingConfig()).defaultFee;
  const passwordHash = application.passwordHash;

  // Claim the application first, so two clicks cannot create two accounts.
  const claimed = await applicationModel.findOneAndUpdate(
    { _id: application._id, status: "pending" },
    {
      status: "approved",
      passwordHash: "",
      reviewedBy: req.session.user._id,
      reviewedAt: new Date(),
      duplicateNid: duplicates.length > 0,
      duplicateOf: duplicates.map((merchant) => merchant._id),
    },
    { returnDocument: "after" }
  );
  if (!claimed) return apiResponse(res, 409, messages.merchantApplicationDecided);

  let user = null;
  try {
    user = await userModel.create({
      fullname: application.fullname,
      // Left out entirely (not "") when there is none: the unique index only covers set emails.
      ...(application.email ? { email: application.email } : {}),
      password: passwordHash,
      phone: application.phone,
      role: "merchant",
      verified: true,
    });

    const trialStartsAt = grantTrial ? new Date() : null;
    const trialEndsAt = grantTrial ? new Date(trialStartsAt.getTime() + TRIAL_DAYS * DAY_MS) : null;
    const merchant = await merchantModel.create({
      user: user._id,
      application: application._id,
      name: application.fullname,
      businessName: application.businessName,
      address: application.address,
      phone: application.phone,
      email: application.email,
      facebookPage: application.facebookPage,
      productType: application.productType,
      nidHash: application.nidHash,
      nidEncrypted: application.nidEncrypted,
      nidLast4: application.nidLast4,
      status: grantTrial ? "trial" : "approved",
      trialStartsAt,
      trialEndsAt,
      monthlyFee,
      approvedBy: req.session.user._id,
    });

    claimed.merchant = merchant._id;
    await claimed.save();
    if (grantTrial) {
      await subscriptionModel.create({ merchant: merchant._id, kind: "trial", startsAt: trialStartsAt, endsAt: trialEndsAt, fee: 0, source: "approval", createdBy: req.session.user._id });
    }
    await audit({ req, action: "account.approved", merchant, subject: merchant, details: { trial: grantTrial, trialEndsAt, monthlyFee, duplicateNid: duplicates.length > 0 } });
    await notifyMerchant({
      merchant,
      type: grantTrial ? "trial_started" : "account_approved",
      params: { startsAt: trialStartsAt, endsAt: trialEndsAt, monthlyFee },
      link: grantTrial ? "/merchant" : "/merchant/billing",
    });
    apiResponse(res, 201, messages.merchantApproved, merchant);
  } catch (error) {
    // Put the application back exactly as it was so it can be approved again.
    if (user) await userModel.deleteOne({ _id: user._id });
    await applicationModel.updateOne(
      { _id: application._id },
      { status: "pending", passwordHash, reviewedBy: null, reviewedAt: null, merchant: null }
    );
    throw error;
  }
});

exports.rejectApplicationController = asyncHandler(async (req, res) => {
  const application = await applicationModel.findOneAndUpdate(
    { _id: req.params.id, status: "pending" },
    {
      status: "rejected",
      rejectionReason: reason(req.body),
      passwordHash: "",
      reviewedBy: req.session.user._id,
      reviewedAt: new Date(),
    },
    { returnDocument: "after" }
  );
  if (!application) {
    const exists = await applicationModel.exists({ _id: req.params.id });
    return apiResponse(res, exists ? 409 : 404, exists ? messages.merchantApplicationDecided : messages.merchantApplicationNotFound);
  }
  await audit({ req, action: "account.application_rejected", subject: application, details: { name: application.fullname, reason: application.rejectionReason } });
  apiResponse(res, 200, messages.merchantRejected, application);
});

// ---------------------------------------------------------------- merchants

/** Every merchant with product and order counts. `status` filters; `locked=true` lists locked accounts. */
exports.allMerchantsController = asyncHandler(async (req, res) => {
  await syncMerchantStatuses();

  const now = new Date();
  const soon = new Date(now.getTime() + EXPIRING_DAYS * DAY_MS);
  const expiringQuery = { status: { $in: ["trial", "active"] }, $or: [{ trialEndsAt: { $gt: now, $lte: soon } }, { paidUntil: { $gt: now, $lte: soon } }] };
  const openProofMerchants = await submissionModel.distinct("merchant", { status: { $in: ["pending", "approved"] } });

  const query = {};
  if (MERCHANT_STATUSES.includes(req.query.status)) query.status = req.query.status;
  if (req.query.status === "expiring") Object.assign(query, expiringQuery);
  if (req.query.status === "grace") Object.assign(query, { status: "payment_due", graceEndsAt: { $gt: now } });
  if (req.query.status === "payment_pending") Object.assign(query, { _id: { $in: openProofMerchants }, status: { $nin: ["trial", "active"] } });
  if (req.query.locked === "true") query.locked = true;

  const [merchants, productCounts, orderCounts, statusCounts, lockedCount, expiringCount, graceCount, lastPayments, latestProofs] = await Promise.all([
    merchantModel.find(query).sort({ createdAt: -1 }).lean(),
    productModel.aggregate([
      { $match: { merchant: { $ne: null } } },
      { $group: { _id: { merchant: "$merchant", status: "$approvalStatus" }, count: { $sum: 1 } } },
    ]),
    orderModel.aggregate([
      { $match: { fraudStatus: { $nin: ["blocked", "fake"] } } },
      { $unwind: "$merchants" },
      { $group: { _id: "$merchants", count: { $sum: 1 } } },
    ]),
    merchantModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    merchantModel.countDocuments({ locked: true }),
    merchantModel.countDocuments(expiringQuery),
    merchantModel.countDocuments({ status: "payment_due", graceEndsAt: { $gt: now } }),
    subscriptionModel.aggregate([
      { $match: { kind: "paid" } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$merchant", lastPaymentAt: { $first: "$createdAt" }, currentStart: { $first: "$startsAt" } } },
    ]),
    submissionModel.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: "$merchant", status: { $first: "$status" } } }]),
  ]);
  const lastPaymentBy = new Map(lastPayments.map((entry) => [String(entry._id), entry]));
  const proofStatusBy = new Map(latestProofs.map((entry) => [String(entry._id), entry.status]));
  const openProofSet = new Set(openProofMerchants.map(String));

  const productsBy = new Map();
  productCounts.forEach(({ _id, count }) => {
    const key = String(_id.merchant);
    const entry = productsBy.get(key) || { total: 0, pending: 0, approved: 0, rejected: 0 };
    entry[_id.status || "approved"] += count;
    entry.total += count;
    productsBy.set(key, entry);
  });
  const ordersBy = new Map(orderCounts.map(({ _id, count }) => [String(_id), count]));

  const counts = Object.fromEntries(MERCHANT_STATUSES.map((status) => [status, 0]));
  statusCounts.forEach(({ _id, count }) => {
    counts[_id] = count;
  });

  apiResponse(res, 200, messages.merchantsFetched, {
    merchants: merchants.map(({ payments, ...merchant }) => {
      const key = String(merchant._id);
      const ends = expiresAt(merchant);
      const paidPeriod = merchant.paidUntil && merchant.paidUntil >= (merchant.trialEndsAt || 0);
      return {
      ...withMaskedNid(merchant),
      accountStatus: accountStatus(merchant, openProofSet.has(key), now),
      // Start of the period running now (or that ran last): the paid period, else the trial.
      subscriptionStart: paidPeriod ? lastPaymentBy.get(key)?.currentStart || payments?.at(-1)?.periodStart || null : merchant.trialStartsAt,
      expiresAt: ends,
      nextDueDate: ends,
      lastPaymentAt: lastPaymentBy.get(key)?.lastPaymentAt || payments?.at(-1)?.createdAt || null,
      paymentStatus: proofStatusBy.get(key) || "none",
      products: productsBy.get(String(merchant._id)) || { total: 0, pending: 0, approved: 0, rejected: 0 },
      orders: ordersBy.get(String(merchant._id)) || 0,
      };
    }),
    counts: {
      ...counts,
      locked: lockedCount,
      expiring: expiringCount,
      grace: graceCount,
      payment_pending: (await merchantModel.countDocuments({ _id: { $in: openProofMerchants }, status: { $nin: ["trial", "active"] } })),
      pendingApplications: await applicationModel.countDocuments({ status: "pending" }),
    },
    billingJob: await billingJobStatus(),
  });
});

/** One merchant with sales figures, payments, the original application and any other account on the same NID. */
exports.singleMerchantController = asyncHandler(async (req, res) => {
  await syncMerchantStatuses({ _id: req.params.id });
  const merchant = await merchantModel
    .findById(req.params.id)
    .populate({ path: "payments.recordedBy", select: "fullname" })
    .populate({ path: "approvedBy", select: "fullname" })
    .lean();
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);

  const [summary, application, sameNid, subscriptions, proofs, history] = await Promise.all([
    buildMerchantSummary(merchant._id),
    merchant.application ? applicationModel.findById(merchant.application).lean() : null,
    merchantModel
      .find({ nidHash: merchant.nidHash, _id: { $ne: merchant._id } })
      .select("name businessName email status locked createdAt")
      .lean(),
    subscriptionModel.find({ merchant: merchant._id }).sort({ startsAt: -1 }).populate({ path: "createdBy", select: "fullname" }).lean(),
    submissionModel
      .find({ merchant: merchant._id })
      .sort({ createdAt: -1 })
      .select("method methodOther amount transactionId status rejectionReason createdAt activatedAt periodStart periodEnd")
      .lean(),
    // Including what happened to the application before the account existed.
    auditLogModel
      .find({ $or: [{ merchant: merchant._id }, ...(merchant.application ? [{ subjectId: merchant.application }] : [])] })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  apiResponse(res, 200, messages.merchantFetched, {
    ...withMaskedNid(merchant),
    accountStatus: accountStatus(merchant, proofs.some((proof) => ["pending", "approved"].includes(proof.status))),
    expiresAt: expiresAt(merchant),
    payments: [...merchant.payments].reverse(),
    subscriptions,
    paymentProofs: proofs,
    history,
    summary,
    application: application && {
      _id: application._id,
      createdAt: application.createdAt,
      duplicateNid: application.duplicateNid,
      nidFrontUrl: nidImageUrl(application.nidFront),
      nidBackUrl: nidImageUrl(application.nidBack),
    },
    sameNidMerchants: sameNid,
  });
});

/**
 * "Show full NID": the decrypted number of an application or merchant. Every
 * reveal is written to the audit log with who asked and when.
 */
const revealNid = (model, kind) =>
  asyncHandler(async (req, res) => {
    const record = await model.findById(req.params.id).select("+nidEncrypted name fullname nidLast4");
    if (!record) return apiResponse(res, 404, kind === "merchant" ? messages.merchantNotFound : messages.merchantApplicationNotFound);
    const nidNumber = decryptNid(record.nidEncrypted);
    await audit({
      req,
      action: "nid.viewed",
      merchant: kind === "merchant" ? record : null,
      subject: record,
      details: { of: kind, name: record.name || record.fullname, last4: record.nidLast4 },
    });
    apiResponse(res, 200, messages.nidRevealed, { nidNumber });
  });

exports.revealApplicationNidController = revealNid(applicationModel, "application");
exports.revealMerchantNidController = revealNid(merchantModel, "merchant");

/** Changes the monthly fee, or extends the free trial by `extendTrialDays`. */
exports.updateMerchantController = asyncHandler(async (req, res) => {
  const merchant = await merchantModel.findById(req.params.id);
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);

  const changes = {};
  const fee = parseFee(req.body?.monthlyFee);
  if (fee !== undefined && fee !== merchant.monthlyFee) {
    changes.monthlyFee = { from: merchant.monthlyFee, to: fee };
    merchant.monthlyFee = fee;
  }

  const extendDays = Math.trunc(Number(req.body?.extendTrialDays) || 0);
  if (extendDays > 0 && extendDays <= 365) {
    const from = merchant.trialEndsAt && merchant.trialEndsAt > new Date() ? merchant.trialEndsAt : new Date();
    merchant.trialEndsAt = new Date(from.getTime() + extendDays * DAY_MS);
    changes.trialExtendedDays = extendDays;
    changes.trialEndsAt = merchant.trialEndsAt;
    if (!merchant.trialStartsAt) merchant.trialStartsAt = from;
    await subscriptionModel.create({
      merchant: merchant._id,
      kind: "trial",
      startsAt: from,
      endsAt: merchant.trialEndsAt,
      source: "trial_extension",
      createdBy: req.session.user._id,
      note: `+${extendDays} days`,
    });
    if (merchant.status !== "suspended") settleStatus(merchant, (await billingConfig()).graceDays);
  }

  await merchant.save();
  if (Object.keys(changes).length) await audit({ req, action: "subscription.updated", merchant, subject: merchant, details: changes });
  apiResponse(res, 200, messages.merchantUpdated, merchant);
});

/**
 * Records a subscription payment. The paid period starts where the current
 * one (or the trial) ends, so paying early never loses days. A suspended
 * account stays suspended until an administrator activates it.
 */
exports.recordPaymentController = asyncHandler(async (req, res) => {
  const merchant = await merchantModel.findById(req.params.id);
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);

  const amount = Number(req.body?.amount);
  const months = Math.trunc(Number(req.body?.months ?? 1));
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(months) || months < 1 || months > 24) {
    return apiResponse(res, 400, messages.merchantPaymentInvalid);
  }

  const now = new Date();
  const periodStart = new Date(Math.max(now, merchant.paidUntil || 0, merchant.trialEndsAt || 0));
  const periodEnd = addMonths(periodStart, months);

  merchant.payments.push({
    amount,
    months,
    method: String(req.body?.method || "").trim().slice(0, 50),
    reference: String(req.body?.reference || "").trim().slice(0, 100),
    note: String(req.body?.note || "").trim().slice(0, 500),
    periodStart,
    periodEnd,
    recordedBy: req.session.user._id,
  });
  merchant.paidUntil = periodEnd;
  if (merchant.status !== "suspended") settleStatus(merchant, (await billingConfig()).graceDays, now);

  await merchant.save();
  await subscriptionModel.create({
    merchant: merchant._id,
    kind: "paid",
    startsAt: periodStart,
    endsAt: periodEnd,
    fee: merchant.monthlyFee,
    amountPaid: amount,
    source: "manual_payment",
    createdBy: req.session.user._id,
    note: merchant.payments.at(-1).reference,
  });
  await audit({
    req,
    action: "payment.recorded",
    merchant,
    subject: merchant,
    details: { amount, months, method: merchant.payments.at(-1).method, reference: merchant.payments.at(-1).reference, periodStart, periodEnd },
  });
  apiResponse(res, 201, messages.merchantPaymentRecorded, merchant);
});

/**
 * Suspends a merchant, usually for non-payment. Their products leave the
 * storefront and their dashboard stops working, but nothing is deleted.
 */
exports.suspendMerchantController = asyncHandler(async (req, res) => {
  const merchant = await merchantModel.findByIdAndUpdate(
    req.params.id,
    { status: "suspended", suspendedReason: reason(req.body), suspendedAt: new Date(), suspendedAuto: false },
    { returnDocument: "after" }
  );
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);
  await audit({ req, action: "account.suspended", merchant, subject: merchant, details: { automatic: false, reason: merchant.suspendedReason } });
  apiResponse(res, 200, messages.merchantUpdated, merchant);
});

/**
 * Lifts a suspension. The status then follows the dates: trial, active, or
 * payment due if nothing is paid — in which case a fresh grace period starts,
 * so the account is not suspended again straight away.
 */
exports.activateMerchantController = asyncHandler(async (req, res) => {
  const merchant = await merchantModel.findById(req.params.id);
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);

  const previousStatus = merchant.status;
  merchant.suspendedReason = "";
  merchant.suspendedAt = null;
  merchant.suspendedAuto = false;
  merchant.graceEndsAt = null;
  settleStatus(merchant, (await billingConfig()).graceDays);
  await merchant.save();
  await audit({
    req,
    action: "account.activated",
    merchant,
    subject: merchant,
    details: { from: previousStatus, to: merchant.status, manual: true, graceEndsAt: merchant.graceEndsAt },
  });
  apiResponse(res, 200, messages.merchantUpdated, merchant);
});

/** A locked merchant cannot sign in at all, and their products leave the storefront. */
exports.lockMerchantController = asyncHandler(async (req, res) => {
  const merchant = await merchantModel.findByIdAndUpdate(
    req.params.id,
    { locked: true, lockedReason: reason(req.body), lockedAt: new Date() },
    { returnDocument: "after" }
  );
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);
  await audit({ req, action: "account.locked", merchant, subject: merchant, details: { reason: merchant.lockedReason } });
  apiResponse(res, 200, messages.merchantUpdated, merchant);
});

exports.unlockMerchantController = asyncHandler(async (req, res) => {
  const merchant = await merchantModel.findByIdAndUpdate(
    req.params.id,
    { locked: false, lockedReason: "", lockedAt: null },
    { returnDocument: "after" }
  );
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);
  await audit({ req, action: "account.unlocked", merchant, subject: merchant });
  apiResponse(res, 200, messages.merchantUpdated, merchant);
});

// ---------------------------------------------------------------- product approval

/** Merchant products for review. `status` defaults to pending; `merchant` narrows to one seller. */
exports.merchantProductsController = asyncHandler(async (req, res) => {
  const status = req.query.status || "pending";
  const query = { merchant: { $ne: null } };
  if (["pending", "approved", "rejected"].includes(status)) query.approvalStatus = status;
  if (req.query.merchant) query.merchant = String(req.query.merchant);

  const [products, pending] = await Promise.all([
    productModel
      .find(query)
      .sort({ updatedAt: -1 })
      .select("-review -imageIds")
      .populate([
        { path: "merchant", select: "name phone status locked" },
        { path: "category", select: "name" },
        { path: "variant", select: "size color sku" },
        { path: "reviewedBy", select: "fullname" },
      ])
      .lean(),
    productModel.countDocuments({ merchant: { $ne: null }, approvalStatus: "pending" }),
  ]);
  apiResponse(res, 200, messages.productsFetched, { products, pending });
});

const reviewProduct = (approvalStatus, message) =>
  asyncHandler(async (req, res) => {
    const product = await productModel
      .findOneAndUpdate(
        { _id: req.params.id, merchant: { $ne: null } },
        {
          approvalStatus,
          rejectionReason: approvalStatus === "rejected" ? reason(req.body) : "",
          reviewedBy: req.session.user._id,
          reviewedAt: new Date(),
        },
        { returnDocument: "after" }
      )
      .populate([
        { path: "merchant", select: "name phone status locked" },
        { path: "category", select: "name" },
        { path: "reviewedBy", select: "fullname" },
      ]);
    if (!product) return apiResponse(res, 404, messages.productNotFound);
    apiResponse(res, 200, message, product);
  });

exports.approveProductController = reviewProduct("approved", messages.productApproved);
exports.rejectProductController = reviewProduct("rejected", messages.productRejected);
