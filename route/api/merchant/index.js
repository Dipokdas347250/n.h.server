const express = require("express");
const { applyMerchantController } = require("../../../controllers/merchantApplication.controller");
const {
  myMerchantController,
  merchantSummaryController,
  myProductsController,
  myProductController,
  createMyProductController,
  updateMyProductController,
  setMyProductListingController,
  myOrdersController,
  myOrderController,
  updateMyOrderController,
} = require("../../../controllers/merchant.controller");
const { myBillingController, submitPaymentController } = require("../../../controllers/merchantBilling.controller");
const {
  myTicketsController,
  createTicketController,
  myTicketController,
  replyMyTicketController,
} = require("../../../controllers/support.controller");
const {
  myNotificationsController,
  markNotificationsReadController,
  notificationCenterController,
} = require("../../../controllers/notification.controller");
const { validAuthorize } = require("../../../middleware/validAuthorize");
const { requireMerchant, requireMerchantStatus } = require("../../../middleware/merchantAccess");
const upload = require("../../../utils/upload");
const { acceptPrivateUploads } = require("../../../utils/secureUpload");

const router = express.Router();

// Anyone may apply; an administrator decides.
router.post(
  "/apply",
  upload.fields([{ name: "nidFront", maxCount: 1 }, { name: "nidBack", maxCount: 1 }]),
  applyMerchantController
);

// Everything below is a merchant's own dashboard. `requireMerchant` resolves
// the merchant from the session, and every handler is scoped to it.
router.use(validAuthorize, requireMerchant);

// A suspended merchant can still see their account status, pay, and ask for
// help — so a closed account can always prove payment or reach N H Shop.
router.get("/me", myMerchantController);
router.get("/notifications", myNotificationsController);
router.post("/notifications/read", markNotificationsReadController);
router.get("/notification-center", notificationCenterController);
router.get("/billing", myBillingController);
router.post(
  "/payment-submissions",
  acceptPrivateUploads([{ name: "screenshot", maxCount: 1, kind: "image" }]),
  submitPaymentController
);
const ticketUploads = acceptPrivateUploads([
  { name: "images", maxCount: 3, kind: "image" },
  { name: "audio", maxCount: 1, kind: "audio" },
]);
router.get("/support-tickets", myTicketsController);
router.post("/support-tickets", ticketUploads, createTicketController);
router.get("/support-tickets/:id", myTicketController);
router.post("/support-tickets/:id/messages", ticketUploads, replyMyTicketController);

const notSuspended = requireMerchantStatus("approved", "trial", "active", "payment_due");
const operating = requireMerchantStatus("trial", "active");

router.get("/summary", notSuspended, merchantSummaryController);
router.get("/products", notSuspended, myProductsController);
router.get("/products/:id", notSuspended, myProductController);
router.post("/products", operating, upload.array("images"), createMyProductController);
// While payment is due only the stock may change; the controller enforces that.
router.patch("/products/:id", notSuspended, upload.array("images"), updateMyProductController);
router.patch("/products/:id/listing", notSuspended, setMyProductListingController);
router.get("/orders", notSuspended, myOrdersController);
router.get("/orders/:id", notSuspended, myOrderController);
router.patch("/orders/:id", notSuspended, updateMyOrderController);

module.exports = router;
