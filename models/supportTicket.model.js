const mongoose = require("mongoose");
const attachmentSchema = require("./attachment.schema");
const { preventDeletion } = require("../utils/retention");

const { Schema } = mongoose;

const TICKET_STATUSES = ["open", "in_progress", "resolved"];

/** One message in a ticket, from the merchant or from an administrator. */
const ticketMessageSchema = new Schema(
  {
    authorType: { type: String, enum: ["merchant", "admin"], required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, trim: true, default: "" },
    body: { type: String, trim: true, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    // The earlier message in this ticket being answered, if any.
    replyTo: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** A merchant's Help & Support request and the conversation about it. */
const supportTicketSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    merchant: { type: Schema.Types.ObjectId, ref: "Merchant", required: true, index: true },
    subject: { type: String, required: true, trim: true },
    status: { type: String, enum: TICKET_STATUSES, default: "open", index: true },
    messages: { type: [ticketMessageSchema], default: [] },

    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessageBy: { type: String, enum: ["merchant", "admin"], default: "merchant" },
    unreadByAdmin: { type: Boolean, default: true },
    unreadByMerchant: { type: Boolean, default: false },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

preventDeletion(supportTicketSchema, "SupportTicket");

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);
SupportTicket.TICKET_STATUSES = TICKET_STATUSES;

module.exports = SupportTicket;
