const fs = require("fs");
const productModel = require("../models/product.model");
const categoryModel = require("../models/categore.model");
const variantModel = require("../models/variant.model");
const orderModel = require("../models/checkout.model");
const cloudinary = require("../utils/cloudinary");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { DAY_MS, OPERATING_STATUSES, accountStatus, expiresAt } = require("../utils/merchant");
const submissionModel = require("../models/paymentSubmission.model");
const { releaseStock } = require("../utils/stock");
const { parseDateRange } = require("../utils/dateRange");
const { uploadProductImages, buildSlug, parseStock } = require("./mainProduct.controller");

/*
 * Everything a merchant does goes through here, behind `requireMerchant`.
 * Every query is filtered by `req.merchant._id`, which comes from the session,
 * so a merchant can only ever reach their own products and their own lines of
 * an order. A product or order that belongs to someone else answers 404, the
 * same as one that does not exist, so ids cannot be probed.
 */

const LOW_STOCK = 5;

/** Orders a merchant sees: the fraud checker's rejects and confirmed fakes never reach them. */
const ordersOf = (merchantId) => ({ merchants: merchantId, fraudStatus: { $nin: ["blocked", "fake"] } });

/** Which way each merchant order status may move. */
const NEXT_STATUS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const removeTempFiles = (files = []) => files.forEach((file) => fs.unlink(file.path, () => {}));

/** The merchant's own account, as shown on their dashboard. */
const merchantView = (merchant, hasOpenProof = false) => ({
  _id: merchant._id,
  name: merchant.name,
  businessName: merchant.businessName,
  address: merchant.address,
  accountStatus: accountStatus(merchant, hasOpenProof),
  expiresAt: expiresAt(merchant),
  // What is owed while the account is not paid up: one period's fee.
  outstandingAmount: ["payment_due", "suspended", "approved"].includes(merchant.status) ? merchant.monthlyFee : 0,
  trialStartsAt: merchant.trialStartsAt,
  email: merchant.email,
  phone: merchant.phone,
  facebookPage: merchant.facebookPage,
  productType: merchant.productType,
  status: merchant.status,
  trialEndsAt: merchant.trialEndsAt,
  trialDaysLeft: merchant.trialEndsAt ? Math.max(Math.ceil((merchant.trialEndsAt - Date.now()) / DAY_MS), 0) : 0,
  paidUntil: merchant.paidUntil,
  graceEndsAt: merchant.status === "payment_due" ? merchant.graceEndsAt : null,
  suspendedAuto: merchant.status === "suspended" && merchant.suspendedAuto,
  monthlyFee: merchant.monthlyFee,
  canEditProducts: OPERATING_STATUSES.includes(merchant.status),
  payments: [...(merchant.payments || [])]
    .reverse()
    .map(({ amount, months, method, periodStart, periodEnd, createdAt }) => ({ amount, months, method, periodStart, periodEnd, createdAt })),
  createdAt: merchant.createdAt,
});

/**
 * One order trimmed to what this merchant needs to fulfil it: who to deliver
 * to, their own lines and their own status. Other merchants' lines, the order
 * total, and the fraud and payment-gateway internals are never sent.
 */
const merchantOrderView = (order, merchantId) => {
  const mine = order.items.filter((item) => String(item.merchant) === String(merchantId));
  const progress = order.merchantStatus.find((entry) => String(entry.merchant) === String(merchantId));
  const shipping = order.shipping || order.customer || {};

  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    customer: {
      name: shipping.name,
      phone: shipping.phone,
      address: shipping.address,
      city: shipping.city,
      district: shipping.district,
      division: shipping.division,
      postcode: shipping.postcode,
      note: shipping.note,
    },
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.deliveryStatus,
    underReview: order.fraudStatus === "review",
    items: mine.map((item) => ({
      product: item.product,
      variant: item.variant,
      title: item.title,
      image: item.image,
      quntity: item.quntity,
      unitprice: item.unitprice,
      totalprice: item.totalprice,
    })),
    subtotal: mine.reduce((sum, item) => sum + Number(item.totalprice || 0), 0),
    status: progress?.status || "pending",
    note: progress?.note || "",
    statusUpdatedAt: progress?.updatedAt || null,
  };
};

const ORDER_FIELDS = "orderNumber createdAt shipping customer paymentMethod paymentStatus deliveryStatus fraudStatus items merchantStatus";

