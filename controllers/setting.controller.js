const Setting = require("../models/setting.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { publicDeliveryConfig } = require("../utils/delivery");
const messages = require("../utils/messages");

/** Enough to show a key is saved without handing it out. */
const maskKey = (value) => (value ? `••••${String(value).slice(-4)}` : "");

/**
 * Settings as staff see them. The Steadfast keys are replaced by hints, so a
 * sub-admin (or anyone with a stolen session) cannot read them back.
 */
const adminSettingsView = (settings) => {
  const view = settings.toObject();
  const { apiKey = "", secretKey = "", autoSend = false } = view.steadfast || {};
  view.steadfast = {
    autoSend,
    apiKeyHint: maskKey(apiKey || process.env.STEADFAST_API_KEY),
    secretKeySet: Boolean(secretKey || process.env.STEADFAST_SECRET_KEY),
    fromEnvironment: !apiKey && Boolean(process.env.STEADFAST_API_KEY),
  };
  return view;
};

/** Delivery zones and charges the storefront checkout needs. Public. */
exports.publicSettingsController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  apiResponse(res, 200, messages.settingsFetched, publicDeliveryConfig(settings));
});

/** Full settings, including the fraud thresholds. Admin only. */
exports.adminSettingsController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  apiResponse(res, 200, messages.settingsFetched, adminSettingsView(settings));
});

exports.updateSettingsController = asyncHandler(async (req, res) => {
  const settings = await Setting.getSettings();
  const { deliveryZones, freeDeliveryThreshold, codMaxAmount, currency, fraud, metaPixelId, steadfast } = req.body || {};

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

  if (metaPixelId !== undefined) {
    // Digits only: the id is written into the storefront's tracking script.
    const pixelId = String(metaPixelId || "").trim();
    if (pixelId && !/^\d{6,20}$/.test(pixelId)) return apiResponse(res, 400, messages.pixelIdInvalid);
    settings.metaPixelId = pixelId;
  }

  if (steadfast && typeof steadfast === "object") {
    // A blank key field means "keep the saved key"; `clearKeys` removes both.
    if (steadfast.clearKeys === true) {
      settings.steadfast.apiKey = "";
      settings.steadfast.secretKey = "";
    }
    if (typeof steadfast.apiKey === "string" && steadfast.apiKey.trim()) settings.steadfast.apiKey = steadfast.apiKey.trim();
    if (typeof steadfast.secretKey === "string" && steadfast.secretKey.trim()) settings.steadfast.secretKey = steadfast.secretKey.trim();
    if (steadfast.autoSend !== undefined) settings.steadfast.autoSend = steadfast.autoSend === true || steadfast.autoSend === "true";
  }

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
  apiResponse(res, 200, messages.settingsUpdated, adminSettingsView(settings));
});
