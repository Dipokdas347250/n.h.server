const mongoose = require("mongoose");

/**
 * Lease for a scheduled job, so that with several API processes (or a quick
 * restart) only one runs it at a time, plus a record of its last run for the
 * admin panel. A lease that is not renewed expires, so a crashed process never
 * blocks the job for good.
 */
const jobLockSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  owner: { type: String, default: "" },
  lockedUntil: { type: Date, default: null },
  lastStartedAt: { type: Date, default: null },
  lastFinishedAt: { type: Date, default: null },
  lastError: { type: String, default: "" },
  lastSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
});

module.exports = mongoose.model("JobLock", jobLockSchema);
