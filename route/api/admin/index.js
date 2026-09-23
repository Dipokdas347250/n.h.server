const express = require("express");
const {
  dashboardController,
  analyticsController,
  recordVisitController,
  updateOrderController,
  transactionsController,
  fraudQueueController,
} = require("../../../controllers/admin.controller");
const { adminSettingsController, updateSettingsController } = require("../../../controllers/setting.controller");
const { validAuthorize } = require("../../../middleware/validAuthorize");
const { isAuthorizeRole } = require("../../../middleware/isAuthorizeRole");

const router = express.Router();

router.post("/visits", recordVisitController);

router.use(validAuthorize, isAuthorizeRole("admin", "subadmin"));
router.get("/dashboard", dashboardController);
router.get("/analytics", analyticsController);
router.get("/transactions", transactionsController);
router.get("/fraud-queue", fraudQueueController);
router.patch("/orders/:id", updateOrderController);
router.get("/settings", adminSettingsController);
router.patch("/settings", isAuthorizeRole("admin"), updateSettingsController);

module.exports = router;
