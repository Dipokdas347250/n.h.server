
const express = require('express');
const { applySubadminController, approveSubadminController } = require('../../../controllers/subadmin.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');
const router = express.Router();


router.post("/apply-subadmin", applySubadminController)
router.post("/approve-subadmin/:id", validAuthorize, isAuthorizeRole("admin"), approveSubadminController)


module.exports = router;    