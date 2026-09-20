const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const orderModel = require("../models/checkout.model");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const categoryModel = require("../models/categore.model");
const visitModel = require("../models/visit.model");

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

exports.dashboardController = asyncHandler(async (req, res) => {
  const [orders, users, products, categories, revenueTrend, orderOverview, recentOrders, uniqueVisitors] = await Promise.all([
    orderModel.countDocuments(),
    userModel.countDocuments(),
    productModel.countDocuments(),
    categoryModel.countDocuments(),
    orderModel.aggregate([
      { $match: { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } } },
      { $group: { _id: { $month: "$createdAt" }, revenue: { $sum: "$totalprice" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    orderModel.aggregate([{ $group: { _id: "$deliveryStatus", count: { $sum: 1 } } }]),
    orderModel.find({}).sort({ createdAt: -1 }).limit(8).populate("user", "fullname email").select("user totalprice paymentStatus deliveryStatus createdAt transaction_id"),
    visitModel.distinct("visitorKey"),
  ]);

  const revenue = await orderModel.aggregate([{ $group: { _id: null, total: { $sum: "$totalprice" } } }]);
  const previousPeriod = await orderModel.aggregate([
    { $match: { createdAt: { $lt: new Date(new Date().setMonth(new Date().getMonth() - 5)) } } },
    { $group: { _id: null, total: { $sum: "$totalprice" } } },
  ]);
  const currentRevenue = revenue[0]?.total || 0;
  const previousRevenue = previousPeriod[0]?.total || 0;
  const growth = previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  const now = new Date();
  const trend = revenueTrend.map((item) => ({ name: monthLabels[item._id - 1], revenue: item.revenue, orders: item.orders }));

  apiResponse(res, 200, "dashboard data fetched successfully", {
    metrics: { revenue: currentRevenue, orders, users, products, categories, growth: Number(growth.toFixed(1)), uniqueVisitors: uniqueVisitors.length },
    revenueTrend: trend,
    orderOverview: orderOverview.map((item) => ({ status: item._id || "unknown", count: item.count })),
    recentOrders,
    generatedAt: now,
  });
});

exports.analyticsController = asyncHandler(async (req, res) => {
  const [visits, uniqueVisitors, topPaths] = await Promise.all([
    visitModel.countDocuments(),
    visitModel.distinct("visitorKey"),
    visitModel.aggregate([{ $group: { _id: "$path", visits: { $sum: 1 }, visitors: { $addToSet: "$visitorKey" } } }, { $project: { path: "$_id", visits: 1, visitors: { $size: "$visitors" }, _id: 0 } }, { $sort: { visits: -1 } }, { $limit: 10 }]),
  ]);
  apiResponse(res, 200, "analytics fetched successfully", { visits, uniqueVisitors: uniqueVisitors.length, topPaths });
});

exports.recordVisitController = asyncHandler(async (req, res) => {
  const visitorKey = req.body?.visitorKey || req.headers["x-visitor-key"];
  if (!visitorKey) return apiResponse(res, 400, "visitorKey is required");
  await visitModel.create({ visitorKey, path: req.body?.path || "/", user: req.session?.user?._id });
  apiResponse(res, 201, "visit recorded");
});

exports.updateOrderController = asyncHandler(async (req, res) => {
  const allowed = ["deliveryStatus", "paymentStatus"];
  const update = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  const order = await orderModel.findByIdAndUpdate(req.params.id, update, { new: true }).populate("user", "fullname email");
  if (!order) return apiResponse(res, 404, "order not found");
  apiResponse(res, 200, "order updated successfully", order);
});

exports.transactionsController = asyncHandler(async (req, res) => {
  const transactions = await orderModel.find({ transaction_id: { $exists: true, $ne: "" } }).sort({ createdAt: -1 }).populate("user", "fullname email").select("transaction_id totalprice paymentStatus paymentMethod user createdAt");
  apiResponse(res, 200, "transactions fetched successfully", transactions);
});
