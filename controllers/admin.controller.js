const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const messages = require("../utils/messages");
const orderModel = require("../models/checkout.model");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const categoryModel = require("../models/categore.model");
const visitModel = require("../models/visit.model");
const { autoSendIfEnabled } = require("./courier.controller");
const { parseUserAgent } = require("../utils/userAgent");
const { TIMEZONE, DAY_MS, dhakaDateOf, todayInDhaka, parseDateRange } = require("../utils/dateRange");

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

// Seconds between arriving and the last activity; 0 for pre-session records.
const DURATION = {
  $divide: [{ $subtract: [{ $ifNull: ["$lastSeenAt", "$createdAt"] }, "$createdAt"] }, 1000],
};
// Pages seen, counting a pre-session record's single page.
const PAGES = { $ifNull: ["$pages", [{ path: "$path" }]] };
const SESSIONS_PER_PAGE = 50;

/** Counts per value of one field, most common first. */
const breakdown = (field, limit = 6) => [
  { $group: { _id: { $ifNull: [field, "unknown"] }, count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: limit },
  { $project: { _id: 0, name: "$_id", count: 1 } },
];

exports.analyticsController = asyncHandler(async (req, res) => {
  const range = parseDateRange(req.query);
  const match = range ? { createdAt: { $gte: range.start, $lt: range.end } } : {};
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

  const [facets] = await visitModel.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              visits: { $sum: 1 },
              visitors: { $addToSet: "$visitorKey" },
              signedIn: { $addToSet: "$user" },
              pageViews: { $sum: { $size: PAGES } },
              totalDuration: { $sum: DURATION },
              // Pre-session records have no timing, so they stay out of the average.
              timed: { $sum: { $cond: [{ $ifNull: ["$sessionId", false] }, 1, 0] } },
            },
          },
        ],
        devices: breakdown("$device", 3),
        browsers: breakdown("$browser"),
        os: breakdown("$os"),
        topPaths: [
          { $project: { visitorKey: 1, pages: PAGES } },
          { $unwind: "$pages" },
          { $group: { _id: "$pages.path", visits: { $sum: 1 }, visitors: { $addToSet: "$visitorKey" } } },
          { $project: { path: "$_id", visits: 1, visitors: { $size: "$visitors" }, _id: 0 } },
          { $sort: { visits: -1 } },
          { $limit: 10 },
        ],
        sessions: [
          { $sort: { createdAt: -1 } },
          { $skip: (page - 1) * SESSIONS_PER_PAGE },
          { $limit: SESSIONS_PER_PAGE },
          { $lookup: { from: userModel.collection.name, localField: "user", foreignField: "_id", as: "user" } },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              visitorKey: 1,
              path: 1,
              pages: PAGES,
              device: { $ifNull: ["$device", "unknown"] },
              os: 1,
              browser: 1,
              referrer: 1,
              screen: 1,
              createdAt: 1,
              lastSeenAt: 1,
              duration: DURATION,
              timed: { $cond: [{ $ifNull: ["$sessionId", false] }, true, false] },
              user: { _id: "$user._id", fullname: "$user.fullname", email: "$user.email", phone: "$user.phone" },
            },
          },
        ],
      },
    },
  ]);

  const summary = facets.summary[0];
  const sessions = facets.sessions;

  // How many times each listed visitor has come, across all time.
  const keys = [...new Set(sessions.map((session) => session.visitorKey))];
  const history = await visitModel.aggregate([
    { $match: { visitorKey: { $in: keys } } },
    { $group: { _id: "$visitorKey", count: { $sum: 1 } } },
  ]);
  const visitsOf = Object.fromEntries(history.map((item) => [item._id, item.count]));

  apiResponse(res, 200, messages.analyticsFetched, {
    visits: summary?.visits || 0,
    uniqueVisitors: summary?.visitors.length || 0,
    signedInVisitors: summary?.signedIn.length || 0,
    pageViews: summary?.pageViews || 0,
    averageDuration: summary?.timed ? Math.round(summary.totalDuration / summary.timed) : 0,
    devices: facets.devices,
    browsers: facets.browsers,
    os: facets.os,
    topPaths: facets.topPaths,
    sessions: sessions.map((session) => ({
      ...session,
      duration: Math.round(session.duration),
      user: session.user?._id ? session.user : null,
      totalVisits: visitsOf[session.visitorKey] || 1,
    })),
    page,
    pages: Math.max(1, Math.ceil((summary?.visits || 0) / SESSIONS_PER_PAGE)),
  });
});

