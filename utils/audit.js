const auditLogModel = require("../models/auditLog.model");

const clientIp = (req) =>
  (req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || req?.socket?.remoteAddress || "";

/**
 * Writes one audit log entry. `req` identifies who did it (the signed-in
 * administrator or merchant); pass `req: null` for the system itself, such as
 * an automatic suspension.
 *
 * A failed write is reported but never undoes the action it describes.
 */
const audit = async ({ req = null, action, merchant = null, subject = null, details = {} }) => {
  const user = req?.session?.user;
  const actorType = !user ? "system" : user.role === "merchant" ? "merchant" : "admin";
  try {
    await auditLogModel.create({
      action,
      actorType,
      actor: user?._id || null,
      actorName: user ? user.fullname || user.email || "" : "System",
      merchant: merchant?._id || null,
      merchantName: merchant?.name || "",
      subjectType: subject?.constructor?.modelName || "",
      subjectId: subject?._id || null,
      details,
      ip: req ? clientIp(req) : "",
      userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
    });
  } catch (error) {
    console.error(`Audit log write failed for ${action}:`, error.message);
  }
};

module.exports = { audit };
