const bannerModel = require("../models/banner.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const cloudinary = require("../utils/cloudinary");
const path = require("path");
const fs = require("fs");

exports.addBannerController = asyncHandler(async (req, res, next) => {
    if (!req.file) return apiResponse(res, 400, "banner image is required");
    let { filename } = req.file;
    let { url } = req.body;
    const uploadResult = await cloudinary.uploader
        .upload(
            req.file.path
        )
        .catch((error) => {
            console.log(error);
        });
    let imagepath = path.join(__dirname, "../uploads")
    fs.unlink(`${imagepath}/${filename}`, async (err) => {
        if (err) {
            apiResponse(res, 500, err.message);
        }
    })

    let banner = new bannerModel({
        image: uploadResult.url,
        url,
        uploadResultId: uploadResult.public_id
    })

    await banner.save()
    apiResponse(res, 201, "banner created successffull", banner)

});

exports.allBannerController = asyncHandler(async (req, res, next) => {
    let banner = await bannerModel.find({})
    apiResponse(res, 200, "all banner fatch successfull", banner)

});

exports.updateBannerController = asyncHandler(async (req, res, next) => {
    const { id, url } = req.body;
    const banner = await bannerModel.findByIdAndUpdate(id, { url }, { new: true });
    if (!banner) return apiResponse(res, 404, "banner not found");
    apiResponse(res, 200, "banner updated successfully", banner);
});

exports.deleteBannerController = asyncHandler(async (req, res, next) => {
    let { id } = req.params;
    let bannerDelete = await bannerModel.findOneAndDelete({ _id: id })
    if (!bannerDelete) return apiResponse(res, 404, "banner not found");
    if (bannerDelete.uploadResultId) await cloudinary.uploader.destroy(bannerDelete.uploadResultId)

    apiResponse(res, 200, "banner deleted successfully");
})