const Setting = require("../models/setting.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { publicDeliveryConfig } = require("../utils/delivery");
const messages = require("../utils/messages");

/** Delivery zones and charges the storefront checkout needs. Public. */
exports.publicSettingsController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  apiResponse(res, 200, messages.settingsFetched, publicDeliveryConfig(settings));
});

/** Full settings, including the fraud thresholds. Admin only. */
exports.adminSettingsController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  apiResponse(res, 200, messages.settingsFetched, settings);
});

exports.updateSettingsController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  const { deliveryZones, freeDeliveryThreshold, codMaxAmount, currency, fraud } = req.body || {};

  if (Array.isArray(deliveryZones)) {
    const cleaned = deliveryZones
      .filter((zone) => zone?.key && zone?.label)
      .map((zone) => ({
        key: String(zone.key).trim(),
        label: String(zone.label).trim(),
        labelBn: String(zone.labelBn || zone.label).trim(),
        charge: Math.max(Number(zone.charge) || 0, 0),
        estimatedDays: String(zone.estimatedDays || "2-3").trim(),
        estimatedDaysBn: String(zone.estimatedDaysBn || zone.estimatedDays || "২-৩").trim(),
      }));
    if (!cleaned.length) return apiResponse(res, 400, messages.deliveryZoneInvalid);
    settings.deliveryZones = cleaned;
  }

  if (freeDeliveryThreshold !== undefined) settings.freeDeliveryThreshold = Math.max(Number(freeDeliveryThreshold) || 0, 0);
  if (codMaxAmount !== undefined) settings.codMaxAmount = Math.max(Number(codMaxAmount) || 0, 0);
  if (currency !== undefined) settings.currency = String(currency).trim() || "BDT";

  if (fraud && typeof fraud === "object") {
    const numericKeys = [
      "blockScore", "reviewScore", "maxOrdersPerPhonePerDay", "maxOrdersPerIpPerDay",
      "maxPendingOrdersPerPhone", "maxCancelledOrdersPerPhone", "highValueCodAmount", "minAddressLength",
    ];
    if (fraud.enabled !== undefined) settings.fraud.enabled = fraud.enabled === true || fraud.enabled === "true";
    numericKeys.forEach((key) => {
      if (fraud[key] !== undefined && Number.isFinite(Number(fraud[key]))) {
        settings.fraud[key] = Math.max(Number(fraud[key]), 0);
      }
    });
  }

  await settings.save();
  apiResponse(res, 200, messages.settingsUpdated, settings);
});
