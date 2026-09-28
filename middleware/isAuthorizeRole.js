const userModel = require("../models/user.model");
const { apiResponse } = require("../utils/apiResponse");
const messages = require("../utils/messages");

/**
 * Restricts a route to the listed roles. Always runs after `validAuthorize`.
 *
 * The role is read from the database rather than trusted from the session, so
 * an account that is demoted or deleted loses access on its next request
 * instead of keeping it until the session cookie expires.
 */
exports.isAuthorizeRole = (...roles) => async (req, res, next) => {
  try {
    const user = await userModel.findById(req.session.user._id).select("role verified").lean();
    if (!user || !user.verified || !roles.includes(user.role)) {
      return apiResponse(res, 403, messages.adminRequired);
    }
    req.session.user.role = user.role;
    return next();
  } catch (error) {
    return next(error);
  }
};
