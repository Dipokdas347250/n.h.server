const express = require('express');
const { addreviewContaroller } = require('../../../controllers/review.controller');
const router = express.Router();



router.post("/add-review",addreviewContaroller)




module.exports = router;    