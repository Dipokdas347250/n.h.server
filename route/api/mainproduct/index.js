const express = require('express');
const { allMainProductController, updateProductController, deleteProductController, allProductController, singleProductController, topSellingProductController, categoryProductsController } = require('../../../controllers/mainProduct.controller');
const upload = require('../../../utils/upload');
const router = express.Router();


router.post("/all-main-product", upload.array('images'), allMainProductController)
router.patch("/update-product/:id", upload.array('images'), updateProductController)
router.delete("/delete-product/:id", deleteProductController)
router.get("/all-product" ,allProductController )
router.get("/top-selling", topSellingProductController)
router.get("/category/:slug", categoryProductsController)
router.get("/single-product/:slug", singleProductController)





module.exports = router;    