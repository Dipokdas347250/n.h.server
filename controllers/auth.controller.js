const bcrypt = require("bcrypt");
const userModel = require("../models/user.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const sendEmail = require("../helpers/sendEmail");
const otpNumber = require("../helpers/otp");
const { vaildEmail } = require("../helpers/vaildEmail");
const messages = require("../utils/messages");
// Shared with the email template so the quoted expiry always matches the real one.
const { OTP_EXPIRY_MS } = require("../config/mail.config");

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** What we keep on the session and hand back to the browser. */
const publicUser = (user) => ({
  _id: user._id,
  fullname: user.fullname,
  email: user.email,
  phone: user.phone || "",
  address: user.Adderss || "",
  role: user.role,
});

/** Shared registration path for both the storefront and the dashboard. */
const registerUser = async (req, res, { role }) => {
  const { fullname, email, password, phone, address, photo } = req.body || {};
  if (!fullname?.trim() || !email?.trim() || !password || password.length < 8) {
    return apiResponse(res, 400, messages.signupInvalid);
  }
  if (!vaildEmail(email)) return apiResponse(res, 400, messages.invalidEmail);

  const normalizedEmail = email.trim().toLowerCase();
  if (await userModel.exists({ email: normalizedEmail })) {
    return apiResponse(res, 400, messages.emailInUse);
  }
  if (role === "admin" && (await userModel.exists({ role: "admin" }))) {
    return apiResponse(res, 403, messages.adminExists);
  }

  const otp = otpNumber();
  const user = new userModel({
    fullname: fullname.trim(),
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
    phone,
    Adderss: address,
    photo,
    role,
    otp,
    otpExpire: Date.now() + OTP_EXPIRY_MS,
  });

  try {
    await sendEmail(user.email, user.fullname, otp);
  } catch (error) {
    console.error("Unable to send registration OTP:", error.message);
    return apiResponse(res, 503, messages.emailSendFailed);
  }

  await user.save();
  return apiResponse(
    res,
    201,
    role === "admin" ? messages.adminCreated : messages.userCreated,
    { _id: user._id, fullname: user.fullname, email: user.email }
  );
};

/** Storefront registration. Creating an account is optional — guests can order too. */
exports.signupController = asyncHandler((req, res) => registerUser(req, res, { role: "user" }));

/** Creates the very first dashboard administrator. */
exports.dashboardSignupController = asyncHandler((req, res) => registerUser(req, res, { role: "admin" }));

/**
 * Signs a customer in. The same endpoint serves the storefront and the
 * dashboard; passing `scope: "dashboard"` additionally requires staff access so
 * a normal shopper cannot land inside the admin panel.
 */
exports.loginController = asyncHandler(async (req, res) => {
  const { email, password, scope } = req.body || {};
  if (!vaildEmail(email || "")) return apiResponse(res, 400, messages.invalidEmail);

  const loginUser = await userModel.findOne({ email: String(email).trim().toLowerCase() });
  if (!loginUser) return apiResponse(res, 404, messages.emailNotFound);
  if (!loginUser.verified) return apiResponse(res, 403, messages.notVerified);

  const isStaff = ["admin", "subadmin"].includes(loginUser.role);
  if (scope === "dashboard" && !isStaff) return apiResponse(res, 403, messages.noDashboardAccess);

  const matches = await bcrypt.compare(String(password || ""), loginUser.password);
  if (!matches) return apiResponse(res, 401, messages.invalidPassword);

  req.session.cookie.maxAge = SESSION_TTL_MS;
  req.session.user = { ...publicUser(loginUser), login: true };

  apiResponse(res, 200, messages.loginSuccess, req.session.user);
});

exports.verifyOtpController = asyncHandler(async (req, res) => {
  const { email, otp } = req.body || {};
  const user = await userModel.findOne({ email: String(email || "").trim().toLowerCase() });
  if (!user) return apiResponse(res, 404, messages.emailNotFound);

  const submitted = String(otp || "").trim().toUpperCase();
  const saved = String(user.otp || "").trim().toUpperCase();
  if (!submitted || !saved || saved !== submitted) return apiResponse(res, 401, messages.otpInvalid);

  if (!user.otpExpire || user.otpExpire < new Date()) {
    user.otp = null;
    user.otpExpire = null;
    await user.save();
    return apiResponse(res, 401, messages.otpExpired);
  }

  user.verified = true;
  user.otp = null;
  user.otpExpire = null;
  await user.save();
  apiResponse(res, 200, messages.otpVerified);
});

exports.resendOtpController = asyncHandler(async (req, res) => {
  const user = await userModel.findOne({ email: String(req.body?.email || "").trim().toLowerCase() });
  if (!user) return apiResponse(res, 404, messages.emailNotFound);

  const otp = otpNumber();
  user.otp = otp;
  user.otpExpire = Date.now() + OTP_EXPIRY_MS;
  await user.save();

  try {
    await sendEmail(user.email, user.fullname, otp);
  } catch (error) {
    console.error("Unable to resend OTP:", error.message);
    return apiResponse(res, 503, messages.emailSendFailed);
  }
  apiResponse(res, 200, messages.otpResent);
});

exports.alluserController = asyncHandler(async (req, res) => {
  const users = await userModel.find({}).sort({ createdAt: -1 }).select("fullname email phone role verified createdAt");
  apiResponse(res, 200, messages.usersFetched, users);
});

exports.getMeController = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.session?.user?._id).select("_id fullname email phone Adderss role");
  if (!user) return apiResponse(res, 404, messages.userNotFound);
  apiResponse(res, 200, messages.profileFetched, publicUser(user));
});

exports.updateProfileController = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.session.user._id);
  if (!user) return apiResponse(res, 404, messages.userNotFound);

  const { fullname, phone, address, password } = req.body || {};
  if (fullname !== undefined && String(fullname).trim()) user.fullname = String(fullname).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (address !== undefined) user.Adderss = String(address).trim();
  if (password) {
    if (String(password).length < 8) return apiResponse(res, 400, messages.signupInvalid);
    user.password = await bcrypt.hash(String(password), 12);
  }
  await user.save();

  req.session.user = { ...req.session.user, ...publicUser(user) };
  apiResponse(res, 200, messages.profileUpdated, publicUser(user));
});

exports.logoutController = asyncHandler(async (req, res) => {
  req.session.destroy((error) => {
    if (error) return apiResponse(res, 500, messages.logoutFailed);
    res.clearCookie("ecommerce-session");
    apiResponse(res, 200, messages.logoutSuccess);
  });
});
