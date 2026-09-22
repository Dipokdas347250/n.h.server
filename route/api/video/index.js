const express = require("express");
const {
  addVideoController,
  allVideoController,
  allVideoAdminController,
  updateVideoController,
  deleteVideoController,
} = require("../../../controllers/video.controller");
const upload = require("../../../utils/upload");
const { validAuthorize } = require("../../../middleware/validAuthorize");
const { isAuthorizeRole } = require("../../../middleware/isAuthorizeRole");

const router = express.Router();
const adminOnly = [validAuthorize, isAuthorizeRole("admin")];

router.get("/all-video", allVideoController);
router.get("/admin/all-video", ...adminOnly, allVideoAdminController);
router.post("/add-video", ...adminOnly, upload.videoUpload.single("video"), addVideoController);
router.patch("/update-video/:id", ...adminOnly, updateVideoController);
router.delete("/delete-video/:id", ...adminOnly, deleteVideoController);

module.exports = router;
