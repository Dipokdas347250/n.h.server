const ticketModel = require("../models/supportTicket.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { removeTempFiles, storePrivateFiles, destroyPrivateFiles, attachmentView } = require("../utils/secureUpload");
const { audit } = require("../utils/audit");
const { notifyAdmins, notifyMerchant } = require("../utils/notify");

/*
 * Help & Support. A merchant opens a ticket with a description, pictures and
 * a voice note; both sides then reply in the same thread.
 *
 * Merchant handlers run behind `requireMerchant` with no status check, so a
 * suspended merchant can still ask for help. Each one looks the ticket up by
 * id AND `req.merchant._id`; another merchant's ticket answers 404, exactly
 * like one that does not exist.
 */

const { TICKET_STATUSES } = ticketModel;
const MAX_OPEN_TICKETS = 10;
const MAX_MESSAGES = 200;

const text = (value, max) => String(value || "").trim().slice(0, max);

/** Ticket references such as ST-261013-4831, drawn until one is free. */
const buildTicketNumber = async () => {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `ST-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await ticketModel.exists({ ticketNumber: candidate }))) return candidate;
  }
  return `ST-${stamp}-${Date.now().toString().slice(-6)}`;
};

/** The verified files of this request, pictures first. */
const filesOf = (req) => [...(req.files?.images || []), ...(req.files?.audio || [])];

/** Builds one message from the request body and files. Returns null when it would be empty. */
const buildMessage = async (req, authorType, folder) => {
  const body = text(req.body?.message, 3000);
  const files = filesOf(req);
  if (!body && !files.length) return null;
  const attachments = await storePrivateFiles(files, folder);
  return {
    authorType,
    author: req.session.user._id,
    authorName: req.session.user.fullname || "",
    body,
    attachments,
  };
};

const messageView = (message, forMerchant) => ({
  _id: message._id,
  authorType: message.authorType,
  // Merchants see "N H Shop" rather than which administrator answered.
  authorName: forMerchant && message.authorType === "admin" ? "" : message.authorName,
  body: message.body,
  attachments: (message.attachments || []).map(attachmentView),
  replyTo: message.replyTo,
  createdAt: message.createdAt,
});

const ticketSummary = (ticket, forMerchant) => {
  const last = ticket.messages?.[ticket.messages.length - 1];
  return {
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    lastMessageAt: ticket.lastMessageAt,
    lastMessageBy: ticket.lastMessageBy,
    preview: last ? last.body.slice(0, 140) : "",
    unread: forMerchant ? ticket.unreadByMerchant : ticket.unreadByAdmin,
    ...(forMerchant ? {} : { merchant: ticket.merchant }),
  };
};

const ticketView = (ticket, forMerchant) => ({
  ...ticketSummary(ticket, forMerchant),
  resolvedAt: ticket.resolvedAt,
  messages: ticket.messages.map((message) => messageView(message, forMerchant)),
});

/** `replyTo` only if it names a message in this ticket. */
const validReplyTo = (ticket, value) => {
  const id = String(value || "");
  return id && ticket.messages.some((message) => String(message._id) === id) ? id : null;
};

const MERCHANT_FIELDS = "name phone email status locked";
/** What the administrator's ticket page shows about the merchant. */
const MERCHANT_DETAIL_FIELDS = `${MERCHANT_FIELDS} monthlyFee paidUntil trialEndsAt graceEndsAt createdAt`;

// ---------------------------------------------------------------- merchant

exports.myTicketsController = asyncHandler(async (req, res) => {
  const tickets = await ticketModel
    .find({ merchant: req.merchant._id })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .select({ messages: { $slice: -1 }, ticketNumber: 1, subject: 1, status: 1, createdAt: 1, lastMessageAt: 1, lastMessageBy: 1, unreadByMerchant: 1 })
    .lean();
  apiResponse(res, 200, messages.ticketsFetched, tickets.map((ticket) => ticketSummary(ticket, true)));
});

/** "Help & Support": a subject, a description, up to three pictures and one voice note. */
exports.createTicketController = asyncHandler(async (req, res) => {
  try {
    const merchant = req.merchant;
    const subject = text(req.body?.subject, 150);
    if (!subject || (!text(req.body?.message, 3000) && !filesOf(req).length)) return apiResponse(res, 400, messages.ticketInvalid);

    const openCount = await ticketModel.countDocuments({ merchant: merchant._id, status: { $ne: "resolved" } });
    if (openCount >= MAX_OPEN_TICKETS) return apiResponse(res, 429, messages.ticketTooManyOpen);

    const message = await buildMessage(req, "merchant", `nh-shop/merchant-private/${merchant._id}/support`);
    let ticket;
    try {
      ticket = await ticketModel.create({
        ticketNumber: await buildTicketNumber(),
        merchant: merchant._id,
        subject,
        messages: [message],
        lastMessageAt: new Date(),
        lastMessageBy: "merchant",
        unreadByAdmin: true,
      });
    } catch (error) {
      await destroyPrivateFiles(message.attachments);
      throw error;
    }

    await audit({ req, action: "ticket.created", merchant, subject: ticket, details: { ticketNumber: ticket.ticketNumber, subject } });
    await notifyAdmins({
      type: "ticket_created",
      params: { merchantName: merchant.name, ticketNumber: ticket.ticketNumber, subject },
      merchant,
      link: `/merchants/support/${ticket._id}`,
    });
    return apiResponse(res, 201, messages.ticketCreated, ticketView(ticket, true));
  } finally {
    removeTempFiles(req);
  }
});

exports.myTicketController = asyncHandler(async (req, res) => {
  const ticket = await ticketModel.findOneAndUpdate(
    { _id: req.params.id, merchant: req.merchant._id },
    { unreadByMerchant: false },
    { returnDocument: "after", timestamps: false }
  );
  if (!ticket) return apiResponse(res, 404, messages.ticketNotFound);
  apiResponse(res, 200, messages.ticketFetched, ticketView(ticket, true));
});

/** The merchant answers in their own ticket. Answering a resolved ticket opens it again. */
exports.replyMyTicketController = asyncHandler(async (req, res) => {
  try {
    const merchant = req.merchant;
    const ticket = await ticketModel.findOne({ _id: req.params.id, merchant: merchant._id });
    if (!ticket) return apiResponse(res, 404, messages.ticketNotFound);
    if (ticket.messages.length >= MAX_MESSAGES) return apiResponse(res, 400, messages.ticketTooLong);

    const replyTo = validReplyTo(ticket, req.body?.replyTo);
    const message = await buildMessage(req, "merchant", `nh-shop/merchant-private/${merchant._id}/support`);
    if (!message) return apiResponse(res, 400, messages.ticketMessageRequired);

    const reopened = ticket.status === "resolved";
    ticket.messages.push({ ...message, replyTo });
    ticket.lastMessageAt = new Date();
    ticket.lastMessageBy = "merchant";
    ticket.unreadByAdmin = true;
    if (reopened) {
      ticket.status = "open";
      ticket.resolvedAt = null;
    }
    try {
      await ticket.save();
    } catch (error) {
      await destroyPrivateFiles(message.attachments);
      throw error;
    }

    if (reopened) {
      await audit({ req, action: "ticket.status_changed", merchant, subject: ticket, details: { from: "resolved", to: "open", ticketNumber: ticket.ticketNumber } });
    }
    await notifyAdmins({
      type: "ticket_reply",
      params: { merchantName: merchant.name, ticketNumber: ticket.ticketNumber },
      merchant,
      link: `/merchants/support/${ticket._id}`,
    });
    return apiResponse(res, 201, messages.ticketReplied, ticketView(ticket, true));
  } finally {
    removeTempFiles(req);
  }
});

// ---------------------------------------------------------------- admin

/** Tickets for administrators. `status` filters (default: everything not resolved); `merchant` narrows to one. */
exports.allTicketsController = asyncHandler(async (req, res) => {
  const status = req.query.status || "unresolved";
  const query = {};
  if (TICKET_STATUSES.includes(status)) query.status = status;
  else if (status === "unresolved") query.status = { $ne: "resolved" };
  // "New": not answered by an administrator yet.
  else if (status === "new") Object.assign(query, { status: { $ne: "resolved" }, "messages.authorType": { $ne: "admin" } });
  if (req.query.merchant) query.merchant = String(req.query.merchant);

  const [tickets, statusCounts, unread, newCount] = await Promise.all([
    ticketModel
      .find(query)
      .sort({ unreadByAdmin: -1, lastMessageAt: -1 })
      .limit(200)
      .select({ messages: { $slice: -1 }, ticketNumber: 1, subject: 1, status: 1, createdAt: 1, lastMessageAt: 1, lastMessageBy: 1, unreadByAdmin: 1, merchant: 1 })
      .populate({ path: "merchant", select: MERCHANT_FIELDS })
      .lean(),
    ticketModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ticketModel.countDocuments({ unreadByAdmin: true }),
    ticketModel.countDocuments({ status: { $ne: "resolved" }, "messages.authorType": { $ne: "admin" } }),
  ]);

  const counts = Object.fromEntries(TICKET_STATUSES.map((key) => [key, 0]));
  statusCounts.forEach(({ _id, count }) => {
    counts[_id] = count;
  });
  counts.new = newCount;
  apiResponse(res, 200, messages.ticketsFetched, { tickets: tickets.map((ticket) => ticketSummary(ticket, false)), counts, unread });
});

exports.adminTicketController = asyncHandler(async (req, res) => {
  const ticket = await ticketModel
    .findByIdAndUpdate(req.params.id, { unreadByAdmin: false }, { returnDocument: "after", timestamps: false })
    .populate({ path: "merchant", select: MERCHANT_DETAIL_FIELDS });
  if (!ticket) return apiResponse(res, 404, messages.ticketNotFound);
  apiResponse(res, 200, messages.ticketFetched, ticketView(ticket, false));
});

const changeStatus = async (req, ticket, status) => {
  const from = ticket.status;
  if (from === status) return false;
  ticket.status = status;
  ticket.resolvedAt = status === "resolved" ? new Date() : null;
  await audit({ req, action: "ticket.status_changed", merchant: ticket.merchant, subject: ticket, details: { from, to: status, ticketNumber: ticket.ticketNumber } });
  return true;
};

/** An administrator's reply, optionally with pictures or audio and a new status in the same step. */
exports.adminReplyController = asyncHandler(async (req, res) => {
  try {
    const ticket = await ticketModel.findById(req.params.id).populate({ path: "merchant", select: MERCHANT_DETAIL_FIELDS });
    if (!ticket) return apiResponse(res, 404, messages.ticketNotFound);
    if (ticket.messages.length >= MAX_MESSAGES) return apiResponse(res, 400, messages.ticketTooLong);

    const status = req.body?.status;
    if (status && !TICKET_STATUSES.includes(status)) return apiResponse(res, 400, messages.ticketStatusInvalid);

    const replyTo = validReplyTo(ticket, req.body?.replyTo);
    const message = await buildMessage(req, "admin", `nh-shop/merchant-private/${ticket.merchant._id}/support`);
    if (!message) return apiResponse(res, 400, messages.ticketMessageRequired);

    ticket.messages.push({ ...message, replyTo });
    ticket.lastMessageAt = new Date();
    ticket.lastMessageBy = "admin";
    ticket.unreadByMerchant = true;
    ticket.unreadByAdmin = false;
    // Answering a new ticket moves it along unless a status was chosen.
    await changeStatus(req, ticket, status || (ticket.status === "open" ? "in_progress" : ticket.status));
    try {
      await ticket.save();
    } catch (error) {
      await destroyPrivateFiles(message.attachments);
      throw error;
    }

    await notifyMerchant({
      merchant: ticket.merchant,
      type: "ticket_reply",
      params: { ticketNumber: ticket.ticketNumber, subject: ticket.subject },
      link: `/merchant/support/${ticket._id}`,
    });
    return apiResponse(res, 201, messages.ticketReplied, ticketView(ticket, false));
  } finally {
    removeTempFiles(req);
  }
});

/** Open, In progress or Resolved. The merchant sees the change and is notified. */
exports.updateTicketStatusController = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  if (!TICKET_STATUSES.includes(status)) return apiResponse(res, 400, messages.ticketStatusInvalid);

  const ticket = await ticketModel.findById(req.params.id).populate({ path: "merchant", select: MERCHANT_DETAIL_FIELDS });
  if (!ticket) return apiResponse(res, 404, messages.ticketNotFound);

  if (await changeStatus(req, ticket, status)) {
    await ticket.save();
    await notifyMerchant({
      merchant: ticket.merchant,
      type: "ticket_status",
      params: { ticketNumber: ticket.ticketNumber, status },
      link: `/merchant/support/${ticket._id}`,
    });
  }
  apiResponse(res, 200, messages.ticketUpdated, ticketView(ticket, false));
});
