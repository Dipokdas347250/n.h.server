const { default: mongoose } = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // Optional Bangla copy; the storefront falls back to the English text.
    titleBn: { type: String, trim: true, default: "" },
    descriptionBn: { type: String, trim: true, default: "" },
    video: {
      type: String,
      required: [true, "video is required"],
      trim: true,
    },
    uploadResultId: {
      type: String,
      trim: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);
