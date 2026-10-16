const mongoose = require("mongoose");
const { preventDeletion } = require("../utils/retention");

const { Schema } = mongoose;

/** One subscription payment recorded by an administrator. */
const paymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    months: { type: Number, required: true, min: 1 },
    method: { type: String, trim: true, default: "" },
    reference: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Set when the payment came from a merchant's verified payment proof.
    submission: { type: Schema.Types.ObjectId, ref: "PaymentSubmission", default: null },
  },
  { timestamps: true }
);

/**
 * An approved seller. Created only by an administrator approving a
 * `MerchantApplication`; the linked `User` has the "merchant" role.
 *
 * Status:
 * - approved     approved without a free trial, waiting for the first payment
 * - trial        inside the free trial
 * - active       paid up
 * - payment_due  trial or paid period ran out; `graceEndsAt` is the deadline
 * - suspended    switched off by an administrator, or automatically
 *                (`suspendedAuto`) once the grace period passed unpaid
 *
 * `locked` is separate from the status: a locked account cannot sign in at all.
 */
const merchantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    application: { type: Schema.Types.ObjectId, ref: "MerchantApplication", default: null },

    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    businessName: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    facebookPage: { type: String, trim: true, default: "" },
    productType: { type: String, trim: true, default: "" },
    // The NID number is never stored in plain text (see utils/nidCrypto.js):
    // a keyed hash to spot the same card on another account, the encrypted
    // number for an audited "Show full NID", and the last four digits.
    nidHash: { type: String, required: true, index: true },
    nidEncrypted: { type: String, required: true, select: false },
    nidLast4: { type: String, default: "" },
    // Plain-text number from before encryption; moved into the fields above
    // and removed by the startup migration.
    nidNumber: { type: String, select: false },

    status: {
      type: String,
      enum: ["approved", "trial", "active", "payment_due", "suspended"],
      default: "trial",
      index: true,
    },
    trialStartsAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    paidUntil: { type: Date, default: null },
    monthlyFee: { type: Number, min: 0, default: 0 },
    payments: { type: [paymentSchema], default: [] },
    // While payment is due: when the account is suspended if still unpaid.
    graceEndsAt: { type: Date, default: null },

    suspendedReason: { type: String, trim: true, default: "" },
    suspendedAt: { type: Date, default: null },
    suspendedAuto: { type: Boolean, default: false },

    locked: { type: Boolean, default: false, index: true },
    lockedReason: { type: String, trim: true, default: "" },
    lockedAt: { type: Date, default: null },

    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// A suspended merchant's account, payments and history are kept, never deleted.
preventDeletion(merchantSchema, "Merchant");

module.exports = mongoose.model("Merchant", merchantSchema);
