const mongoose = require("mongoose");

/**
 * One browsing session: a visitor's pages from arrival until they have been
 * idle for half an hour. Records made before sessions were tracked have only
 * `visitorKey`, `path` and `user`; the analytics treat each as a one-page visit.
 */
const visitSchema = new mongoose.Schema(
  {
    visitorKey: { type: String, required: true, index: true },
    // Unique so two first-page calls racing each other cannot open two sessions.
    sessionId: { type: String, unique: true, sparse: true },
    // Landing page.
    path: { type: String, default: "/" },
    user: { type: mongoose.Types.ObjectId, ref: "User" },
    pages: [
      {
        _id: false,
        path: { type: String, default: "/" },
        at: { type: Date, default: Date.now },
      },
    ],
    // Last sign of activity; time on site is this minus `createdAt`.
    lastSeenAt: { type: Date, default: Date.now },
    device: { type: String, enum: ["mobile", "tablet", "desktop"], default: "desktop" },
    os: { type: String, default: "" },
    browser: { type: String, default: "" },
    referrer: { type: String, default: "" },
    screen: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

visitSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Visit", visitSchema);
