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

/**
 * The 11-character video id from any common YouTube link: watch, youtu.be,
 * shorts, embed, live or music links. Returns "" when it is not one.
 */
const parseYoutubeId = (value) => {
  const ID = /^[A-Za-z0-9_-]{11}$/;
  const text = String(value || "").trim();
  if (ID.test(text)) return text;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return "";
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id = "";
  if (host === "youtu.be") id = parts[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = parts[0] === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(parts[0]) ? parts[1] : "";
  }
  return ID.test(id || "") ? id : "";
};

const textFields = ({ title, description, titleBn, descriptionBn }) => ({
  title: title.trim(),
  description: description?.trim() || "",
  titleBn: titleBn?.trim() || "",
  descriptionBn: descriptionBn?.trim() || "",
});

exports.addVideoController = asyncHandler(async (req, res) => {
  const { title, youtubeUrl } = req.body || {};

  // YouTube link: nothing to upload, just remember the id.
  if (!req.file && youtubeUrl !== undefined) {
    if (!title?.trim()) return apiResponse(res, 400, messages.titleRequired);
    const youtubeId = parseYoutubeId(youtubeUrl);
    if (!youtubeId) return apiResponse(res, 400, messages.youtubeUrlInvalid);

    const video = await videoModel.create({
      ...textFields(req.body),
      source: "youtube",
      youtubeId,
      video: `https://www.youtube.com/watch?v=${youtubeId}`,
    });
    return apiResponse(res, 201, messages.videoCreated, video);
  }

  if (!req.file) return apiResponse(res, 400, messages.videoRequired);
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
    ...textFields(req.body),
    source: "upload",
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
  if (typeof req.body.youtubeUrl === "string") {
    const youtubeId = parseYoutubeId(req.body.youtubeUrl);
    if (!youtubeId) return apiResponse(res, 400, messages.youtubeUrlInvalid);
    Object.assign(updates, { source: "youtube", youtubeId, video: `https://www.youtube.com/watch?v=${youtubeId}` });
  }
  if (typeof req.body.isPublished !== "undefined") updates.isPublished = req.body.isPublished === true || req.body.isPublished === "true";

  const previous = await videoModel.findById(id);
  if (!previous) return apiResponse(res, 404, messages.videoNotFound);

  // Switching an uploaded file over to a YouTube link frees the Cloudinary copy.
  if (updates.source === "youtube" && previous.uploadResultId) {
    await cloudinary.uploader.destroy(previous.uploadResultId, { resource_type: "video" }).catch(() => {});
    updates.uploadResultId = "";
  }

  const video = await videoModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
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
