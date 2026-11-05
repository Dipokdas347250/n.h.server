const submissionModel = require("../models/paymentSubmission.model");
const merchantModel = require("../models/merchant.model");
const subscriptionModel = require("../models/subscription.model");
const messages = require("./messages");
const { DAY_MS, billingConfig, settleStatus } = require("./merchant");
const { audit } = require("./audit");
const { notifyAdmins, notifyMerchant } = require("./notify");
const { spendCredit, undoCreditUse, recordCreditUse, qualifyReferral } = require("./referral");

/**
 * Starts the paid period an approved payment proof pays for. This is the one
 * place a payment turns into subscription time, whatever the payment channel:
 * the administrator's Activate button calls it today, and an online gateway's
 * confirmed callback can call it later (with `req: null`, recorded as the
 * system).
 *
 * A new period of `periodDays` starts at this moment — never from an earlier
 * period's dates. It lifts any suspension, spends the referral credit the
 * invoice reserved, records the period in the subscription history (at most
 * once per proof, enforced by a unique index), tells the merchant and admins,
 * and — for a referred merchant's first cash payment — credits the referrer.
 *
 * Returns `{ submission, merchant }`, or `{ status, message }` when the proof
 * cannot be activated (missing, not yet approved, or already decided).
 */
const activateSubmission = async ({ submissionId, req = null }) => {
  const actorId = req?.session?.user?._id || null;
  const now = new Date();
  const claimed = await submissionModel.findOneAndUpdate(
    { _id: submissionId, status: "approved" },
    { status: "activated", activatedBy: actorId, activatedAt: now },
    { returnDocument: "after" }
  );
  if (!claimed) {
    const existing = await submissionModel.findById(submissionId).select("status").lean();
    if (!existing) return { status: 404, message: messages.paymentProofNotFound };
    return { status: 409, message: existing.status === "pending" ? messages.paymentProofNotApproved : messages.paymentProofDecided };
  }

  let creditSpent = false;
  try {
    const merchant = await merchantModel.findById(claimed.merchant);
    if (!merchant) throw Object.assign(new Error("Merchant not found"), { statusCode: 404 });

    const creditAccount = await spendCredit(claimed);
    creditSpent = Boolean(creditAccount);

    const { periodDays, graceDays } = await billingConfig();
    const periodStart = now;
    const periodEnd = new Date(periodStart.getTime() + periodDays * DAY_MS);
    const previousStatus = merchant.status;

    merchant.payments.push({
      amount: claimed.amount,
      months: Math.max(1, Math.round(periodDays / 30)),
      method: claimed.method === "other" ? claimed.methodOther || "other" : claimed.method,
      reference: claimed.transactionId,
      note: [claimed.creditApplied > 0 ? `Referral credit ${claimed.creditApplied}` : "", claimed.message].filter(Boolean).join(" · "),
      periodStart,
      periodEnd,
      recordedBy: actorId,
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
      fee: claimed.fee || merchant.monthlyFee,
      amountPaid: claimed.amount,
      creditApplied: claimed.creditApplied || 0,
      source: "payment_proof",
      paymentSubmission: claimed._id,
      createdBy: actorId,
      note: claimed.transactionId,
    });
    await recordCreditUse({ submission: claimed, account: creditAccount, actorId });

    await audit({
      req,
      action: "account.activated",
      merchant,
      subject: claimed,
      details: {
        from: previousStatus,
        to: merchant.status,
        periodStart,
        periodEnd,
        amount: claimed.amount,
        creditApplied: claimed.creditApplied || 0,
        transactionId: claimed.transactionId,
      },
    });
    await notifyMerchant({ merchant, type: "account_activated", params: { paidUntil: periodEnd }, link: "/merchant/billing" });
    await notifyAdmins({
      type: "merchant_reactivated",
      params: { merchantName: merchant.name, paidUntil: periodEnd, from: previousStatus },
      merchant,
      link: `/merchants/payments?open=${claimed._id}`,
    });
    await qualifyReferral({ req, merchant, submission: claimed, amountPaid: claimed.amount });
    return { submission: claimed, merchant };
  } catch (error) {
    // Hand the proof (and its credit) back so the activation can be tried again.
    if (creditSpent) await undoCreditUse(claimed).catch((undoError) => console.error("Referral credit could not be restored:", undoError.message));
    await submissionModel.updateOne({ _id: claimed._id, status: "activated" }, { status: "approved", activatedBy: null, activatedAt: null });
    throw error;
  }
};

module.exports = { activateSubmission };
