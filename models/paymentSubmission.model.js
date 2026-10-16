const mongoose = require("mongoose");
const attachmentSchema = require("./attachment.schema");
const { preventDeletion } = require("../utils/retention");

const { Schema } = mongoose;

const PAYMENT_METHODS = ["bkash", "nagad", "bank", "other"];

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

/** A merchant's proof that they paid their subscription, waiting for verification. */
const paymentSubmissionSchema = new Schema(
  {
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    method: { type: String, enum: PAYMENT_METHODS, required: true },
    methodOther: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 1 },
    // Upper-cased and stripped of spaces, so the same ID typed twice still matches.
    transactionId: { type: String, required: true, trim: true, index: true },
    // Same as `transactionId` while the proof is live, and removed when it is
    // rejected. A unique index on it means the database itself refuses a
    // second live proof with the same ID, even from two requests at once.
    transactionKey: { type: String },
    // The merchant's monthly fee when they submitted, to compare with `amount`.
    expectedAmount: { type: Number, default: 0 },
    screenshot: { type: attachmentSchema, required: true },
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
PaymentSubmission.SUBMISSION_STATUSES = SUBMISSION_STATUSES;

module.exports = PaymentSubmission;
