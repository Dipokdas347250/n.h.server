const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * A file a merchant or an administrator attached: a payment screenshot, a
 * picture of a problem, or a voice recording. Stored as an authenticated
 * Cloudinary asset, so it has no public URL; the API hands out signed links
 * only to the merchant who owns it and to administrators.
 */
const attachmentSchema = new Schema(
  {
    kind: { type: String, enum: ["image", "audio"], required: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "video"], required: true },
    format: { type: String, default: "" },
    mimeType: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    originalName: { type: String, trim: true, default: "" },
  },
  { _id: true, timestamps: false }
);

module.exports = attachmentSchema;
