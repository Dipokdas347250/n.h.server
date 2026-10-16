const fs = require("fs");
const bcrypt = require("bcrypt");
const applicationModel = require("../models/merchantApplication.model");
const merchantModel = require("../models/merchant.model");
const userModel = require("../models/user.model");
const cloudinary = require("../utils/cloudinary");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { vaildEmail } = require("../helpers/vaildEmail");
const { normalizePhone, isValidBdPhone } = require("../utils/fraudCheck");
const { normalizeNid, isValidNid, normalizeFacebookPage } = require("../utils/merchant");
const { notifyAdmins } = require("../utils/notify");
const { checkNidPhoto } = require("../utils/nidOcr");
const { hashNid, protectNid } = require("../utils/nidCrypto");

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";

const removeTempFiles = (req) =>
  Object.values(req.files || {}).flat().forEach((file) => fs.unlink(file.path, () => {}));

/**
 * Stores an NID photo as an authenticated Cloudinary asset: it has no public
 * URL, and only the admin API hands out signed links to it.
 */
const uploadNidImage = async (file) => {
  const result = await cloudinary.uploader.upload(file.path, { folder: "nh-shop/merchant-nid", type: "authenticated" });
  return { publicId: result.public_id, format: result.format || "" };
};

/**
 * "Apply for a merchant account". Open to anyone; nothing is granted until an
 * administrator approves the application in the dashboard.
 *
 * An NID that already belongs to a merchant is accepted but flagged, so the
 * administrator decides whether it is a genuine second business or someone
 * trying to collect another free trial.
 */
exports.applyMerchantController = asyncHandler(async (req, res) => {
  try {
    const body = req.body || {};
    const fullname = String(body.fullname || "").trim().slice(0, 100);
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizePhone(body.phone);
    const businessName = String(body.businessName || "").trim().slice(0, 150);
    const address = String(body.address || "").trim().slice(0, 500);
    const productType = String(body.productType || "").trim().slice(0, 500);
    const nidNumber = normalizeNid(body.nidNumber);
    const password = String(body.password || "");

    if (!fullname || !phone || !businessName || !address || !productType || !nidNumber || password.length < 8) {
      return apiResponse(res, 400, messages.merchantApplicationInvalid);
    }
    // Email is optional; without one the merchant signs in with the mobile number.
    if (email && !vaildEmail(email)) return apiResponse(res, 400, messages.invalidEmail);
    if (!isValidBdPhone(phone)) return apiResponse(res, 400, messages.invalidPhone);
    // Optional too, but must be a real Facebook link when given.
    const facebookPage = normalizeFacebookPage(body.facebookPage);
    if (String(body.facebookPage || "").trim() && !facebookPage) return apiResponse(res, 400, messages.facebookPageInvalid);
    if (!isValidNid(nidNumber)) return apiResponse(res, 400, messages.nidInvalid);
    const nidHash = hashNid(nidNumber);

    const nidFrontFile = req.files?.nidFront?.[0];
    const nidBackFile = req.files?.nidBack?.[0];
    if (!nidFrontFile || !nidBackFile) return apiResponse(res, 400, messages.nidImagesRequired);

    if (email && (await userModel.exists({ email }))) return apiResponse(res, 409, messages.merchantEmailInUse);
    // Without an email the mobile number is the sign-in name, so it must be free.
    if (!email && (await userModel.exists({ phone, role: "merchant" }))) return apiResponse(res, 409, messages.merchantPhoneInUse);
    if (await applicationModel.exists({ status: "pending", $or: [{ nidHash }, { phone }, ...(email ? [{ email }] : [])] })) {
      return apiResponse(res, 409, messages.merchantApplicationPending);
    }

    // The typed number must be the one on the card. A photo that cannot be
    // read is let through and flagged for the administrator instead.
    const nidCheck = await checkNidPhoto(nidFrontFile.path, nidNumber);
    if (nidCheck.status === "mismatch") return apiResponse(res, 400, messages.nidPhotoMismatch);

    // Same NID as an existing merchant: not refused, but sent to manual review
    // and approved without a free trial unless the administrator decides otherwise.
    const duplicateOf = await merchantModel.distinct("_id", { nidHash });
    const [nidFront, nidBack] = await Promise.all([uploadNidImage(nidFrontFile), uploadNidImage(nidBackFile)]);

    const application = await applicationModel.create({
      fullname,
      email,
      phone,
      businessName,
      address,
      facebookPage,
      productType,
      ...protectNid(nidNumber),
      nidFront,
      nidBack,
      passwordHash: await bcrypt.hash(password, 12),
      duplicateNid: duplicateOf.length > 0,
      duplicateOf,
      nidCheck: { status: nidCheck.status },
      ipAddress: clientIp(req),
    });

    await notifyAdmins({
      type: "merchant_application",
      params: { name: fullname, businessName, nidCheck: nidCheck.status, duplicateNid: duplicateOf.length > 0 },
      link: "/merchants/applications",
    });

    return apiResponse(res, 201, messages.merchantApplied, { _id: application._id, status: application.status });
  } finally {
    removeTempFiles(req);
  }
});
