const express = require('express');
const {
  signupController,
  dashboardSignupController,
  loginController,
  alluserController,
  verifyOtpController,
  resendOtpController,
  getMeController,
  updateProfileController,
  updatePhotoController,
  logoutController,
} = require('../../../controllers/auth.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');
const upload = require('../../../utils/upload');

const router = express.Router();

router.post("/signup", signupController);
router.post("/dashboard-signup", dashboardSignupController);
router.post("/login", loginController);
router.post("/verifyotp", verifyOtpController);
router.post("/resendotp", resendOtpController);

// Any signed-in customer can read and edit their own profile.
router.get("/me", validAuthorize, getMeController);
router.patch("/profile", validAuthorize, updateProfileController);
router.patch("/profile/photo", validAuthorize, upload.single("photo"), updatePhotoController);
router.post("/logout", validAuthorize, logoutController);

// Staff only.
router.get("/getme", validAuthorize, isAuthorizeRole("admin", "subadmin"), getMeController);
router.get("/alluser", validAuthorize, isAuthorizeRole("admin", "subadmin"), alluserController);

module.exports = router;
