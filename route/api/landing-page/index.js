const express = require("express");
const {
  publicLandingPageController,
  updateLandingPageController,
  createLandingOrderController,
  allLandingOrdersController,
  updateLandingOrderController,
} = require("../../../controllers/landingPage.controller");
const upload = require("../../../utils/upload");
const { validAuthorize } = require("../../../middleware/validAuthorize");
const { isAuthorizeRole } = require("../../../middleware/isAuthorizeRole");

const router = express.Router();
const adminOnly = [validAuthorize, isAuthorizeRole("admin")];

router.get("/", publicLandingPageController);
router.post("/orders", createLandingOrderController);
router.patch(
  "/",
  ...adminOnly,
  upload.fields([
    { name: "bannerImage", maxCount: 1 },
    { name: "bannerImages", maxCount: 10 },
    { name: "productImage0", maxCount: 1 },
    { name: "productImage1", maxCount: 1 },
    { name: "productImage2", maxCount: 1 },
  ]),
  updateLandingPageController
);
router.get("/orders", ...adminOnly, allLandingOrdersController);
router.patch("/orders/:id", ...adminOnly, updateLandingOrderController);

module.exports = router;
