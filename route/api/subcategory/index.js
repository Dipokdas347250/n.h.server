const express = require('express');
const { addSubcategory, updateSubcategory, deleteSubcategory, allSubcategory } = require('../../../controllers/subcategory');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();
const staffOnly = [validAuthorize, isAuthorizeRole("admin", "subadmin")];

router.get("/all-subcategory", allSubcategory);
router.post("/add-subcategory", ...staffOnly, addSubcategory);
router.patch("/update-subcategory/:id", ...staffOnly, updateSubcategory);
router.delete("/delete-subcategory/:id", ...staffOnly, deleteSubcategory);

module.exports = router;
