const express = require('express');
const { signupController, dashboardSignupController, loginController, alluserController, verifyOtpController, resendOtpController, getMeController, updateProfileController, logoutController } = require('../../../controllers/auth.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const {isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');
const router = express.Router();


router.post("/signup", signupController);
router.post("/dashboard-signup", dashboardSignupController);
router.post("/login", loginController);
router.post("/verifyotp",verifyOtpController);
router.post("/resendotp",resendOtpController);

router.get("/alluser", validAuthorize,
   isAuthorizeRole("admin","subadmin"),
    alluserController)

router.get("/getme",validAuthorize, isAuthorizeRole("admin","subadmin"),getMeController)
router.get("/me", validAuthorize, getMeController)
router.patch("/profile", validAuthorize, isAuthorizeRole("admin","subadmin"), updateProfileController)
router.post("/logout", validAuthorize, logoutController)




module.exports = router;