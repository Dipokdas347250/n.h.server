const fs = require("fs/promises");
const path = require("path");
const videoModel = require("../models/video.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const cloudinary = require("../utils/cloudinary");

const removeLocalFile = async (filename) => {
  if (!filename) return;
  await fs.unlink(path.join(__dirname, "../uploads", filename)).catch(() => {});
};

exports.addVideoController = asyncHandler(async (req, res) => {
  if (!req.file) return apiResponse(res, 400, "video is required");

  const { title, description } = req.body;
  if (!title?.trim()) {
    await removeLocalFile(req.file.filename);
    return apiResponse(res, 400, "title is required");
  }

  const uploadResult = await cloudinary.uploader.upload(req.file.path, {
    resource_type: "video",
    folder: "nh-shop/videos",
  });
  await removeLocalFile(req.file.filename);

  const video = await videoModel.create({
    title: title.trim(),
    description: description?.trim() || "",
    video: uploadResult.secure_url || uploadResult.url,
    uploadResultId: uploadResult.public_id,
  });

  return apiResponse(res, 201, "video created successfully", video);
});

exports.allVideoController = asyncHandler(async (req, res) => {
  const videos = await videoModel.find({ isPublished: true }).sort({ createdAt: -1 });
  return apiResponse(res, 200, "all videos fetched successfully", videos);
});

exports.allVideoAdminController = asyncHandler(async (req, res) => {
  const videos = await videoModel.find({}).sort({ createdAt: -1 });
  return apiResponse(res, 200, "all videos fetched successfully", videos);
});

exports.updateVideoController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = {};
  if (typeof req.body.title === "string") updates.title = req.body.title.trim();
  if (typeof req.body.description === "string") updates.description = req.body.description.trim();
  if (typeof req.body.isPublished !== "undefined") updates.isPublished = req.body.isPublished === true || req.body.isPublished === "true";

  const video = await videoModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!video) return apiResponse(res, 404, "video not found");
  return apiResponse(res, 200, "video updated successfully", video);
});

exports.deleteVideoController = asyncHandler(async (req, res) => {
  const video = await videoModel.findByIdAndDelete(req.params.id);
  if (!video) return apiResponse(res, 404, "video not found");
  if (video.uploadResultId) {
    await cloudinary.uploader.destroy(video.uploadResultId, { resource_type: "video" });
  }
  return apiResponse(res, 200, "video deleted successfully");
});
