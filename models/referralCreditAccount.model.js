const mongoose = require("mongoose");
const { preventDeletion } = require("../utils/retention");

const { Schema } = mongoose;

/**
 * A merchant's referral credit balance. Credit can only pay future
 * subscription fees; it is never paid out in cash.
 *
 * - available  can be applied to the next invoice
 * - reserved   applied to a payment waiting for verification; returned to
 *              `available` if that payment is rejected, moved to `used` when
 *              it is activated
 * - earned     lifetime credit from eligible referrals
 * - used       lifetime credit spent on subscriptions
 * - adjusted   net of administrator corrections (may be negative)
 *
 * Unused credit is `available + reserved` = `earned + adjusted - used`.
 *
 * Changed only by conditional `$inc` updates (see utils/referral.js), so two
 * requests at once can never spend the same taka twice. Every change is also
 * written to the append-only `ReferralCreditTransaction` ledger.
 */
const referralCreditAccountSchema = new Schema(
  {
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", required: true, unique: true },
    available: { type: Number, min: 0, default: 0 },
    reserved: { type: Number, min: 0, default: 0 },
    earned: { type: Number, min: 0, default: 0 },
    used: { type: Number, min: 0, default: 0 },
    adjusted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Credit outlives any lock or suspension.
preventDeletion(referralCreditAccountSchema, "ReferralCreditAccount");

module.exports = mongoose.model("ReferralCreditAccount", referralCreditAccountSchema);
