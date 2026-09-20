const express = require('express');
const { signupController, loginController, alluserController, verifyOtpController, resendOtpController, getMeController } = require('../../../controllers/auth.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const {isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');
const router = express.Router();


router.post("/signup", signupController);
router.post("/login", loginController);
router.post("/verifyotp",verifyOtpController);
router.post("/resendotp",resendOtpController);

router.get("/alluser", validAuthorize,
   isAuthorizeRole("admin","subadmin"),
    alluserController)

router.get("/getme",validAuthorize, isAuthorizeRole("admin","subadmin"),getMeController)




module.exports = router;