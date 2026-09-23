const express = require('express');
const {
  allMainProductController,
  updateProductController,
  deleteProductController,
  allProductController,
  singleProductController,
  productByIdController,
  topSellingProductController,
  categoryProductsController,
} = require('../../../controllers/mainProduct.controller');
const upload = require('../../../utils/upload');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();
const staffOnly = [validAuthorize, isAuthorizeRole("admin", "subadmin")];

router.get("/all-product", allProductController);
router.get("/top-selling", topSellingProductController);
router.get("/category/:slug", categoryProductsController);
router.get("/single-product/:slug", singleProductController);
router.get("/product/:id", productByIdController);

router.post("/all-main-product", ...staffOnly, upload.array('images'), allMainProductController);
router.patch("/update-product/:id", ...staffOnly, upload.array('images'), updateProductController);
router.delete("/delete-product/:id", ...staffOnly, deleteProductController);

module.exports = router;
