const express = require('express');
const { addBannerController, allBannerController, updateBannerController, deleteBannerController } = require('../../../controllers/banner.controller');
const upload = require('../../../utils/upload');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');
const router = express.Router();

router.post("/add-banner",
    validAuthorize,
    isAuthorizeRole("admin"), 
    upload.single("image"), addBannerController)
router.get("/all-banner", allBannerController)
router.patch("/update-banner", updateBannerController)
router.delete("/delete-banner/:id",deleteBannerController)



module.exports = router;    