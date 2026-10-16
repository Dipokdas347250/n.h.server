const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * A dashboard notification. `audience: "admin"` is shared by every
 * administrator; `audience: "merchant"` belongs to `merchant` alone.
 *
 * Only the type and its values are stored; the dashboard words them in the
 * reader's language. `link` is the dashboard page to open.
 */
const notificationSchema = new Schema(
  {
    audience: { type: String, enum: ["admin", "merchant"], required: true },
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", default: null },
    type: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    link: { type: String, default: "" },
    // Groups for the Notification Center: subscription, payment, support, account, application.
    category: { type: String, default: "", index: true },
    // Set for scheduled reminders so a rerun of the job can never send the same
    // one twice: the unique index refuses the second insert.
    dedupeKey: { type: String },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ audience: 1, merchant: 1, createdAt: -1 });
notificationSchema.index({ audience: 1, merchant: 1, readAt: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } });

module.exports = mongoose.model("Notification", notificationSchema);
