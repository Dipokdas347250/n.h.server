const express = require('express');
const {
    checkoutController,
    getallordersController,
    myOrdersController,
    trackOrderController,
    paymentSuccessController,
    paymentFailController,
    paymentCancelController,
    paymentIpnController,
} = require('../../../controllers/checkout.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();

// Guests and signed-in customers both use this endpoint.
router.post("/checkout_order", checkoutController);
router.get("/track", trackOrderController);
router.post("/track", trackOrderController);

// SSLCommerz callbacks (the gateway posts, browsers may arrive with GET).
router.route("/payment_success/:id").get(paymentSuccessController).post(paymentSuccessController);
router.route("/payment_fail").get(paymentFailController).post(paymentFailController);
router.route("/payment_fail/:id").get(paymentFailController).post(paymentFailController);
router.route("/payment_cancel").get(paymentCancelController).post(paymentCancelController);
router.route("/payment_cancel/:id").get(paymentCancelController).post(paymentCancelController);
router.post("/payment_ipn", paymentIpnController);

router.get("/my-orders", validAuthorize, myOrdersController);
router.get("/all-orders", validAuthorize, isAuthorizeRole("admin", "subadmin"), getallordersController);

module.exports = router;
