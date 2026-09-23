const { apiResponse } = require("../utils/apiResponse");
const messages = require("../utils/messages");

/** Requires a signed-in customer. Guest checkout deliberately skips this. */
exports.validAuthorize = (req, res, next) => {
  if (req.session?.user?.login && req.session.user._id) return next();
  return apiResponse(res, 401, messages.loginRequired);
};
