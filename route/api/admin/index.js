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
const {
  sendToSteadfastController,
  bulkSendToSteadfastController,
  steadfastStatusController,
  steadfastBalanceController,
} = require("../../../controllers/courier.controller");
const { validAuthorize } = require("../../../middleware/validAuthorize");
const { isAuthorizeRole } = require("../../../middleware/isAuthorizeRole");

const router = express.Router();

router.post("/visits", recordVisitController);

router.use(validAuthorize, isAuthorizeRole("admin", "subadmin"));
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
router.patch("/settings", isAuthorizeRole("admin"), updateSettingsController);

module.exports = router;
