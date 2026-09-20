const express = require("express");
const { dashboardController, analyticsController, recordVisitController, updateOrderController, transactionsController } = require("../../../controllers/admin.controller");
const { validAuthorize } = require("../../../middleware/validAuthorize");
const { isAuthorizeRole } = require("../../../middleware/isAuthorizeRole");

const router = express.Router();

router.post("/visits", recordVisitController);

router.use(validAuthorize, isAuthorizeRole("admin", "subadmin"));
router.get("/dashboard", dashboardController);
router.get("/analytics", analyticsController);
router.patch("/orders/:id", updateOrderController);
router.get("/transactions", transactionsController);

module.exports = router;
