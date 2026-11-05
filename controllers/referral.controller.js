const mongoose = require("mongoose");
const merchantModel = require("../models/merchant.model");
const referralModel = require("../models/referral.model");
const accountModel = require("../models/referralCreditAccount.model");
const ledgerModel = require("../models/referralCreditTransaction.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { ensureReferralCode, referralConfig, ensureAccount, accountView, money, adjustCredit } = require("../utils/referral");

/*
 * Merchant referrals and referral credit. Merchant handlers are scoped to
 * `req.merchant._id`; admin handlers are mounted behind
 * `isAuthorizeRole("admin")`. Credit is never paid out — there is no
 * withdrawal endpoint by design.
 */

const { REFERRAL_STATUSES } = referralModel;
const MAX_ADJUSTMENT = 100_000;

/** A ledger line as people see it. */
const ledgerView = (entry) => ({
  _id: entry._id,
  type: entry.type,
  amount: entry.amount,
  availableAfter: entry.availableAfter,
  reservedAfter: entry.reservedAfter,
  paymentSubmission: entry.paymentSubmission,
  note: entry.note,
  createdAt: entry.createdAt,
});

// ---------------------------------------------------------------- merchant

/** The merchant's code, credit balance and history, and the merchants they referred. */
exports.myReferralsController = asyncHandler(async (req, res) => {
  const merchant = req.merchant;
  const [code, account, ledger, referrals, config] = await Promise.all([
    ensureReferralCode(merchant),
    ensureAccount(merchant._id),
    ledgerModel.find({ merchant: merchant._id }).sort({ createdAt: -1 }).limit(100).lean(),
    referralModel
      .find({ referrer: merchant._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: "referred", select: "businessName name status" })
      .lean(),
    referralConfig(),
  ]);

  apiResponse(res, 200, messages.referralsFetched, {
    referralCode: code,
    creditPerReferral: config.creditAmount,
    credit: accountView(account),
    ledger: ledger.map(ledgerView),
    // Only the business name of the merchants they brought in: nothing else of theirs.
    referrals: referrals.map((referral) => ({
      _id: referral._id,
      businessName: referral.referred?.businessName || referral.referred?.name || "",
      status: referral.status,
      voidReason: referral.voidReason,
      creditAmount: referral.creditAmount,
      createdAt: referral.createdAt,
      creditedAt: referral.creditedAt,
    })),
  });
});

// ---------------------------------------------------------------- admin

/**
 * Every referral and every credit account, with totals for the whole store.
 * `status` filters referrals; `merchant` narrows both to one merchant (as
 * referrer or referred).
 */
exports.adminReferralsController = asyncHandler(async (req, res) => {
  const merchantId = mongoose.isValidObjectId(req.query.merchant) ? new mongoose.Types.ObjectId(String(req.query.merchant)) : null;
  const referralQuery = {};
  if (REFERRAL_STATUSES.includes(req.query.status)) referralQuery.status = req.query.status;
  if (merchantId) referralQuery.$or = [{ referrer: merchantId }, { referred: merchantId }];

  const [referrals, accounts, totals, statusCounts] = await Promise.all([
    referralModel
      .find(referralQuery)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate({ path: "referrer referred", select: "name businessName phone status locked referralCode" })
      .lean(),
    accountModel
      .find(merchantId ? { merchant: merchantId } : { $or: [{ earned: { $gt: 0 } }, { adjusted: { $ne: 0 } }, { reserved: { $gt: 0 } }] })
      .sort({ earned: -1 })
      .limit(500)
      .populate({ path: "merchant", select: "name businessName phone status locked referralCode" })
      .lean(),
    accountModel.aggregate([
      {
        $group: {
          _id: null,
          earned: { $sum: "$earned" },
          used: { $sum: "$used" },
          available: { $sum: "$available" },
          reserved: { $sum: "$reserved" },
          adjusted: { $sum: "$adjusted" },
        },
      },
    ]),
    referralModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(REFERRAL_STATUSES.map((status) => [status, 0]));
  statusCounts.forEach(({ _id, count }) => {
    counts[_id] = count;
  });
  const sum = totals[0] || {};

  apiResponse(res, 200, messages.referralsFetched, {
    referrals,
    accounts: accounts.map((account) => ({ merchant: account.merchant, ...accountView(account) })),
    totals: accountView(sum),
    counts,
    creditPerReferral: (await referralConfig()).creditAmount,
  });
});

/** One merchant's credit account, full credit history, and their referrals both ways. */
exports.adminMerchantCreditController = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return apiResponse(res, 404, messages.merchantNotFound);
  const merchant = await merchantModel.findById(req.params.id).select("name businessName phone status locked referralCode referredBy");
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);
  await ensureReferralCode(merchant);

  const [account, ledger, referrals, referredBy] = await Promise.all([
    ensureAccount(merchant._id),
    ledgerModel.find({ merchant: merchant._id }).sort({ createdAt: -1 }).limit(500).populate({ path: "createdBy", select: "fullname" }).lean(),
    referralModel.find({ referrer: merchant._id }).sort({ createdAt: -1 }).populate({ path: "referred", select: "name businessName status" }).lean(),
    referralModel.findOne({ referred: merchant._id }).populate({ path: "referrer", select: "name businessName status referralCode" }).lean(),
  ]);

  apiResponse(res, 200, messages.referralsFetched, {
    merchant,
    credit: accountView(account),
    ledger: ledger.map((entry) => ({ ...ledgerView(entry), createdBy: entry.createdBy })),
    referrals,
    referredBy,
  });
});

/**
 * Corrects a merchant's available credit by `amount` taka (negative removes),
 * with a reason. Recorded in the credit history and the audit log.
 */
exports.adjustCreditController = asyncHandler(async (req, res) => {
  const amount = money(req.body?.amount);
  const reason = String(req.body?.reason || "").trim().slice(0, 500);
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > MAX_ADJUSTMENT || reason.length < 3) {
    return apiResponse(res, 400, messages.creditAdjustmentInvalid);
  }
  if (!mongoose.isValidObjectId(req.params.id)) return apiResponse(res, 404, messages.merchantNotFound);
  const merchant = await merchantModel.findById(req.params.id).select("name email");
  if (!merchant) return apiResponse(res, 404, messages.merchantNotFound);

  const account = await adjustCredit({ req, merchant, amount, reason });
  if (!account) return apiResponse(res, 409, messages.creditNotEnoughToRemove);
  apiResponse(res, 200, messages.creditAdjusted, accountView(account));
});