const findMyOrder = (merchantId, orderId) =>
  orderModel
    .findOne({ _id: orderId, ...ordersOf(merchantId) })
    .select(ORDER_FIELDS)
    .populate({ path: "items.variant", select: "size color" })
    .lean();

// ---------------------------------------------------------------- account

exports.myMerchantController = asyncHandler(async (req, res) => {
  const hasOpenProof = Boolean(await submissionModel.exists({ merchant: req.merchant._id, status: { $in: ["pending", "approved"] } }));
  apiResponse(res, 200, messages.merchantFetched, merchantView(req.merchant, hasOpenProof));
});

/** Product, order and sales counts for one merchant. Shared with the admin merchant page. */
exports.buildMerchantSummary = async (id) => {
  const liveOrders = { ...ordersOf(id), deliveryStatus: { $ne: "cenceled" } };

  const [productCounts, lowStock, orderCount, pendingOrders, sales] = await Promise.all([
    productModel.aggregate([{ $match: { merchant: id } }, { $group: { _id: "$approvalStatus", count: { $sum: 1 } } }]),
    productModel.countDocuments({ merchant: id, stock: { $type: "number", $lte: LOW_STOCK } }),
    orderModel.countDocuments(ordersOf(id)),
    orderModel.countDocuments({ ...liveOrders, merchantStatus: { $elemMatch: { merchant: id, status: "pending" } } }),
    orderModel.aggregate([
      { $match: { ...liveOrders, merchantStatus: { $elemMatch: { merchant: id, status: { $ne: "cancelled" } } } } },
      {
        $addFields: {
          myStatus: {
            $first: {
              $map: {
                input: { $filter: { input: "$merchantStatus", cond: { $eq: ["$$this.merchant", id] } } },
                in: "$$this.status",
              },
            },
          },
        },
      },
      { $unwind: "$items" },
      { $match: { "items.merchant": id } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.totalprice" },
          units: { $sum: "$items.quntity" },
          delivered: { $sum: { $cond: [{ $eq: ["$myStatus", "delivered"] }, "$items.totalprice", 0] } },
        },
      },
    ]),
  ]);

  const products = { pending: 0, approved: 0, rejected: 0 };
  productCounts.forEach((entry) => {
    products[entry._id || "approved"] = entry.count;
  });

  return {
    products: { ...products, total: products.pending + products.approved + products.rejected, lowStock },
    orders: { total: orderCount, pending: pendingOrders },
    sales: { revenue: sales[0]?.revenue || 0, delivered: sales[0]?.delivered || 0, units: sales[0]?.units || 0 },
  };
};

exports.merchantSummaryController = asyncHandler(async (req, res) => {
  apiResponse(res, 200, messages.dashboardFetched, await exports.buildMerchantSummary(req.merchant._id));
});

// ---------------------------------------------------------------- products

exports.myProductsController = asyncHandler(async (req, res) => {
  const query = { merchant: req.merchant._id };
  if (["pending", "approved", "rejected"].includes(req.query.status)) query.approvalStatus = req.query.status;

  const products = await productModel
    .find(query)
    .sort({ createdAt: -1 })
    .select("-review -reviewedBy -imageIds")
    .populate([{ path: "category", select: "_id name slug" }, { path: "variant", select: "size color sku" }]);
  apiResponse(res, 200, messages.productsFetched, products);
});

exports.myProductController = asyncHandler(async (req, res) => {
  const product = await productModel
    .findOne({ _id: req.params.id, merchant: req.merchant._id })
    .select("-review -reviewedBy -imageIds")
    .populate([{ path: "category", select: "_id name slug" }, { path: "variant", select: "size color sku" }]);
  if (!product) return apiResponse(res, 404, messages.productNotFound);
  apiResponse(res, 200, messages.productsFetched, product);
});

