const subadminModel = require("../models/subadmin.model");
const userModel = require("../models/user.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");

exports.applySubadminController = asyncHandler(async (req, res) => {
  const user = req.session.user._id;
  const { storename, logo, phone } = req.body || {};
  if (!storename?.trim() || !phone?.trim()) return apiResponse(res, 400, messages.customerInfoRequired);

  if (await subadminModel.exists({ user })) return apiResponse(res, 400, messages.subadminExists);

  const application = await subadminModel.create({
    user,
    storename: storename.trim(),
    logo,
    phone: phone.trim(),
  });
  apiResponse(res, 201, messages.subadminApplied, application);
});

exports.approveSubadminController = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!["pending", "approved", "rejected"].includes(status)) {
    return apiResponse(res, 400, messages.somethingWentWrong);
  }

  const application = await subadminModel.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!application) return apiResponse(res, 404, messages.userNotFound);

  // Approving the request is what actually grants the dashboard role.
  await userModel.findByIdAndUpdate(application.user, { role: status === "approved" ? "subadmin" : "user" });

  apiResponse(res, 200, messages.subadminUpdated, application);
});

exports.allSubadminController = asyncHandler(async (req, res) => {
  const applications = await subadminModel.find({}).sort({ createdAt: -1 }).populate("user", "fullname email");
  apiResponse(res, 200, messages.usersFetched, applications);
});
