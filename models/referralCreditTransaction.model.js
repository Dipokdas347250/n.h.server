const mongoose = require("mongoose");
const { makeAppendOnly } = require("../utils/retention");

const { Schema } = mongoose;

/**
 * Type (`amount` is always positive except for `adjusted`):
 * - earned     a referred merchant's first cash payment was activated
 * - reserved   applied to a payment proof waiting for verification
 * - released   that proof was rejected, so the credit is available again
 * - used       that proof was activated, so the credit is spent
 * - adjusted   an administrator's correction, positive or negative, with a reason
 */
const CREDIT_TRANSACTION_TYPES = ["earned", "reserved", "released", "used", "adjusted"];

/**
 * The referral credit history: one line per change to a merchant's
 * `ReferralCreditAccount`, with the balances right after it. Append-only —
 * lines can be written but never changed or deleted.
 */
const referralCreditTransactionSchema = new Schema(
  {
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", required: true },
    type: { type: String, enum: CREDIT_TRANSACTION_TYPES, required: true },
    amount: { type: Number, required: true },
    availableAfter: { type: Number, default: 0 },
    reservedAfter: { type: Number, default: 0 },
    referral: { type: Schema.Types.ObjectId, ref: "Referral", default: null },
    paymentSubmission: { type: Schema.Types.ObjectId, ref: "PaymentSubmission", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

referralCreditTransactionSchema.index({ merchant: 1, createdAt: -1 });
// The database itself refuses a second "earned" line for one referral, and a
// second reserved / released / used line for one payment proof.
referralCreditTransactionSchema.index(
  { referral: 1 },
  { unique: true, partialFilterExpression: { type: "earned", referral: { $type: "objectId" } } }
);
referralCreditTransactionSchema.index(
  { paymentSubmission: 1, type: 1 },
  { unique: true, partialFilterExpression: { paymentSubmission: { $type: "objectId" } } }
);
makeAppendOnly(referralCreditTransactionSchema, "ReferralCreditTransaction");

const ReferralCreditTransaction = mongoose.model("ReferralCreditTransaction", referralCreditTransactionSchema);
ReferralCreditTransaction.CREDIT_TRANSACTION_TYPES = CREDIT_TRANSACTION_TYPES;

module.exports = ReferralCreditTransaction;
