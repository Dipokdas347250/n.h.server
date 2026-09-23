const multer = require("multer");
const { apiResponse } = require("./apiResponse");
const messages = require("./messages");

/** Last stop for anything thrown in a controller: one bilingual JSON shape. */
exports.globalerrorhandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.name === "ValidationError") {
    const first = Object.values(error.errors)[0];
    return apiResponse(res, 400, first?.message || messages.somethingWentWrong.en);
  }

  if (error.name === "CastError") {
    return apiResponse(res, 400, { en: `Invalid value for ${error.path}`, bn: `${error.path} এর মানটি সঠিক নয়` });
  }

  // Duplicate key, e.g. registering an email that already exists.
  if (error.code === 11000) {
    return apiResponse(res, 409, messages.emailInUse);
  }

  if (error instanceof multer.MulterError) {
    return apiResponse(res, 400, error.code === "LIMIT_FILE_SIZE" ? messages.fileTooLarge : messages.invalidFileType);
  }

  console.error("Unhandled error:", error);
  return apiResponse(res, error.statusCode || 500, error.message || messages.somethingWentWrong);
};
