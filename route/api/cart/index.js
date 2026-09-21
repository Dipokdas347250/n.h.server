const express = require('express');
const { addCartController, singleCartController, removeCartController, updateCartController } = require('../../../controllers/addcart.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const router = express.Router();


router.post("/add-cart", validAuthorize, addCartController)
router.get("/singlecart/:user" , validAuthorize, singleCartController)
router.patch("/update-cart", validAuthorize, updateCartController)
router.delete("/remove-cart", validAuthorize, removeCartController)





module.exports = router;    