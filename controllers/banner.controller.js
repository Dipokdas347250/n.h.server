const fs = require("fs");
const bannerModel = require("../models/banner.model");
const cloudinary = require("../utils/cloudinary");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");

/** Banners carry their own headline text in both languages. */
const textFields = (body) => ({
  title: String(body.title || "").trim(),
  titleBn: String(body.titleBn || "").trim(),
  subtitle: String(body.subtitle || "").trim(),
  subtitleBn: String(body.subtitleBn || "").trim(),
  description: String(body.description || "").trim(),
  descriptionBn: String(body.descriptionBn || "").trim(),
  buttonLabel: String(body.buttonLabel || "").trim(),
  buttonLabelBn: String(body.buttonLabelBn || "").trim(),
});

exports.addBannerController = asyncHandler(async (req, res) => {
  if (!req.file) return apiResponse(res, 400, messages.bannerImageRequired);

  const uploadResult = await cloudinary.uploader.upload(req.file.path, { folder: "nh-shop/banners" });
  fs.unlink(req.file.path, () => {});

  const banner = await bannerModel.create({
    image: uploadResult.secure_url || uploadResult.url,
    uploadResultId: uploadResult.public_id,
    url: String(req.body.url || "").trim(),
    ...textFields(req.body),
  });

  apiResponse(res, 201, messages.bannerCreated, banner);
});

exports.allBannerController = asyncHandler(async (req, res) => {
  const banners = await bannerModel.find({}).sort({ createdAt: -1 });
  apiResponse(res, 200, messages.bannersFetched, banners);
});

exports.updateBannerController = asyncHandler(async (req, res) => {
  const id = req.params.id || req.body.id;
  const banner = await bannerModel.findById(id);
  if (!banner) return apiResponse(res, 404, messages.bannerNotFound);

  if (req.body.url !== undefined) banner.url = String(req.body.url).trim();
  Object.entries(textFields(req.body)).forEach(([key, value]) => {
    if (req.body[key] !== undefined) banner[key] = value;
  });

  if (req.file) {
    if (banner.uploadResultId) await cloudinary.uploader.destroy(banner.uploadResultId).catch(() => {});
    const uploadResult = await cloudinary.uploader.upload(req.file.path, { folder: "nh-shop/banners" });
    fs.unlink(req.file.path, () => {});
    banner.image = uploadResult.secure_url || uploadResult.url;
    banner.uploadResultId = uploadResult.public_id;
  }

  await banner.save();
  apiResponse(res, 200, messages.bannerUpdated, banner);
});

exports.deleteBannerController = asyncHandler(async (req, res) => {
  const banner = await bannerModel.findByIdAndDelete(req.params.id);
  if (!banner) return apiResponse(res, 404, messages.bannerNotFound);
  if (banner.uploadResultId) await cloudinary.uploader.destroy(banner.uploadResultId).catch(() => {});
  apiResponse(res, 200, messages.bannerDeleted);
});
