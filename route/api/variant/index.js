const express = require('express');
const { addVariantController, deleteVariantController, updateVariantController } = require('../../../controllers/variant.controller');
const router = express.Router();




router.post("/add-variant", addVariantController)
router.delete("/delete-variant/:id", deleteVariantController)
router.patch("/update-variant/:id", updateVariantController)



module.exports = router;    