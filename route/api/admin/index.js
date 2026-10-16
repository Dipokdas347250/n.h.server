const express = require("express");
const {
  dashboardController,
  analyticsController,
  recordVisitController,
  updateOrderController,
  transactionsController,
  fraudQueueController,
  ordersReportController,
  orderNotificationsController,
} = require("../../../controllers/admin.controller");
const { adminSettingsController, updateSettingsController } = require("../../../controllers/setting.controller");
const { adminAllProductsController } = require("../../../controllers/mainProduct.controller");
const {
  sendToSteadfastController,
  bulkSendToSteadfastController,
  steadfastStatusController,
  steadfastBalanceController,
} = require("../../../controllers/courier.controller");
const {
  allApplicationsController,
  singleApplicationController,
  approveApplicationController,
  rejectApplicationController,
  allMerchantsController,
  singleMerchantController,
  updateMerchantController,
  recordPaymentController,
  suspendMerchantController,
  activateMerchantController,
  lockMerchantController,
  unlockMerchantController,
  merchantProductsController,
  approveProductController,
  rejectProductController,
  revealApplicationNidController,
  revealMerchantNidController,
} = require("../../../controllers/merchantAdmin.controller");
const {
  allPaymentSubmissionsController,
  singlePaymentSubmissionController,
  approvePaymentController,
  rejectPaymentController,
  activateFromPaymentController,
} = require("../../../controllers/merchantBilling.controller");
const {
  allTicketsController,
  adminTicketController,
  adminReplyController,
  updateTicketStatusController,
} = require("../../../controllers/support.controller");
const {
  adminNotificationsController,
  markNotificationsReadController,
  auditLogController,
  notificationCenterController,
} = require("../../../controllers/notification.controller");
const { acceptPrivateUploads } = require("../../../utils/secureUpload");
const { validAuthorize } = require("../../../middleware/validAuthorize");
const { isAuthorizeRole } = require("../../../middleware/isAuthorizeRole");

const router = express.Router();

router.post("/visits", recordVisitController);

// Everything below is the dashboard, which only administrators may use.
router.use(validAuthorize, isAuthorizeRole("admin"));
router.get("/dashboard", dashboardController);
router.get("/analytics", analyticsController);
router.get("/transactions", transactionsController);
router.get("/fraud-queue", fraudQueueController);
router.get("/orders-report", ordersReportController);
router.get("/order-notifications", orderNotificationsController);
router.patch("/orders/:id", updateOrderController);
router.post("/orders/steadfast/bulk", bulkSendToSteadfastController);
router.post("/orders/:id/steadfast", sendToSteadfastController);
router.post("/orders/:id/steadfast/status", steadfastStatusController);
router.get("/steadfast/balance", steadfastBalanceController);
router.get("/settings", adminSettingsController);
router.patch("/settings", updateSettingsController);

// Merchants: applications, accounts, subscriptions and product approval.
router.get("/merchant-applications", allApplicationsController);
router.get("/merchant-applications/:id", singleApplicationController);
router.get("/merchant-applications/:id/nid", revealApplicationNidController);
router.post("/merchant-applications/:id/approve", approveApplicationController);
router.post("/merchant-applications/:id/reject", rejectApplicationController);
router.get("/merchants", allMerchantsController);
router.get("/merchants/:id", singleMerchantController);
router.get("/merchants/:id/nid", revealMerchantNidController);
router.patch("/merchants/:id", updateMerchantController);
router.post("/merchants/:id/payments", recordPaymentController);
router.post("/merchants/:id/suspend", suspendMerchantController);
router.post("/merchants/:id/activate", activateMerchantController);
router.post("/merchants/:id/lock", lockMerchantController);
router.post("/merchants/:id/unlock", unlockMerchantController);
router.get("/products", adminAllProductsController);
router.get("/merchant-products", merchantProductsController);
router.post("/merchant-products/:id/approve", approveProductController);
router.post("/merchant-products/:id/reject", rejectProductController);

// Merchant payment proofs: approve or reject, then activate.
router.get("/payment-submissions", allPaymentSubmissionsController);
router.get("/payment-submissions/:id", singlePaymentSubmissionController);
router.post("/payment-submissions/:id/approve", approvePaymentController);
router.post("/payment-submissions/:id/reject", rejectPaymentController);
router.post("/payment-submissions/:id/activate", activateFromPaymentController);

// Merchant Help & Support.
router.get("/support-tickets", allTicketsController);
router.get("/support-tickets/:id", adminTicketController);
router.post(
  "/support-tickets/:id/messages",
  acceptPrivateUploads([
    { name: "images", maxCount: 3, kind: "image" },
    { name: "audio", maxCount: 1, kind: "audio" },
  ]),
  adminReplyController
);
router.patch("/support-tickets/:id", updateTicketStatusController);

// Bell for payments, tickets and subscriptions, and the audit log.
router.get("/notifications", adminNotificationsController);
router.post("/notifications/read", markNotificationsReadController);
router.get("/notification-center", notificationCenterController);
router.get("/audit-logs", auditLogController);

module.exports = router;
