const express = require('express');
const {
  applySubadminController,
  approveSubadminController,
  allSubadminController,
} = require('../../../controllers/subadmin.controller');
const { validAuthorize } = require('../../../middleware/validAuthorize');
const { isAuthorizeRole } = require('../../../middleware/isAuthorizeRole');

const router = express.Router();

router.post("/apply-subadmin", validAuthorize, applySubadminController);
router.get("/all-subadmin", validAuthorize, isAuthorizeRole("admin"), allSubadminController);
router.post("/approve-subadmin/:id", validAuthorize, isAuthorizeRole("admin"), approveSubadminController);

module.exports = router;
