const mongoose = require("mongoose");
const attachmentSchema = require("./attachment.schema");
const { preventDeletion } = require("../utils/retention");

const { Schema } = mongoose;

// "bank" and "other" remain for proofs submitted before payments were limited
// to bKash and Nagad. "credit" is a proof paid entirely with referral credit.
const PAYMENT_METHODS = ["bkash", "nagad", "bank", "other", "credit"];
/** Methods a merchant can choose for a new cash payment. */
const CASH_METHODS = ["bkash", "nagad"];
/**
 * How the payment reached N H Shop. Everything is "manual" for now: the
 * merchant sends money and an administrator verifies it. An online gateway
 * would create its proofs as "gateway", already approved from the gateway's
 * callback, and activate them through the same `activateSubmission`
 * (utils/billing.js) so periods, credit and referrals behave identically.
 */
const PAYMENT_CHANNELS = ["manual", "gateway"];

/**
 * Status:
 * - pending    submitted by the merchant, waiting for an administrator
 * - approved   the administrator checked the transaction and screenshot
 * - activated  the administrator pressed Activate: a new period started
 * - rejected   not accepted; `rejectionReason` tells the merchant why
 *
 * A submission never activates anything by itself — only an administrator's
 * Activate does, after approving.
 */
const SUBMISSION_STATUSES = ["pending", "approved", "activated", "rejected"];

function isCashPayment() {
  return this.method !== "credit";
}

/** A merchant's proof that they paid their subscription, waiting for verification. */
const paymentSubmissionSchema = new Schema(
  {
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    channel: { type: String, enum: PAYMENT_CHANNELS, default: "manual" },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    methodOther: { type: String, trim: true, default: "" },
    // Cash the merchant sent; 0 when referral credit paid the whole fee.
    amount: { type: Number, required: true, min: 0 },
    // The wallet number shown to the merchant when they submitted.
    payTo: { type: String, trim: true, default: "" },
    // When the merchant says they sent the money.
    paidAt: { type: Date, default: null },
    // Upper-cased and stripped of spaces, so the same ID typed twice still matches.
    transactionId: { type: String, required: isCashPayment, trim: true, default: "", index: true },
    // Same as `transactionId` while the proof is live, and removed when it is
    // rejected. A unique index on it means the database itself refuses a
    // second live proof with the same ID, even from two requests at once.
    transactionKey: { type: String },
    // The invoice when they submitted: the monthly fee, the referral credit
    // reserved against it, and what was left to pay in cash (`expectedAmount`,
    // compared with `amount`).
    fee: { type: Number, min: 0, default: 0 },
    creditApplied: { type: Number, min: 0, default: 0 },
    expectedAmount: { type: Number, default: 0 },
    screenshot: { type: attachmentSchema, required: isCashPayment },
    message: { type: String, trim: true, default: "" },

    status: { type: String, enum: SUBMISSION_STATUSES, default: "pending", index: true },
    // First opened by an administrator; unopened pending proofs are "new".
    viewedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },

    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    activatedAt: { type: Date, default: null },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSubmissionSchema.index({ status: 1, createdAt: -1 });
paymentSubmissionSchema.index(
  { transactionKey: 1 },
  { unique: true, partialFilterExpression: { transactionKey: { $type: "string" } } }
);
preventDeletion(paymentSubmissionSchema, "PaymentSubmission");

const PaymentSubmission = mongoose.model("PaymentSubmission", paymentSubmissionSchema);
PaymentSubmission.PAYMENT_METHODS = PAYMENT_METHODS;
PaymentSubmission.CASH_METHODS = CASH_METHODS;
PaymentSubmission.PAYMENT_CHANNELS = PAYMENT_CHANNELS;
PaymentSubmission.SUBMISSION_STATUSES = SUBMISSION_STATUSES;

module.exports = PaymentSubmission;
