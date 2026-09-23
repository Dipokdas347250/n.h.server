const mongoose = require("mongoose");

/**
 * A single document holding store-wide configuration: delivery charges per zone
 * and the thresholds the fraud checker uses. `getSettings()` creates it with
 * sensible defaults the first time it is asked for.
 */
const deliveryZoneSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    labelBn: { type: String, required: true, trim: true },
    charge: { type: Number, required: true, min: 0 },
    estimatedDays: { type: String, default: "2-3" },
    estimatedDaysBn: { type: String, default: "২-৩" },
  },
  { _id: false }
);

const settingSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "store", unique: true },
    currency: { type: String, default: "BDT" },
    deliveryZones: { type: [deliveryZoneSchema], default: undefined },
    freeDeliveryThreshold: { type: Number, default: 0, min: 0 },
    codMaxAmount: { type: Number, default: 20000, min: 0 },
    fraud: {
      enabled: { type: Boolean, default: true },
      blockScore: { type: Number, default: 70 },
      reviewScore: { type: Number, default: 35 },
      maxOrdersPerPhonePerDay: { type: Number, default: 3 },
      maxOrdersPerIpPerDay: { type: Number, default: 5 },
      maxPendingOrdersPerPhone: { type: Number, default: 3 },
      maxCancelledOrdersPerPhone: { type: Number, default: 2 },
      highValueCodAmount: { type: Number, default: 10000 },
      minAddressLength: { type: Number, default: 15 },
    },
  },
  { timestamps: true }
);

const DEFAULT_ZONES = [
  { key: "inside_dhaka", label: "Inside Dhaka city", labelBn: "ঢাকা সিটির ভেতরে", charge: 60, estimatedDays: "1-2", estimatedDaysBn: "১-২" },
  { key: "dhaka_suburb", label: "Dhaka suburb", labelBn: "ঢাকার আশপাশ", charge: 90, estimatedDays: "2-3", estimatedDaysBn: "২-৩" },
  { key: "outside_dhaka", label: "Outside Dhaka", labelBn: "ঢাকার বাইরে", charge: 130, estimatedDays: "3-5", estimatedDaysBn: "৩-৫" },
];

const Setting = mongoose.model("Setting", settingSchema);

/** Returns the one settings document, creating it with defaults if missing. */
Setting.getSettings = async () => {
  const existing = await Setting.findOne({ singleton: "store" });
  if (existing) {
    if (!existing.deliveryZones?.length) {
      existing.deliveryZones = DEFAULT_ZONES;
      await existing.save();
    }
    return existing;
  }
  return Setting.create({ singleton: "store", deliveryZones: DEFAULT_ZONES });
};

Setting.DEFAULT_ZONES = DEFAULT_ZONES;

module.exports = Setting;
