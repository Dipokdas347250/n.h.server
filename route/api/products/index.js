const express = require('express');
const upload = require('../../../utils/upload');

const { productsController, allCategoryController, updateCategoryController, deleteCategoryController, singleCategoryController } = require('../../../controllers/product.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();

//   CATEGORY ROUTES

router.post("/allproducts" ,
    validAuthorize,
    isAuthorizeRole("admin","subadmin"),
    upload.single('image'),productsController);
router.patch("/update-category/:id" ,
    validAuthorize,
    isAuthorizeRole("admin","subadmin"),
    upload.single('image') , 
    updateCategoryController);
router.get("/allCategory", allCategoryController);
router.get("/allCategory/:slug", singleCategoryController);
router.delete("/delete-category/:id" ,
    validAuthorize,
    isAuthorizeRole("admin","subadmin"),
     deleteCategoryController)


module.exports = router;    