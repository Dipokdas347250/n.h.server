const express = require('express');
const upload = require('../../../utils/upload');
const {
  productsController,
  allCategoryController,
  updateCategoryController,
  deleteCategoryController,
  singleCategoryController,
} = require('../../../controllers/product.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();
const staffOnly = [validAuthorize, isAuthorizeRole("admin", "subadmin")];

router.get("/allCategory", allCategoryController);
router.get("/allCategory/:slug", singleCategoryController);
router.post("/allproducts", ...staffOnly, upload.single('image'), productsController);
router.patch("/update-category/:id", ...staffOnly, upload.single('image'), updateCategoryController);
router.delete("/delete-category/:id", ...staffOnly, deleteCategoryController);

module.exports = router;
