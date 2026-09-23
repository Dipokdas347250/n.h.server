const { apiResponse } = require("../utils/apiResponse");
const messages = require("../utils/messages");

/** Restricts a route to the listed roles. Always runs after `validAuthorize`. */
exports.isAuthorizeRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.session?.user?.role)) return next();
  return apiResponse(res, 403, messages.adminRequired);
};
