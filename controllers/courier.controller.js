const orderModel = require("../models/checkout.model");
const Setting = require("../models/setting.model");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const messages = require("../utils/messages");
const steadfast = require("../utils/steadfast");

const MAX_BULK = 100;

/** Why an order cannot go to the courier yet, or null when it can. */
const blockedReason = (order) => {
  if (order.courier?.consignmentId) return messages.steadfastAlreadySent;
  if (["cenceled", "deliverd"].includes(order.deliveryStatus)) return messages.steadfastNotReady;
  if (["review", "blocked", "fake"].includes(order.fraudStatus)) return messages.steadfastNeedsReview;
  return null;
};

const courierFailure = (error) => ({
  en: `Steadfast: ${error.message}`,
  bn: `স্টেডফাস্ট: ${error.message}`,
});

/**
 * Books one order with Steadfast and records the consignment on it.
 *
 * The order is claimed atomically first (`courier.status: "sending"`), so a
 * double click or two staff members cannot book the same parcel twice.
 * Throws a SteadfastError on failure after writing the reason onto the order.
 */
const sendOrder = async (orderId, settings, userId) => {
  const claimed = await orderModel.findOneAndUpdate(
    { _id: orderId, "courier.consignmentId": { $in: ["", null] }, "courier.status": { $ne: "sending" } },
    { $set: { "courier.provider": "steadfast", "courier.status": "sending", "courier.error": "" } },
    { new: true }
  );
  if (!claimed) throw new steadfast.SteadfastError("This order is already booked or being sent", { status: 409 });

  try {
    const booking = await steadfast.createParcel(settings, claimed);
    claimed.courier = {
      provider: "steadfast",
      consignmentId: booking.consignmentId,
      trackingCode: booking.trackingCode,
      status: booking.status,
      sentAt: new Date(),
      sentBy: userId || null,
      checkedAt: new Date(),
      error: "",
    };
    // Handing the parcel to the courier means the order is confirmed.
    if (claimed.deliveryStatus === "pending") claimed.deliveryStatus = "confirm";
    await claimed.save();
    return claimed;
  } catch (error) {
    await orderModel.updateOne(
      { _id: orderId },
      { $set: { "courier.status": "", "courier.provider": "", "courier.error": String(error.message).slice(0, 500) } }
    );
    throw error;
  }
};

/**
 * Sends an order to Steadfast if automatic sending is on and it qualifies.
 * Never throws: a failure is recorded on the order for staff to retry.
 */
exports.autoSendIfEnabled = async (order, userId) => {
  if (!order || order.deliveryStatus !== "confirm" || blockedReason(order)) return order;
  const settings = await Setting.getSettings();
  if (!settings.steadfast?.autoSend || !steadfast.isConfigured(settings)) return order;
  try {
    return await sendOrder(order._id, settings, userId);
  } catch {
    return orderModel.findById(order._id).populate("user", "fullname email");
  }
};

exports.sendToSteadfastController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  if (!steadfast.isConfigured(settings)) return apiResponse(res, 400, messages.steadfastNotConfigured);

  const order = await orderModel.findById(req.params.id);
  if (!order) return apiResponse(res, 404, messages.orderNotFound);
  const reason = blockedReason(order);
  if (reason) return apiResponse(res, 409, reason);

  try {
    const sent = await sendOrder(order._id, settings, req.session.user._id);
    apiResponse(res, 200, messages.steadfastSent, sent);
  } catch (error) {
    apiResponse(res, error.status === 409 ? 409 : 502, courierFailure(error));
  }
});

/** Sends several orders one after another and reports each result. */
exports.bulkSendToSteadfastController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  if (!steadfast.isConfigured(settings)) return apiResponse(res, 400, messages.steadfastNotConfigured);

  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String))].slice(0, MAX_BULK);
  const orders = await orderModel.find({ _id: { $in: ids } });

  const results = [];
  for (const order of orders) {
    const reason = blockedReason(order);
    if (reason) {
      results.push({ id: order._id, orderNumber: order.orderNumber, ok: false, message: reason.en, messageBn: reason.bn });
      continue;
    }
    try {
      const sent = await sendOrder(order._id, settings, req.session.user._id);
      results.push({ id: order._id, orderNumber: order.orderNumber, ok: true, courier: sent.courier });
    } catch (error) {
      const failure = courierFailure(error);
      results.push({ id: order._id, orderNumber: order.orderNumber, ok: false, message: failure.en, messageBn: failure.bn });
    }
  }

  const sent = results.filter((item) => item.ok).length;
  apiResponse(res, 200, messages.steadfastBulkDone(sent, results.length - sent), { sent, failed: results.length - sent, results });
});

/** Asks Steadfast where the parcel is now and stores the answer. */
exports.steadfastStatusController = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.id).populate("user", "fullname email");
  if (!order) return apiResponse(res, 404, messages.orderNotFound);
  if (!order.courier?.consignmentId) return apiResponse(res, 400, messages.steadfastNotSent);

  const settings = await Setting.getSettings();
  try {
    const status = await steadfast.parcelStatus(settings, order.courier.consignmentId);
    order.courier.status = status;
    order.courier.checkedAt = new Date();
    // Keep our own delivery status in step with what the courier reports.
    if (["delivered", "partial_delivered"].includes(status)) order.deliveryStatus = "deliverd";
    if (status === "cancelled") order.deliveryStatus = "cenceled";
    await order.save();
    apiResponse(res, 200, messages.steadfastStatusFetched, order);
  } catch (error) {
    apiResponse(res, 502, courierFailure(error));
  }
});

/** Current Steadfast balance. Doubles as the "test connection" button. */
exports.steadfastBalanceController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  if (!steadfast.isConfigured(settings)) return apiResponse(res, 400, messages.steadfastNotConfigured);
  try {
    apiResponse(res, 200, messages.steadfastConnected, { balance: await steadfast.balance(settings) });
  } catch (error) {
    apiResponse(res, 502, courierFailure(error));
  }
});
