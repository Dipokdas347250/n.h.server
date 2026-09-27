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
    // `youtube` videos are embedded from YouTube; `upload` ones are files kept
    // on Cloudinary (the older way, still played back for existing entries).
    source: {
      type: String,
      enum: ["upload", "youtube"],
      default: "upload",
    },
    youtubeId: {
      type: String,
      trim: true,
      default: "",
    },
    // Playable URL: the Cloudinary file, or the YouTube watch link.
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
