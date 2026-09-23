const express = require('express');
const {
  addBannerController,
  allBannerController,
  updateBannerController,
  deleteBannerController,
} = require('../../../controllers/banner.controller');
const upload = require('../../../utils/upload');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();
const staffOnly = [validAuthorize, isAuthorizeRole("admin", "subadmin")];

router.get("/all-banner", allBannerController);
router.post("/add-banner", ...staffOnly, upload.single("image"), addBannerController);
router.patch("/update-banner/:id", ...staffOnly, upload.single("image"), updateBannerController);
// Older dashboard builds send the id in the body instead of the path.
router.patch("/update-banner", ...staffOnly, upload.single("image"), updateBannerController);
router.delete("/delete-banner/:id", ...staffOnly, deleteBannerController);

module.exports = router;
