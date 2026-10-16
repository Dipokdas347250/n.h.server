const mongoose = require("mongoose");
const { preventDeletion } = require("../utils/retention");

const { Schema } = mongoose;

/**
 * One period a merchant may trade for: the free trial, or a paid period
 * started by an administrator activating a verified payment (or recording a
 * payment by hand). Together these are the merchant's subscription history.
 *
 * The merchant's `trialEndsAt` / `paidUntil` remain the fields the rest of the
 * system reads; each change to them writes a record here as well.
 */
const subscriptionSchema = new Schema(
  {
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    kind: { type: String, enum: ["trial", "paid"], required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    fee: { type: Number, min: 0, default: 0 },
    amountPaid: { type: Number, min: 0, default: 0 },
    // How the period was granted.
    source: { type: String, enum: ["approval", "payment_proof", "manual_payment", "trial_extension", "migration"], required: true },
    paymentSubmission: { type: Schema.Types.ObjectId, ref: "PaymentSubmission", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

subscriptionSchema.index({ merchant: 1, startsAt: -1 });
// A payment proof can start at most one period, enforced by the database.
subscriptionSchema.index(
  { paymentSubmission: 1 },
  { unique: true, partialFilterExpression: { paymentSubmission: { $type: "objectId" } } }
);
preventDeletion(subscriptionSchema, "Subscription");

module.exports = mongoose.model("Subscription", subscriptionSchema);
