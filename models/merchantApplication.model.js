const mongoose = require("mongoose");
const { Schema } = mongoose;

/** A stored NID photo. Uploaded as an authenticated Cloudinary asset, so it has no public URL. */
const nidImageSchema = new Schema(
  {
    publicId: { type: String, default: "" },
    format: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Someone asking to sell on N H Shop. Nobody gets a merchant account directly:
 * the application waits here until an administrator approves or rejects it.
 */
const merchantApplicationSchema = new Schema(
  {
    fullname: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    // Optional: without one the merchant signs in with their mobile number.
    email: { type: String, trim: true, lowercase: true, default: "", index: true },
    businessName: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    facebookPage: { type: String, trim: true, default: "" },
    productType: { type: String, required: true, trim: true },

    // The NID number is never stored in plain text (see utils/nidCrypto.js):
    // a keyed hash to spot the same card on another account, the encrypted
    // number for an audited "Show full NID", and the last four digits.
    nidHash: { type: String, required: true, index: true },
    nidEncrypted: { type: String, required: true, select: false },
    nidLast4: { type: String, default: "" },
    // Plain-text number from before encryption; moved into the fields above
    // and removed by the startup migration.
    nidNumber: { type: String, select: false },
    nidFront: { type: nidImageSchema, default: () => ({}) },
    nidBack: { type: nidImageSchema, default: () => ({}) },

    // Chosen by the applicant and used for the account once approved. Cleared
    // as soon as the application is decided either way.
    passwordHash: { type: String, default: "", select: false },

    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    rejectionReason: { type: String, trim: true, default: "" },

    // Set when the NID already belongs to a merchant. Not blocked automatically:
    // an administrator may approve a second business for the same person.
    duplicateNid: { type: Boolean, default: false },
    duplicateOf: { type: [{ type: Schema.Types.ObjectId, ref: "Merchant" }], default: [] },

    // What reading the NID number off the front photo found: "matched", or
    // "unreadable" / "unchecked" for the administrator to check by eye. A
    // clear mismatch never gets this far — the application is refused.
    // Only the outcome is kept: the numbers read off the photo are NIDs too.
    nidCheck: {
      status: { type: String, enum: ["matched", "unreadable", "unchecked", ""], default: "" },
    },

    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", default: null },

    ipAddress: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MerchantApplication", merchantApplicationSchema);
