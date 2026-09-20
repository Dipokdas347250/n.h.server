const express = require('express');
const { addSubcategory, updateSubcategory, deleteSubcategory, allSubcategory } = require('../../../controllers/subcategory');
const router = express.Router();


router.post("/add-subcategory", addSubcategory );
router.patch("/update-subcategory/:id",updateSubcategory)
router.delete("/delete-subcategory/:id",deleteSubcategory)
router.get("/all-subcategory", allSubcategory)




module.exports = router;    