/**
 * Every API response carries the message in both English and Bangla so the
 * storefront and the dashboard can render whichever language the visitor picked.
 *
 * `message` accepts either a plain string (same text for both languages) or an
 * object shaped `{ en, bn }`.
 */
exports.apiResponse = (res, statusCode, message, data) => {
  const en = typeof message === "string" ? message : message?.en || "";
  const bn = typeof message === "string" ? message : message?.bn || en;

  return res.status(statusCode).json({
    success: statusCode < 400,
    statusCode,
    message: en,
    messageBn: bn,
    data,
  });
};
