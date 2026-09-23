const express = require("express");
const { publicSettingsController } = require("../../../controllers/setting.controller");

const router = express.Router();

// Delivery zones and charges the checkout page needs before anyone signs in.
router.get("/", publicSettingsController);
router.get("/delivery", publicSettingsController);

module.exports = router;
