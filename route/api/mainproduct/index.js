const express = require('express');
const { allMainProductController, deleteProductController, allProductController, singleProductController } = require('../../../controllers/mainProduct.controller');
const upload = require('../../../utils/upload');
const router = express.Router();


router.post("/all-main-product", upload.array('images'), allMainProductController)
router.delete("/delete-product/:id", deleteProductController)
router.get("/all-product" ,allProductController )
router.get("/single-product/:slug", singleProductController)





module.exports = router;    