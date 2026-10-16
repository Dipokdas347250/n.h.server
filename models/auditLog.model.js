const mongoose = require("mongoose");
const { makeAppendOnly } = require("../utils/retention");

const { Schema } = mongoose;

/**
 * Who did what to a merchant's subscription, payments or account, and when.
 * Append-only: entries can be written but never changed or deleted.
 *
 * Actions in use:
 *   payment.submitted   payment.approved   payment.rejected   payment.recorded
 *   account.approved    account.application_rejected
 *   account.activated   account.suspended  account.locked     account.unlocked
 *   subscription.expired   subscription.updated
 *   ticket.created      ticket.status_changed
 *   nid.viewed          (an administrator revealed a full NID number)
 */
const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, index: true },
    actorType: { type: String, enum: ["admin", "merchant", "system"], required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, trim: true, default: "" },

    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", default: null, index: true },
    merchantName: { type: String, trim: true, default: "" },
    subjectType: { type: String, trim: true, default: "" },
    subjectId: { type: Schema.Types.ObjectId, default: null },

    details: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
makeAppendOnly(auditLogSchema, "AuditLog");

module.exports = mongoose.model("AuditLog", auditLogSchema);
