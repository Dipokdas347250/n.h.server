const express = require('express');
const {
  addVariantController,
  deleteVariantController,
  updateVariantController,
  productVariantsController,
} = require('../../../controllers/variant.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();
const staffOnly = [validAuthorize, isAuthorizeRole("admin", "subadmin")];

router.get("/product/:productId", productVariantsController);
router.post("/add-variant", ...staffOnly, addVariantController);
router.delete("/delete-variant/:id", ...staffOnly, deleteVariantController);
router.patch("/update-variant/:id", ...staffOnly, updateVariantController);

module.exports = router;
