const fs = require("fs/promises");
const path = require("path");
const videoModel = require("../models/video.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const cloudinary = require("../utils/cloudinary");
const messages = require("../utils/messages");

const removeLocalFile = async (filename) => {
  if (!filename) return;
  await fs.unlink(path.join(__dirname, "../uploads", filename)).catch(() => {});
};

exports.addVideoController = asyncHandler(async (req, res) => {
  if (!req.file) return apiResponse(res, 400, messages.videoRequired);

  const { title, description, titleBn, descriptionBn } = req.body;
  if (!title?.trim()) {
    await removeLocalFile(req.file.filename);
    return apiResponse(res, 400, messages.titleRequired);
  }

  const uploadResult = await cloudinary.uploader.upload(req.file.path, {
    resource_type: "video",
    folder: "nh-shop/videos",
  });
  await removeLocalFile(req.file.filename);

  const video = await videoModel.create({
    title: title.trim(),
    description: description?.trim() || "",
    titleBn: titleBn?.trim() || "",
    descriptionBn: descriptionBn?.trim() || "",
    video: uploadResult.secure_url || uploadResult.url,
    uploadResultId: uploadResult.public_id,
  });

  return apiResponse(res, 201, messages.videoCreated, video);
});

exports.allVideoController = asyncHandler(async (req, res) => {
  const videos = await videoModel.find({ isPublished: true }).sort({ createdAt: -1 });
  return apiResponse(res, 200, messages.videosFetched, videos);
});

exports.allVideoAdminController = asyncHandler(async (req, res) => {
  const videos = await videoModel.find({}).sort({ createdAt: -1 });
  return apiResponse(res, 200, messages.videosFetched, videos);
});

exports.updateVideoController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = {};
  if (typeof req.body.title === "string") updates.title = req.body.title.trim();
  if (typeof req.body.description === "string") updates.description = req.body.description.trim();
  if (typeof req.body.titleBn === "string") updates.titleBn = req.body.titleBn.trim();
  if (typeof req.body.descriptionBn === "string") updates.descriptionBn = req.body.descriptionBn.trim();
  if (typeof req.body.isPublished !== "undefined") updates.isPublished = req.body.isPublished === true || req.body.isPublished === "true";

  const video = await videoModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!video) return apiResponse(res, 404, messages.videoNotFound);
  return apiResponse(res, 200, messages.videoUpdated, video);
});

exports.deleteVideoController = asyncHandler(async (req, res) => {
  const video = await videoModel.findByIdAndDelete(req.params.id);
  if (!video) return apiResponse(res, 404, messages.videoNotFound);
  if (video.uploadResultId) {
    await cloudinary.uploader.destroy(video.uploadResultId, { resource_type: "video" });
  }
  return apiResponse(res, 200, messages.videoDeleted);
});
