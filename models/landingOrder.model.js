const mongoose = require("mongoose");

const landingOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, index: true },
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true, maxlength: 500 },
      city: { type: String, required: true, trim: true, maxlength: 120 },
    },
    product: {
      code: { type: String, required: true },
      name: { type: String, required: true },
      title: { type: String, required: true },
      weight: { type: String, default: "" },
      image: { type: String, default: "" },
      unitPrice: { type: Number, required: true, min: 0 },
    },
    quantity: { type: Number, required: true, min: 1, max: 50 },
    deliveryZone: { type: String, default: "inside_dhaka" },
    deliveryZoneLabel: { type: String, default: "" },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LandingOrder", landingOrderSchema);
