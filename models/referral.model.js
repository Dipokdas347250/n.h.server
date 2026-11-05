const mongoose = require("mongoose");
const { preventDeletion } = require("../utils/retention");

const { Schema } = mongoose;

/**
 * Status:
 * - pending    the new merchant registered with a referral code and has not
 *              yet had a cash subscription payment verified
 * - credited   their first cash payment was verified and activated; the
 *              referrer received `creditAmount` (once — never again)
 * - void       never eligible, e.g. the "new" merchant is the referrer
 *              themselves or someone who already had an account (`voidReason`)
 */
const REFERRAL_STATUSES = ["pending", "credited", "void"];

/**
 * One merchant brought in by another. Created when an administrator approves
 * an application that carried a referral code. `referred` is unique, so a new
 * merchant can belong to one referral only and can earn its referrer credit
 * at most once.
 */
const referralSchema = new Schema(
  {
    referrer: { type: Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    referred: { type: Schema.Types.ObjectId, ref: "Merchant", required: true },
    application: { type: Schema.Types.ObjectId, ref: "MerchantApplication", default: null },
    referralCode: { type: String, trim: true, default: "" },

    status: { type: String, enum: REFERRAL_STATUSES, default: "pending", index: true },
    voidReason: { type: String, trim: true, default: "" },
    creditAmount: { type: Number, min: 0, default: 0 },
    // The verified payment that made the referral eligible.
    qualifyingSubmission: { type: Schema.Types.ObjectId, ref: "PaymentSubmission", default: null },
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

referralSchema.index({ referred: 1 }, { unique: true });
preventDeletion(referralSchema, "Referral");

const Referral = mongoose.model("Referral", referralSchema);
Referral.REFERRAL_STATUSES = REFERRAL_STATUSES;

module.exports = Referral;
