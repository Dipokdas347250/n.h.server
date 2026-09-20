const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema(
  {
    visitorKey: { type: String, required: true, index: true },
    path: { type: String, default: "/" },
    user: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Visit", visitSchema);
