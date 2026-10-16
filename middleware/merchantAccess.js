const userModel = require("../models/user.model");
const merchantModel = require("../models/merchant.model");
const { apiResponse } = require("../utils/apiResponse");
const { syncMerchantStatuses } = require("../utils/merchant");
const messages = require("../utils/messages");

/**
 * Restricts a route to a signed-in merchant and attaches their own `Merchant`
 * record as `req.merchant`. Always runs after `validAuthorize`.
 *
 * The merchant is looked up from the session's user id, never from anything
 * the request sends, and every merchant controller filters by
 * `req.merchant._id` — so one merchant can never name another's data. Role and
 * lock are read from the database on every request, so a lock takes effect
 * immediately rather than when the session cookie expires.
 */
exports.requireMerchant = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.session.user._id).select("role verified").lean();
    if (!user || !user.verified || user.role !== "merchant") return apiResponse(res, 403, messages.merchantRequired);

    await syncMerchantStatuses({ user: user._id });
    const merchant = await merchantModel.findOne({ user: user._id });
    if (!merchant) return apiResponse(res, 403, messages.merchantRequired);
    if (merchant.locked) return apiResponse(res, 403, messages.merchantLocked);

    req.merchant = merchant;
    return next();
  } catch (error) {
    return next(error);
  }
};

const BLOCKED_MESSAGE = {
  suspended: messages.merchantSuspended,
  payment_due: messages.merchantPaymentDue,
  approved: messages.merchantAwaitingPayment,
};

/** Lets the request through only while the merchant's status is one of `statuses`. Runs after `requireMerchant`. */
exports.requireMerchantStatus = (...statuses) => (req, res, next) => {
  if (statuses.includes(req.merchant.status)) return next();
  return apiResponse(res, 403, BLOCKED_MESSAGE[req.merchant.status] || messages.merchantSuspended);
};
