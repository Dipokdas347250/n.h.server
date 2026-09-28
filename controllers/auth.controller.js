const fs = require("fs");
const bcrypt = require("bcrypt");
const userModel = require("../models/user.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const sendEmail = require("../helpers/sendEmail");
const otpNumber = require("../helpers/otp");
const { vaildEmail } = require("../helpers/vaildEmail");
const messages = require("../utils/messages");
const cloudinary = require("../utils/cloudinary");
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
  photo: user.photo || "",
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
  // Only one administrator can register here; the one who started but did not
  // finish verifying may register again with the same email.
  if (role === "admin" && (await userModel.exists({ role: "admin", email: { $ne: normalizedEmail } }))) {
    return apiResponse(res, 403, messages.adminExists);
  }

  // An account that never verified its email was not proven to belong to
  // anyone, so registering again with that address replaces it.
  const existing = await userModel.findOne({ email: normalizedEmail });
  if (existing?.verified) return apiResponse(res, 400, messages.emailInUse);

  const otp = otpNumber();
  const user = existing || new userModel({ email: normalizedEmail });
  user.set({
    fullname: fullname.trim(),
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

/** Tells the dashboard's sign-in page whether the first administrator still has to be created. */
exports.dashboardStatusController = asyncHandler(async (req, res) => {
  const adminExists = Boolean(await userModel.exists({ role: "admin", verified: true }));
  apiResponse(res, 200, messages.dashboardStatusFetched, { adminExists });
});

/**
 * Signs a customer in. The same endpoint serves the storefront and the
 * dashboard; passing `scope: "dashboard"` additionally requires the admin role
 * so a normal shopper cannot land inside the admin panel.
 */
exports.loginController = asyncHandler(async (req, res) => {
  const { email, password, scope } = req.body || {};
  if (!vaildEmail(email || "")) return apiResponse(res, 400, messages.invalidEmail);

  const loginUser = await userModel.findOne({ email: String(email).trim().toLowerCase() });
  if (!loginUser) return apiResponse(res, 404, messages.emailNotFound);
  if (!loginUser.verified) return apiResponse(res, 403, messages.notVerified);

  const matches = await bcrypt.compare(String(password || ""), loginUser.password);
  if (!matches) return apiResponse(res, 401, messages.invalidPassword);

  // Checked after the password so the dashboard does not reveal which emails belong to shoppers.
  if (scope === "dashboard" && loginUser.role !== "admin") return apiResponse(res, 403, messages.noDashboardAccess);

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
  const user = await userModel.findById(req.session?.user?._id).select("_id fullname email phone Adderss photo role");
  if (!user) return apiResponse(res, 404, messages.userNotFound);
  apiResponse(res, 200, messages.profileFetched, publicUser(user));
});

exports.updateProfileController = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.session.user._id);
  if (!user) return apiResponse(res, 404, messages.userNotFound);

  const { fullname, email, phone, address, password, currentPassword } = req.body || {};

  // The email is the sign-in name, so changing it needs the current password.
  if (email !== undefined) {
    const nextEmail = String(email).trim().toLowerCase();
    if (nextEmail !== user.email) {
      if (!vaildEmail(nextEmail)) return apiResponse(res, 400, messages.invalidEmail);
      if (!currentPassword) return apiResponse(res, 400, messages.currentPasswordRequired);
      if (!(await bcrypt.compare(String(currentPassword), user.password))) {
        return apiResponse(res, 401, messages.invalidPassword);
      }
      if (await userModel.exists({ email: nextEmail, _id: { $ne: user._id } })) {
        return apiResponse(res, 400, messages.emailInUse);
      }
      user.email = nextEmail;
    }
  }

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

/** Replaces the signed-in account's profile picture. */
exports.updatePhotoController = asyncHandler(async (req, res) => {
  if (!req.file) return apiResponse(res, 400, messages.photoRequired);

  const user = await userModel.findById(req.session.user._id);
  if (!user) {
    fs.unlink(req.file.path, () => {});
    return apiResponse(res, 404, messages.userNotFound);
  }

  const uploadResult = await cloudinary.uploader
    .upload(req.file.path, {
      folder: "nh-shop/profiles",
      transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    })
    .finally(() => fs.unlink(req.file.path, () => {}));

  const previousId = user.photoId;
  user.photo = uploadResult.secure_url || uploadResult.url;
  user.photoId = uploadResult.public_id;
  await user.save();
  if (previousId) await cloudinary.uploader.destroy(previousId).catch(() => {});

  req.session.user = { ...req.session.user, ...publicUser(user) };
  apiResponse(res, 200, messages.photoUpdated, publicUser(user));
});

exports.logoutController = asyncHandler(async (req, res) => {
  req.session.destroy((error) => {
    if (error) return apiResponse(res, 500, messages.logoutFailed);
    res.clearCookie("ecommerce-session");
    apiResponse(res, 200, messages.logoutSuccess);
  });
});
