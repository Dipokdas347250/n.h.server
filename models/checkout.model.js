const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Snapshot of who the order goes to. Guests order without an account, so `email`
 * is optional here and only `name`, `phone`, `address`, `city` and `district`
 * are mandatory.
 */
const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    postcode: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

/** Price snapshot per line so later price edits never rewrite past orders. */
const orderItemSchema = new Schema(
  {
    product: { type: mongoose.Types.ObjectId, ref: "Product" },
    variant: { type: mongoose.Types.ObjectId, ref: "Variant" },
    title: { type: String, trim: true, default: "" },
    image: { type: String, default: "" },
    quntity: { type: Number, default: 1, min: 1 },
    unitprice: { type: Number, default: 0, min: 0 },
    totalprice: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/** Why the fraud checker was suspicious, kept so the dashboard can explain it. */
const riskFlagSchema = new Schema(
  {
    code: { type: String, required: true },
    score: { type: Number, default: 0 },
    label: { type: String, default: "" },
    labelBn: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, unique: true, index: true },
    user: { type: mongoose.Types.ObjectId, ref: "User", default: null },
    isGuest: { type: Boolean, default: false },
    customer: { type: customerSchema, required: true },
    shipping: { type: customerSchema, required: true },
    items: { type: [orderItemSchema], default: [] },

    subtotal: { type: Number, default: 0, min: 0 },
    deliveryZone: { type: String, default: "inside_dhaka" },
    deliveryZoneLabel: { type: String, default: "" },
    deliveryZoneLabelBn: { type: String, default: "" },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    totalprice: { type: Number, default: 0, min: 0 },

    paymentMethod: { type: String, enum: ["cashOnDelivery", "online"], required: true },
    transaction_id: { type: String, default: "" },
    gatewayUrl: { type: String, default: "" },

    deliveryStatus: {
      type: String,
      enum: ["pending", "confirm", "deliverd", "cenceled"],
      default: "pending",
    },
    paymentStatus: { type: String, enum: ["paid", "unpaid", "refunded"], default: "unpaid" },

    // fraud / fake-order detection
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    riskFlags: { type: [riskFlagSchema], default: [] },
    fraudStatus: {
      type: String,
      enum: ["clean", "review", "blocked", "verified", "fake"],
      default: "clean",
    },
    verifiedBy: { type: mongoose.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },

    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

orderSchema.index({ "customer.phone": 1, createdAt: -1 });
orderSchema.index({ ipAddress: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
