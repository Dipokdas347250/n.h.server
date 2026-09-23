const express = require('express');
const {
  addCartController,
  singleCartController,
  removeCartController,
  updateCartController,
  clearCartController,
} = require('../../../controllers/addcart.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');

const router = express.Router();

router.use(validAuthorize);
router.post("/add-cart", addCartController);
router.get("/my-cart", singleCartController);
// Kept for older clients that still pass the user id in the path.
router.get("/singlecart/:user", singleCartController);
router.patch("/update-cart", updateCartController);
router.delete("/remove-cart", removeCartController);
router.delete("/clear-cart", clearCartController);

module.exports = router;
