const Setting = require("../models/setting.model");

/**
 * Works out what a customer pays for delivery.
 *
 * Orders at or above `freeDeliveryThreshold` (when that threshold is set) ship
 * free; otherwise the charge comes from the zone the customer picked.
 *
 * @param {object} settings  the store settings document
 * @param {string} zoneKey   key of the chosen delivery zone
 * @param {number} subtotal  cart value before delivery
 */
const resolveDelivery = (settings, zoneKey, subtotal) => {
  const zones = settings?.deliveryZones?.length ? settings.deliveryZones : Setting.DEFAULT_ZONES;
  const zone = zones.find((item) => item.key === zoneKey) || zones[0];
  const threshold = Number(settings?.freeDeliveryThreshold || 0);
  const free = threshold > 0 && Number(subtotal) >= threshold;

  return {
    zone,
    charge: free ? 0 : Number(zone.charge || 0),
    isFree: free,
    freeDeliveryThreshold: threshold,
  };
};

/** The shape the storefront needs to render the delivery picker. */
const publicDeliveryConfig = (settings) => ({
  currency: settings?.currency || "BDT",
  freeDeliveryThreshold: Number(settings?.freeDeliveryThreshold || 0),
  codMaxAmount: Number(settings?.codMaxAmount || 0),
  deliveryZones: (settings?.deliveryZones?.length ? settings.deliveryZones : Setting.DEFAULT_ZONES).map((zone) => ({
    key: zone.key,
    label: zone.label,
    labelBn: zone.labelBn,
    charge: Number(zone.charge || 0),
    estimatedDays: zone.estimatedDays,
    estimatedDaysBn: zone.estimatedDaysBn,
  })),
});

module.exports = { resolveDelivery, publicDeliveryConfig };