/** A new product always starts "pending" and stays off the storefront until an administrator approves it. */
exports.createMyProductController = asyncHandler(async (req, res) => {
  try {
    const category = await categoryModel.findById(req.body.category);
    if (!category) return apiResponse(res, 400, messages.categoryRequired);

    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const price = Number(req.body.price);
    const discountPrice =
      req.body.discountPrice === "" || req.body.discountPrice === undefined ? undefined : Number(req.body.discountPrice);

    if (!title || !description) return apiResponse(res, 400, messages.titleDescriptionRequired);
    if (!Number.isFinite(price) || price < 0) return apiResponse(res, 400, messages.priceRequired);
    if (discountPrice !== undefined && (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice > price)) {
      return apiResponse(res, 400, messages.discountRange);
    }
    const stock = parseStock(req.body.stock ?? "");
    if (stock === undefined) return apiResponse(res, 400, messages.stockInvalid);
    if (!req.files?.length) return apiResponse(res, 400, messages.photoRequired);

    let variantInput = [];
    try {
      variantInput = JSON.parse(req.body.variants || "[]");
      if (!Array.isArray(variantInput)) throw new Error("variants must be an array");
    } catch {
      return apiResponse(res, 400, messages.invalidVariants);
    }

    const uploaded = await uploadProductImages(req.files);
    const product = new productModel({
      title,
      description,
      price,
      discountPrice,
      offer: String(req.body.offer || "").trim(),
      sku: String(req.body.sku || "").trim(),
      stock,
      category: category._id,
      variantType: variantInput.length ? "multivariant" : "singlevariant",
      image: uploaded.map((file) => file.url),
      imageIds: uploaded.map((file) => file.publicId),
      slug: await buildSlug(title),
      merchant: req.merchant._id,
      approvalStatus: "pending",
    });
    await product.save();

    if (variantInput.length) {
      const variants = await variantModel.insertMany(variantInput.map((variant) => ({
        size: variant.size,
        color: variant.color,
        sku: variant.sku || `${product.sku || product.slug}-${variant.size}-${variant.color}`,
        product: product._id,
      })));
      product.variant = variants.map((variant) => variant._id);
      await product.save();
    }

    apiResponse(res, 201, messages.merchantProductSubmitted, product);
  } finally {
    removeTempFiles(req.files);
  }
});

/**
 * Edits a merchant's own product.
 *
 * Price, offer, SKU and stock change straight away. Anything customers read
 * as product content — title, description, category or photos — sends the
 * product back to "pending" for another review, as does any edit to a
 * rejected product. While payment is due only the stock may be changed, so a
 * merchant can still mark things sold out.
 */
/**
 * Hide or show one of the merchant's own products. Hidden products stay off
 * the storefront — also after a suspension is lifted — until shown again.
 * Showing never skips approval: a pending or rejected product stays off.
 */
exports.setMyProductListingController = asyncHandler(async (req, res) => {
  const listingStatus = req.body?.listingStatus;
  if (!["active", "hidden"].includes(listingStatus)) return apiResponse(res, 400, messages.listingStatusInvalid);
  const product = await productModel.findOneAndUpdate(
    { _id: req.params.id, merchant: req.merchant._id },
    { listingStatus },
    { returnDocument: "after" }
  );
  if (!product) return apiResponse(res, 404, messages.productNotFound);
  apiResponse(res, 200, listingStatus === "hidden" ? messages.productHidden : messages.productShown, { _id: product._id, listingStatus: product.listingStatus });
});

