const express = require('express');
const { addreviewContaroller, productReviewsController, allReviewsController } = require('../../../controllers/review.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');

const router = express.Router();

router.get("/product/:productId", productReviewsController);
router.get("/all", allReviewsController);
router.post("/add-review", validAuthorize, addreviewContaroller);

module.exports = router;
