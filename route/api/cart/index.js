const express = require('express');
const { addCartController, singleCartController } = require('../../../controllers/addcart.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const router = express.Router();


router.post("/add-cart", validAuthorize, addCartController)
router.get("/singlecart/:user" , validAuthorize, singleCartController)





module.exports = router;    