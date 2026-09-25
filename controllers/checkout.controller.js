const cartModel = require("../models/cart.model");
const checkoutModel = require("../models/checkout.model");
const productModel = require("../models/product.model");
const userModel = require("../models/user.model");
const Setting = require("../models/setting.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { resolveDelivery } = require("../utils/delivery");
const { evaluateOrder, normalizePhone, isValidBdPhone } = require("../utils/fraudCheck");
const { v4: uuidv4 } = require("uuid");

const SSLCommerzPayment = require("sslcommerz-lts");
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = String(process.env.SSL_IS_LIVE || "false") === "true";
const serverUrl = process.env.PUBLIC_SERVER_URL || `http://localhost:${process.env.PORT || 8080}`;
const storeUrl = process.env.STORE_URL || "http://localhost:3000";
const baseRoute = process.env.BASE_ROUTE || "/api/v1";

/** Sale price if there is one, otherwise the regular price. */
const getProductPrice = (product) =>
  Number(product.discountPrice ?? product.diccountprice ?? product.price ?? 0);

/**
 * Human-friendly order reference such as NH-260923-4831. The number is unique,
 * so keep drawing until one is free rather than letting the save collide.
 */
const buildOrderNumber = async () => {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `NH-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await checkoutModel.exists({ orderNumber: candidate }))) return candidate;
  }
  return `NH-${stamp}-${Date.now().toString().slice(-6)}`;
};

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";

/** Trims and normalises the customer block sent by the browser. */
const buildCustomer = (body, user) => {
  const shipping = body.shipping || {};
  const value = (...candidates) => {
    const found = candidates.find((candidate) => String(candidate ?? "").trim());
    return String(found ?? "").trim();
  };

  return {
    name: value(shipping.name, body.name, user?.fullname),
    email: value(shipping.email, body.email, user?.email).toLowerCase(),
    phone: normalizePhone(value(shipping.phone, body.phone, user?.phone)),
    address: value(shipping.address, body.address, user?.Adderss),
    city: value(shipping.city, body.city),
    district: value(shipping.district, body.district),
    division: value(shipping.division, body.division),
    postcode: value(shipping.postcode, body.postcode),
    note: value(shipping.note, body.note),
  };
};

/**
 * Turns whatever the browser sent into priced order lines.
 * Falls back to the signed-in customer's saved cart when no items are posted.
 * Prices always come from the database, never from the request body.
 */
const buildOrderItems = async (items, userId) => {
  if (Array.isArray(items) && items.length) {
    const requestedIds = items.map((item) => item.product).filter(Boolean);
    const products = await productModel.find({ _id: { $in: requestedIds } });
    const byId = new Map(products.map((product) => [String(product._id), product]));

    return items
      .map((item) => {
        const product = byId.get(String(item.product));
        if (!product) return null;
        const quantity = Math.max(Math.trunc(Number(item.quantity ?? item.quntity ?? 1)) || 1, 1);
        const unitprice = getProductPrice(product);
        return {
          product: product._id,
          variant: item.variant || undefined,
          title: product.title,
          image: product.image?.[0] || "",
          quntity: quantity,
          unitprice,
          totalprice: unitprice * quantity,
        };
      })
      .filter(Boolean);
  }

  if (!userId) return [];

  const cart = await cartModel.find({ user: userId }).populate("product");
  return cart
    .filter((line) => line.product)
    .map((line) => {
      const quantity = Math.max(Number(line.quntity) || 1, 1);
      const unitprice = getProductPrice(line.product);
      return {
        product: line.product._id,
        variant: line.variant || undefined,
        title: line.product.title,
        image: line.product.image?.[0] || "",
        quntity: quantity,
        unitprice,
        totalprice: unitprice * quantity,
      };
    });
};

/**
 * Counts of past behaviour for this phone number and IP, used by the fraud
 * checker.
 *
 * Orders the checker itself blocked are left out of the velocity and
 * cancellation counts: someone correcting a mistyped address and trying again
 * should not be punished twice for the same attempt. Orders staff confirmed as
 * fake are counted, because that is a real human judgement.
 */
const gatherHistory = async (phone, ip) => {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const notBlocked = { fraudStatus: { $ne: "blocked" } };

  const [phoneOrdersToday, ipOrdersToday, phonePendingOrders, phoneCancelledOrders, phoneFakeOrders] =
    await Promise.all([
      checkoutModel.countDocuments({ "customer.phone": phone, createdAt: { $gte: dayAgo }, ...notBlocked }),
      ip ? checkoutModel.countDocuments({ ipAddress: ip, createdAt: { $gte: dayAgo }, ...notBlocked }) : 0,
      checkoutModel.countDocuments({ "customer.phone": phone, deliveryStatus: "pending", ...notBlocked }),
      checkoutModel.countDocuments({ "customer.phone": phone, deliveryStatus: "cenceled", ...notBlocked }),
      checkoutModel.countDocuments({ "customer.phone": phone, fraudStatus: "fake" }),
    ]);

  return { phoneOrdersToday, ipOrdersToday, phonePendingOrders, phoneCancelledOrders, phoneFakeOrders };
};

/**
 * Places an order. Works for signed-in customers and for guests — a guest order
 * simply has no `user` and carries `isGuest: true`.
 */
exports.checkoutController = asyncHandler(async (req, res) => {
  const sessionUser = req.session?.user;
  const user = sessionUser?._id
    ? await userModel.findById(sessionUser._id).select("fullname email phone Adderss")
    : null;

  const { paymentMethod, items, deliveryZone } = req.body || {};
  if (!["cashOnDelivery", "online"].includes(paymentMethod)) {
    return apiResponse(res, 400, messages.paymentMethodRequired);
  }

  const customer = buildCustomer(req.body || {}, user);
  if (!customer.name || !customer.phone || !customer.address || !customer.city || !customer.district) {
    return apiResponse(res, 400, messages.customerInfoRequired);
  }
  if (!isValidBdPhone(customer.phone)) {
    return apiResponse(res, 400, messages.invalidPhone);
  }

  const orderItems = await buildOrderItems(items, user?._id);
  if (!orderItems.length) return apiResponse(res, 400, messages.cartEmpty);

  const settings = await Setting.getSettings();
  const subtotal = orderItems.reduce((sum, item) => sum + item.totalprice, 0);
  const delivery = resolveDelivery(settings, deliveryZone, subtotal);
  const total = subtotal + delivery.charge;

  const ipAddress = clientIp(req);
  const userAgent = String(req.headers["user-agent"] || "");
  const history = await gatherHistory(customer.phone, ipAddress);
  const risk = evaluateOrder(
    { customer, items: orderItems, total, paymentMethod, isGuest: !user, ipAddress, userAgent, history },
    settings
  );

  const order = new checkoutModel({
    orderNumber: await buildOrderNumber(),
    user: user?._id || null,
    isGuest: !user,
    customer,
    shipping: customer,
    items: orderItems,
    subtotal,
    deliveryZone: delivery.zone.key,
    deliveryZoneLabel: delivery.zone.label,
    deliveryZoneLabelBn: delivery.zone.labelBn,
    deliveryCharge: delivery.charge,
    totalprice: total,
    paymentMethod,
    riskScore: risk.score,
    riskLevel: risk.level,
    riskFlags: risk.flags,
    fraudStatus: risk.status,
    ipAddress,
    userAgent,
  });

  // A blocked order is still written down, cancelled, so staff can see what was
  // attempted and release it from the review queue if the checks were wrong.
  if (risk.status === "blocked") {
    order.deliveryStatus = "cenceled";
    await order.save();
    return apiResponse(res, 403, messages.orderBlocked, {
      orderNumber: order.orderNumber,
      riskScore: risk.score,
      riskLevel: risk.level,
      riskFlags: risk.flags,
    });
  }

  if (paymentMethod === "online") {
    order.transaction_id = uuidv4().replace(/-/g, "").slice(0, 20);
    const gatewayUrl = await startOnlinePayment(order, customer);
    if (!gatewayUrl) return apiResponse(res, 502, messages.paymentGatewayUnavailable);
    order.gatewayUrl = gatewayUrl;
  }

  await order.save();
  if (user?._id) await cartModel.deleteMany({ user: user._id });

  apiResponse(res, 201, messages.orderPlaced, order);
});

/** Opens an SSLCommerz session and returns the hosted payment page URL. */
async function startOnlinePayment(order, customer) {
  if (!store_id || !store_passwd) return null;

  const payload = {
    total_amount: order.totalprice,
    currency: "BDT",
    tran_id: order.transaction_id,
    success_url: `${serverUrl}${baseRoute}/api/checkout/payment_success/${order.transaction_id}`,
    fail_url: `${serverUrl}${baseRoute}/api/checkout/payment_fail/${order.transaction_id}`,
    cancel_url: `${serverUrl}${baseRoute}/api/checkout/payment_cancel/${order.transaction_id}`,
    ipn_url: `${serverUrl}${baseRoute}/api/checkout/payment_ipn`,
    shipping_method: "Courier",
    product_name: order.items.map((item) => item.title).filter(Boolean).join(", ").slice(0, 200) || "N H Shop order",
    product_category: "General",
    product_profile: "general",
    cus_name: customer.name,
    cus_email: customer.email || "guest@nhshop.local",
    cus_add1: customer.address,
    cus_city: customer.city,
    cus_state: customer.district,
    cus_postcode: customer.postcode || "1000",
    cus_country: "Bangladesh",
    cus_phone: customer.phone,
    ship_name: customer.name,
    ship_add1: customer.address,
    ship_city: customer.city,
    ship_state: customer.district,
    ship_postcode: customer.postcode || "1000",
    ship_country: "Bangladesh",
  };

  try {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const response = await sslcz.init(payload);
    return response?.GatewayPageURL || null;
  } catch (error) {
    console.error("SSLCommerz init failed:", error.message);
    return null;
  }
}

exports.paymentSuccessController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await checkoutModel.findOneAndUpdate(
    { transaction_id: id },
    { paymentStatus: "paid" },
    { new: true }
  );
  if (!order) return apiResponse(res, 404, messages.orderNotFound);
  res.redirect(`${storeUrl}/order-success?order=${encodeURIComponent(order.orderNumber)}`);
});

exports.paymentFailController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id) await checkoutModel.findOneAndUpdate({ transaction_id: id }, { paymentStatus: "unpaid" });
  res.redirect(`${storeUrl}/checkout?payment=failed`);
});

exports.paymentCancelController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id) await checkoutModel.findOneAndUpdate({ transaction_id: id }, { paymentStatus: "unpaid", deliveryStatus: "cenceled" });
  res.redirect(`${storeUrl}/checkout?payment=cancelled`);
});

/** SSLCommerz server-to-server notification. */
exports.paymentIpnController = asyncHandler(async (req, res) => {
  const { tran_id, status } = req.body || {};
  if (tran_id) {
    await checkoutModel.findOneAndUpdate(
      { transaction_id: tran_id },
      { paymentStatus: status === "VALID" || status === "VALIDATED" ? "paid" : "unpaid" }
    );
  }
  apiResponse(res, 200, messages.paymentSuccess);
});

/** Every order, for the dashboard. Supports filtering by fraud status. */
exports.getallordersController = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.fraudStatus) query.fraudStatus = req.query.fraudStatus;
  if (req.query.deliveryStatus) query.deliveryStatus = req.query.deliveryStatus;
  if (req.query.riskLevel) query.riskLevel = req.query.riskLevel;

  const orders = await checkoutModel
    .find(query)
    .sort({ createdAt: -1 })
    .populate({ path: "user", select: "fullname email phone" })
    .populate({ path: "items.product", select: "title image price" });

  apiResponse(res, 200, messages.ordersFetched, orders);
});

/** The signed-in customer's own order history. */
exports.myOrdersController = asyncHandler(async (req, res) => {
  const orders = await checkoutModel
    .find({ user: req.session.user._id })
    .sort({ createdAt: -1 })
    .select("-riskFlags -ipAddress -userAgent -riskScore -riskLevel");
  apiResponse(res, 200, messages.ordersFetched, orders);
});

/** Guest order tracking: order number plus the phone number used to order. */
exports.trackOrderController = asyncHandler(async (req, res) => {
  const orderNumber = String(req.query.orderNumber || req.body?.orderNumber || "").trim().toUpperCase();
  const phone = normalizePhone(req.query.phone || req.body?.phone);
  if (!orderNumber || !phone) return apiResponse(res, 400, messages.trackingInfoRequired);

  const order = await checkoutModel
    .findOne({ orderNumber, "customer.phone": phone })
    .select("-riskFlags -ipAddress -userAgent -riskScore -riskLevel");
  if (!order) return apiResponse(res, 404, messages.orderNotFound);

  apiResponse(res, 200, messages.orderFetched, order);
});
