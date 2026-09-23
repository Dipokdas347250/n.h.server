const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const messages = require("../utils/messages");
const orderModel = require("../models/checkout.model");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const categoryModel = require("../models/categore.model");
const visitModel = require("../models/visit.model");

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabelsBn = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"];

/** Orders that were never confirmed do not count as sales. */
const SOLD_MATCH = { deliveryStatus: { $ne: "cenceled" }, fraudStatus: { $nin: ["blocked", "fake"] } };

exports.getTopSellingProducts = async (limit = 8) => orderModel.aggregate([
  { $match: SOLD_MATCH },
  { $unwind: "$items" },
  { $group: { _id: "$items.product", sold: { $sum: { $ifNull: ["$items.quntity", 1] } } } },
  { $sort: { sold: -1 } },
  { $limit: limit },
  { $lookup: { from: productModel.collection.name, localField: "_id", foreignField: "_id", as: "product" } },
  { $unwind: "$product" },
  { $lookup: { from: categoryModel.collection.name, localField: "product.category", foreignField: "_id", as: "category" } },
  { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
  { $replaceRoot: { newRoot: { $mergeObjects: ["$product", { sold: "$sold", category: "$category" }] } } },
]);

exports.dashboardController = asyncHandler(async (req, res) => {
  const sixMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 5));

  const [orders, users, products, categories, revenueTrend, orderOverview, recentOrders, uniqueVisitors, topSelling, fraudOverview, revenueTotals] =
    await Promise.all([
      orderModel.countDocuments(),
      userModel.countDocuments(),
      productModel.countDocuments(),
      categoryModel.countDocuments(),
      orderModel.aggregate([
        { $match: { ...SOLD_MATCH, createdAt: { $gte: sixMonthsAgo } } },
        { $group: { _id: { $month: "$createdAt" }, revenue: { $sum: "$totalprice" }, delivery: { $sum: "$deliveryCharge" }, orders: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      orderModel.aggregate([{ $group: { _id: "$deliveryStatus", count: { $sum: 1 } } }]),
      orderModel.find({}).sort({ createdAt: -1 }).limit(8)
        .populate("user", "fullname email")
        .select("orderNumber user customer totalprice deliveryCharge paymentStatus deliveryStatus fraudStatus riskLevel riskScore createdAt transaction_id isGuest"),
      visitModel.distinct("visitorKey"),
      exports.getTopSellingProducts(8),
      orderModel.aggregate([{ $group: { _id: "$fraudStatus", count: { $sum: 1 } } }]),
      orderModel.aggregate([
        { $match: SOLD_MATCH },
        { $group: { _id: null, revenue: { $sum: "$totalprice" }, delivery: { $sum: "$deliveryCharge" }, goods: { $sum: "$subtotal" } } },
      ]),
    ]);

  const currentRevenue = revenueTotals[0]?.revenue || 0;
  const previousPeriod = await orderModel.aggregate([
    { $match: { ...SOLD_MATCH, createdAt: { $lt: sixMonthsAgo } } },
    { $group: { _id: null, total: { $sum: "$totalprice" } } },
  ]);
  const previousRevenue = previousPeriod[0]?.total || 0;
  const growth = previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  const fraudCounts = Object.fromEntries(fraudOverview.map((item) => [item._id || "clean", item.count]));

  apiResponse(res, 200, messages.dashboardFetched, {
    metrics: {
      revenue: currentRevenue,
      deliveryRevenue: revenueTotals[0]?.delivery || 0,
      goodsRevenue: revenueTotals[0]?.goods || 0,
      orders,
      users,
      products,
      categories,
      growth: Number(growth.toFixed(1)),
      uniqueVisitors: uniqueVisitors.length,
      ordersUnderReview: fraudCounts.review || 0,
      ordersBlocked: fraudCounts.blocked || 0,
      ordersMarkedFake: fraudCounts.fake || 0,
    },
    revenueTrend: revenueTrend.map((item) => ({
      name: monthLabels[item._id - 1],
      nameBn: monthLabelsBn[item._id - 1],
      revenue: item.revenue,
      delivery: item.delivery,
      orders: item.orders,
    })),
    orderOverview: orderOverview.map((item) => ({ status: item._id || "unknown", count: item.count })),
    fraudOverview: fraudOverview.map((item) => ({ status: item._id || "clean", count: item.count })),
    recentOrders,
    topSelling,
    generatedAt: new Date(),
  });
});

exports.analyticsController = asyncHandler(async (req, res) => {
  const [visits, uniqueVisitors, topPaths] = await Promise.all([
    visitModel.countDocuments(),
    visitModel.distinct("visitorKey"),
    visitModel.aggregate([
      { $group: { _id: "$path", visits: { $sum: 1 }, visitors: { $addToSet: "$visitorKey" } } },
      { $project: { path: "$_id", visits: 1, visitors: { $size: "$visitors" }, _id: 0 } },
      { $sort: { visits: -1 } },
      { $limit: 10 },
    ]),
  ]);
  apiResponse(res, 200, messages.analyticsFetched, { visits, uniqueVisitors: uniqueVisitors.length, topPaths });
});

exports.recordVisitController = asyncHandler(async (req, res) => {
  const visitorKey = req.body?.visitorKey || req.headers["x-visitor-key"];
  if (!visitorKey) return apiResponse(res, 400, messages.visitorKeyRequired);
  await visitModel.create({ visitorKey, path: req.body?.path || "/", user: req.session?.user?._id });
  apiResponse(res, 201, messages.visitRecorded);
});

/**
 * Updates delivery/payment state and lets staff resolve a flagged order:
 * `verified` clears a suspicious order, `fake` records it as a confirmed fake
 * so the customer's phone number is penalised on future attempts.
 */
exports.updateOrderController = asyncHandler(async (req, res) => {
  const { deliveryStatus, paymentStatus, fraudStatus } = req.body || {};
  const update = {};

  if (deliveryStatus && ["pending", "confirm", "deliverd", "cenceled"].includes(deliveryStatus)) {
    update.deliveryStatus = deliveryStatus;
  }
  if (paymentStatus && ["paid", "unpaid", "refunded"].includes(paymentStatus)) {
    update.paymentStatus = paymentStatus;
  }
  if (fraudStatus && ["clean", "review", "blocked", "verified", "fake"].includes(fraudStatus)) {
    update.fraudStatus = fraudStatus;
    update.verifiedBy = req.session.user._id;
    update.verifiedAt = new Date();
    if (fraudStatus === "fake") update.deliveryStatus = "cenceled";
  }

  const order = await orderModel.findByIdAndUpdate(req.params.id, update, { new: true }).populate("user", "fullname email");
  if (!order) return apiResponse(res, 404, messages.orderNotFound);
  apiResponse(res, 200, messages.orderUpdated, order);
});

exports.transactionsController = asyncHandler(async (req, res) => {
  const transactions = await orderModel
    .find({ transaction_id: { $nin: ["", null] } })
    .sort({ createdAt: -1 })
    .populate("user", "fullname email")
    .select("orderNumber transaction_id totalprice deliveryCharge paymentStatus paymentMethod user customer createdAt");
  apiResponse(res, 200, messages.transactionsFetched, transactions);
});

/** Orders the fraud checker flagged, newest first, for the review queue. */
exports.fraudQueueController = asyncHandler(async (req, res) => {
  const orders = await orderModel
    .find({ fraudStatus: { $in: ["review", "blocked", "fake"] } })
    .sort({ riskScore: -1, createdAt: -1 })
    .populate("user", "fullname email")
    .select("orderNumber customer totalprice deliveryCharge paymentMethod deliveryStatus fraudStatus riskScore riskLevel riskFlags isGuest ipAddress createdAt");
  apiResponse(res, 200, messages.ordersFetched, orders);
});
