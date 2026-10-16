const mongoose = require("mongoose");
const notificationModel = require("../models/notification.model");
const submissionModel = require("../models/paymentSubmission.model");
const ticketModel = require("../models/supportTicket.model");
const auditLogModel = require("../models/auditLog.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { billingJobStatus } = require("../utils/merchant");

/*
 * The dashboard bell for payment proofs, support tickets and subscription
 * events (orders keep their own bell), and the audit log.
 *
 * A merchant's notifications are always looked up by `req.merchant._id`;
 * administrators share one set.
 */

const LATEST = 20;

const audienceOf = (req) =>
  req.merchant ? { audience: "merchant", merchant: req.merchant._id } : { audience: "admin" };

const listNotifications = async (req) => {
  const audience = audienceOf(req);
  const [latest, unread] = await Promise.all([
    notificationModel.find(audience).sort({ createdAt: -1 }).limit(LATEST).select("type params link readAt createdAt").lean(),
    notificationModel.countDocuments({ ...audience, readAt: null }),
  ]);
  return { latest, unread };
};

exports.myNotificationsController = asyncHandler(async (req, res) => {
  apiResponse(res, 200, messages.notificationsFetched, await listNotifications(req));
});

/** Admin bell, plus the counts the merchant pages show on their tabs. */
exports.adminNotificationsController = asyncHandler(async (req, res) => {
  const [list, pendingPayments, approvedPayments, unreadTickets] = await Promise.all([
    listNotifications(req),
    submissionModel.countDocuments({ status: "pending" }),
    submissionModel.countDocuments({ status: "approved" }),
    ticketModel.countDocuments({ unreadByAdmin: true }),
  ]);
  apiResponse(res, 200, messages.notificationsFetched, { ...list, counts: { pendingPayments, approvedPayments, unreadTickets } });
});

/** Marks `ids` (or, without ids, everything) as read for the caller only. */
exports.markNotificationsReadController = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id) => mongoose.isValidObjectId(id)).slice(0, 100) : null;
  const query = { ...audienceOf(req), readAt: null, ...(ids ? { _id: { $in: ids } } : {}) };
  await notificationModel.updateMany(query, { readAt: new Date() });
  apiResponse(res, 200, messages.notificationsRead, await listNotifications(req));
});

const CENTER_CATEGORIES = ["subscription", "payment", "support", "suspension", "reactivation", "application"];
const CENTER_PAGE = 30;

/** Notification Center: every notification for the caller, newest first, by `category` and `page`. */
exports.notificationCenterController = asyncHandler(async (req, res) => {
  const query = audienceOf(req);
  if (CENTER_CATEGORIES.includes(req.query.category)) query.category = req.query.category;
  if (req.query.unread === "true") query.readAt = null;
  const page = Math.max(Math.trunc(Number(req.query.page) || 1), 1);

  const [items, total, byCategory] = await Promise.all([
    notificationModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * CENTER_PAGE).limit(CENTER_PAGE).select("type params link readAt createdAt category").lean(),
    notificationModel.countDocuments(query),
    notificationModel.aggregate([{ $match: { ...audienceOf(req), readAt: null } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
  ]);
  const unreadByCategory = Object.fromEntries(byCategory.map(({ _id, count }) => [_id || "other", count]));
  apiResponse(res, 200, messages.notificationsFetched, {
    items,
    total,
    page,
    pages: Math.max(Math.ceil(total / CENTER_PAGE), 1),
    unreadByCategory,
    ...(req.merchant ? {} : { billingJob: await billingJobStatus() }),
  });
});

const AUDIT_GROUPS = ["payment", "account", "subscription", "ticket", "nid"];
const PAGE_SIZE = 50;

/** The audit log, newest first. Filters: `merchant`, `group` (payment, account, subscription, ticket), `page`. */
exports.auditLogController = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.merchant && mongoose.isValidObjectId(req.query.merchant)) query.merchant = req.query.merchant;
  if (AUDIT_GROUPS.includes(req.query.group)) query.action = new RegExp(`^${req.query.group}\\.`);

  const page = Math.max(Math.trunc(Number(req.query.page) || 1), 1);
  const [entries, total] = await Promise.all([
    auditLogModel.find(query).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    auditLogModel.countDocuments(query),
  ]);
  apiResponse(res, 200, messages.auditFetched, { entries, total, page, pages: Math.max(Math.ceil(total / PAGE_SIZE), 1) });
});
