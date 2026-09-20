const express = require('express');
const router = express.Router();
const auth = require('./auth');
const products = require('./products');
const subcategory = require('./subcategory');
const banner = require('./banner')
const subadmin = require('./subadmin')
const mainproduct = require('./mainproduct')
const variant = require('./variant')
const review = require('./review')
const cart = require('./cart')
const checkout = require('./checkout')
const admin = require('./admin')




// localhost:8080/api/v1/api/auth
router.use("/auth" , auth);
router.use("/products" , products)
router.use("/subcategory" , subcategory)
router.use("/banner" , banner)
router.use("/subadmin", subadmin )
router.use("/mainproduct",  mainproduct)
router.use("/variant",  variant)
router.use("/review", review)
router.use("/cart", cart)
router.use("/checkout", checkout)
router.use("/admin", admin)

module.exports = router;