exports.updateMyProductController = asyncHandler(async (req, res) => {
  try {
    const product = await productModel.findOne({ _id: req.params.id, merchant: req.merchant._id });
    if (!product) return apiResponse(res, 404, messages.productNotFound);

    const body = req.body || {};
    const stockOnly = !req.files?.length && Object.keys(body).every((key) => key === "stock");
    if (!OPERATING_STATUSES.includes(req.merchant.status) && !stockOnly) {
      return apiResponse(res, 403, req.merchant.status === "approved" ? messages.merchantAwaitingPayment : messages.merchantPaymentDue);
    }

    const { title, description, price, discountPrice, offer, sku, category, stock } = body;
    let contentChanged = false;

    if (title !== undefined && String(title).trim() && String(title).trim() !== product.title) {
      product.title = String(title).trim();
      product.slug = await buildSlug(product.title, product._id);
      contentChanged = true;
    }
    if (description !== undefined && String(description).trim() !== product.description) {
      if (!String(description).trim()) return apiResponse(res, 400, messages.titleDescriptionRequired);
      product.description = String(description).trim();
      contentChanged = true;
    }
    if (price !== undefined) {
      const parsed = Number(price);
      if (!Number.isFinite(parsed) || parsed < 0) return apiResponse(res, 400, messages.priceRequired);
      product.price = parsed;
    }
    if (discountPrice !== undefined) {
      const parsed = discountPrice === "" ? undefined : Number(discountPrice);
      if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0 || parsed > product.price)) {
        return apiResponse(res, 400, messages.discountRange);
      }
      product.discountPrice = parsed;
    }
    if (offer !== undefined) product.offer = String(offer).trim();
    if (sku !== undefined) product.sku = String(sku).trim();
    if (stock !== undefined) {
      const parsed = parseStock(stock);
      if (parsed === undefined) return apiResponse(res, 400, messages.stockInvalid);
      product.stock = parsed;
    }
    if (category && String(category) !== String(product.category)) {
      if (!(await categoryModel.exists({ _id: category }))) return apiResponse(res, 400, messages.categoryRequired);
      product.category = category;
      contentChanged = true;
    }

    if (req.files?.length) {
      await Promise.all((product.imageIds || []).map((publicId) => cloudinary.uploader.destroy(publicId).catch(() => {})));
      const uploaded = await uploadProductImages(req.files);
      product.image = uploaded.map((file) => file.url);
      product.imageIds = uploaded.map((file) => file.publicId);
      contentChanged = true;
    }

    const needsReview = contentChanged || product.approvalStatus === "rejected";
    const resubmitted = needsReview && product.approvalStatus !== "pending";
    if (needsReview) {
      product.approvalStatus = "pending";
      product.rejectionReason = "";
      product.reviewedBy = null;
      product.reviewedAt = null;
    }

    await product.save();
    const { reviewedBy, imageIds, review, ...result } = product.toObject();
    apiResponse(res, 200, resubmitted ? messages.merchantProductResubmitted : messages.productUpdated, result);
  } finally {
    removeTempFiles(req.files);
  }
});

// ---------------------------------------------------------------- orders

exports.myOrdersController = asyncHandler(async (req, res) => {
  const id = req.merchant._id;
  const query = ordersOf(id);
  if (NEXT_STATUS[req.query.status]) query.merchantStatus = { $elemMatch: { merchant: id, status: req.query.status } };

  const range = parseDateRange(req.query);
  if (range) query.createdAt = { $gte: range.start, $lt: range.end };

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const page = Math.max(Math.trunc(Number(req.query.page)) || 1, 1);

  const [orders, total] = await Promise.all([
    orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(ORDER_FIELDS)
      .populate({ path: "items.variant", select: "size color" })
      .lean(),
    orderModel.countDocuments(query),
  ]);

  apiResponse(res, 200, messages.ordersFetched, {
    orders: orders.map((order) => merchantOrderView(order, id)),
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
  });
});

exports.myOrderController = asyncHandler(async (req, res) => {
  const order = await findMyOrder(req.merchant._id, req.params.id);
  if (!order) return apiResponse(res, 404, messages.orderNotFound);
  apiResponse(res, 200, messages.orderFetched, merchantOrderView(order, req.merchant._id));
});

/**
 * Moves the merchant's own part of an order along. Only this merchant's entry
 * in `merchantStatus` is touched, in one atomic update that also checks the
 * status has not changed since it was read. Cancelling returns this
 * merchant's units to stock.
 */
exports.updateMyOrderController = asyncHandler(async (req, res) => {
  const id = req.merchant._id;
  const order = await findMyOrder(id, req.params.id);
  if (!order) return apiResponse(res, 404, messages.orderNotFound);

  const current = merchantOrderView(order, id).status;
  const next = String(req.body?.status || "");
  if (order.deliveryStatus === "cenceled" || !NEXT_STATUS[current]?.includes(next)) {
    return apiResponse(res, 400, messages.merchantOrderStatusInvalid);
  }
  if (order.fraudStatus === "review" && next !== "cancelled") return apiResponse(res, 409, messages.merchantOrderUnderReview);

  const note = req.body?.note === undefined ? undefined : String(req.body.note).trim().slice(0, 500);
  const result = await orderModel.updateOne(
    { _id: order._id, merchantStatus: { $elemMatch: { merchant: id, status: current } } },
    {
      $set: {
        "merchantStatus.$.status": next,
        "merchantStatus.$.updatedAt": new Date(),
        ...(note !== undefined ? { "merchantStatus.$.note": note } : {}),
      },
    }
  );
  if (!result.modifiedCount) return apiResponse(res, 409, messages.merchantOrderStatusInvalid);
  if (next === "cancelled") await releaseStock(order._id, id);

  const updated = await findMyOrder(id, order._id);
  apiResponse(res, 200, messages.orderUpdated, merchantOrderView(updated, id));
});