const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;
const clip = (value, length) => String(value || "").slice(0, length);

/**
 * Called by the storefront on every page it shows (`page`) and every 15
 * seconds while the visitor is active (`ping`); the gap between the first and
 * last call is their time on the site.
 */
exports.recordVisitController = asyncHandler(async (req, res) => {
  const visitorKey = clip(req.body?.visitorKey || req.headers["x-visitor-key"], 64);
  if (!visitorKey) return apiResponse(res, 400, messages.visitorKeyRequired);

  const userAgent = clip(req.headers["user-agent"], 400);
  const { isBot, device, os, browser } = parseUserAgent(userAgent, req.body?.touch);
  if (isBot) return apiResponse(res, 201, messages.visitRecorded);

  const sessionId = String(req.body?.sessionId || "");
  const path = clip(req.body?.path || "/", 300);
  const userId = req.session?.user?._id;

  // Older storefront builds send no session id: keep the one-record-per-visit behaviour.
  if (!SESSION_ID.test(sessionId)) {
    await visitModel.create({ visitorKey, path, pages: [{ path }], user: userId, device, os, browser, userAgent });
    return apiResponse(res, 201, messages.visitRecorded);
  }

  const now = new Date();
  const found = { sessionId, visitorKey };
  // Someone who signs in part-way through is credited for the whole session.
  const seen = { lastSeenAt: now, ...(userId ? { user: userId } : {}) };

  if (req.body?.event === "ping") {
    await visitModel.updateOne(found, { $set: seen });
  } else {
    const update = {
      $set: seen,
      $push: { pages: { $each: [{ path, at: now }], $slice: -200 } },
      $setOnInsert: {
        path,
        device,
        os,
        browser,
        userAgent,
        referrer: clip(req.body?.referrer, 300),
        screen: clip(req.body?.screen, 20),
      },
    };
    try {
      await visitModel.updateOne(found, update, { upsert: true });
    } catch (error) {
      // Lost a race to open this session; it exists now, so just add the page.
      if (error.code !== 11000) throw error;
      await visitModel.updateOne(found, update);
    }
  }

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

  let order = await orderModel.findByIdAndUpdate(req.params.id, update, { new: true }).populate("user", "fullname email");
  if (!order) return apiResponse(res, 404, messages.orderNotFound);

  // With automatic sending on, confirming an order books it with Steadfast.
  if (update.deliveryStatus === "confirm") order = await autoSendIfEnabled(order, req.session.user._id);
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

/**
 * Account for a span of Dhaka days — today unless `from`/`to` say otherwise.
 * A single day is broken down by hour, a longer span by day, so the dashboard
 * can chart either.
 */
exports.ordersReportController = asyncHandler(async (req, res) => {
  const today = todayInDhaka();
  const range = parseDateRange(req.query) || parseDateRange({ from: today });
  const days = Math.round((range.end - range.start) / DAY_MS);
  const granularity = days <= 1 ? "hour" : days <= 92 ? "day" : "month";
  const bucketFormat = { hour: "%H", day: "%Y-%m-%d", month: "%Y-%m" }[granularity];

  const [report] = await orderModel.aggregate([
    { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
    {
      $facet: {
        placed: [{ $group: { _id: null, count: { $sum: 1 } } }],
        sold: [
          { $match: SOLD_MATCH },
          {
            $group: {
              _id: null,
              orders: { $sum: 1 },
              revenue: { $sum: "$totalprice" },
              goods: { $sum: "$subtotal" },
              delivery: { $sum: "$deliveryCharge" },
              items: { $sum: { $sum: "$items.quntity" } },
              cod: { $sum: { $cond: [{ $eq: ["$paymentMethod", "cashOnDelivery"] }, "$totalprice", 0] } },
              online: { $sum: { $cond: [{ $eq: ["$paymentMethod", "online"] }, "$totalprice", 0] } },
              paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$totalprice", 0] } },
              delivered: { $sum: { $cond: [{ $eq: ["$deliveryStatus", "deliverd"] }, "$totalprice", 0] } },
            },
          },
        ],
        byStatus: [{ $group: { _id: "$deliveryStatus", count: { $sum: 1 }, amount: { $sum: "$totalprice" } } }],
        byFraud: [{ $group: { _id: "$fraudStatus", count: { $sum: 1 } } }],
        timeline: [
          { $match: SOLD_MATCH },
          {
            $group: {
              _id: { $dateToString: { format: bucketFormat, date: "$createdAt", timezone: TIMEZONE } },
              orders: { $sum: 1 },
              revenue: { $sum: "$totalprice" },
            },
          },
          { $sort: { _id: 1 } },
        ],
        topProducts: [
          { $match: SOLD_MATCH },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.product",
              title: { $first: "$items.title" },
              quantity: { $sum: { $ifNull: ["$items.quntity", 1] } },
              amount: { $sum: "$items.totalprice" },
            },
          },
          { $sort: { quantity: -1, amount: -1 } },
          { $limit: 10 },
        ],
      },
    },
  ]);

  const sold = report.sold[0] || {};
  const byBucket = new Map(report.timeline.map((point) => [point._id, point]));

  // Fill empty hours/days/months with zeros so the chart has a continuous axis.
  const buckets = [];
  if (granularity === "hour") {
    for (let hour = 0; hour < 24; hour += 1) buckets.push(String(hour).padStart(2, "0"));
  } else {
    for (let time = range.start.getTime(); time < range.end.getTime(); time += DAY_MS) {
      const key = dhakaDateOf(time).slice(0, granularity === "month" ? 7 : 10);
      if (buckets[buckets.length - 1] !== key) buckets.push(key);
    }
  }

  apiResponse(res, 200, messages.reportFetched, {
    range: {
      from: dhakaDateOf(range.start),
      to: dhakaDateOf(range.end.getTime() - DAY_MS),
      today,
      granularity,
    },
    summary: {
      placed: report.placed[0]?.count || 0,
      orders: sold.orders || 0,
      revenue: sold.revenue || 0,
      goods: sold.goods || 0,
      delivery: sold.delivery || 0,
      items: sold.items || 0,
      cod: sold.cod || 0,
      online: sold.online || 0,
      paid: sold.paid || 0,
      delivered: sold.delivered || 0,
      averageOrder: sold.orders ? Math.round(sold.revenue / sold.orders) : 0,
    },
    byStatus: report.byStatus.map((item) => ({ status: item._id || "pending", count: item.count, amount: item.amount })),
    byFraud: report.byFraud.map((item) => ({ status: item._id || "clean", count: item.count })),
    timeline: buckets.map((key) => ({
      key,
      orders: byBucket.get(key)?.orders || 0,
      revenue: byBucket.get(key)?.revenue || 0,
    })),
    topProducts: report.topProducts.map((item) => ({
      product: item._id,
      title: item.title,
      quantity: item.quantity,
      amount: item.amount,
    })),
  });
});

/**
 * Polled by the dashboard bell. Returns the latest orders and how many arrived
 * after `since` (the moment this staff member last opened the bell). Orders the
 * fraud checker rejected outright are left out — nobody needs to act on them.
 */
exports.orderNotificationsController = asyncHandler(async (req, res) => {
  const since = new Date(String(req.query.since || ""));
  const hasSince = !Number.isNaN(since.getTime());
  const visible = { fraudStatus: { $ne: "blocked" } };

  const [latest, unread] = await Promise.all([
    orderModel
      .find(visible)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderNumber customer.name customer.phone totalprice paymentMethod deliveryStatus fraudStatus isGuest createdAt"),
    hasSince ? orderModel.countDocuments({ ...visible, createdAt: { $gt: since } }) : 0,
  ]);

  apiResponse(res, 200, messages.ordersFetched, { latest, unread, serverTime: new Date() });
});
