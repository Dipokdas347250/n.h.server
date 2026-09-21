const express = require('express');
const { checkoutController, getallordersController, paymentSuccessController, paymentFailController, paymentCancelController } = require('../../../controllers/checkout.controller');
const router = express.Router();
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');



router.post("/checkout_order" , validAuthorize, checkoutController)
router.post("/payment_success/:id" , paymentSuccessController)
router.post("/payment_fail" , paymentFailController)
router.post("/payment_cancel",paymentCancelController )
router.get("/all-orders", validAuthorize, isAuthorizeRole("admin", "subadmin"), getallordersController)






module.exports = router;    