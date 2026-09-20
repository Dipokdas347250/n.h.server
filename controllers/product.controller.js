const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const categoreModel = require("../models/categore.model");
const path = require("path");
const fs = require("fs");
const slugify = require('slugify');
const cloudinary = require("../utils/cloudinary");


exports.productsController = asyncHandler(async (req, res, next) => {
    let { name, discount, subcategories } = req.body;

    
    if (!req.file) return apiResponse(res, 400, "category image is required");
    let { filename } = req.file;

    console.log(req.body);
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


    let slug = slugify(name, {
        replacement: '-',
        remove: undefined,
        lower: true,
        trim: true
    })


    let categoreys = new categoreModel({
        name, discount, subcategories, image: uploadResult.url, slug, uploadResultId: uploadResult.public_id

    })

    await categoreys.save();
    console.log(categoreys);
    apiResponse(res, 200, "Product created successfully", categoreys);
});

exports.updateCategoryController = asyncHandler(async (req, res, next) => {
    let { id } = req.params;
    let { name, discount } = req.body;
    let filename = req.file?.filename;
    if (req.file) {
        let categoryImage = await categoreModel.findOne({ _id: id })
        let filepath = categoryImage.image.split("/")
        let imagepath = filepath[filepath.length - 1]

        let oldpath = path.join(__dirname, "../uploads")
        fs.unlink(`${oldpath}/${imagepath}`, async (err) => {
            if (err) {
                apiResponse(res, 500, err.message);

            } else {
                let image = `${process.env.SERVER_URL}/${filename}`;
                categoryImage.image = image;
                await categoryImage.save();
                apiResponse(res, 200, "category updateed")

            }
        })


    } else {
        let update = await categoreModel.findOneAndUpdate({ _id: id }, { name, discount }, { new: true })
        apiResponse(res, 200, "category updateed", update)
    }

});

exports.deleteCategoryController = asyncHandler(async (req, res, next) => {
    let { id } = req.params;
    let categoryDelete = await categoreModel.findOneAndDelete({ _id: id })
    if (!categoryDelete) return apiResponse(res, 404, "category not found");
    if (categoryDelete.uploadResultId) await cloudinary.uploader.destroy(categoryDelete.uploadResultId)

    apiResponse(res, 200, "category deleted successfully");

});
exports.allCategoryController = asyncHandler(async (req, res, next) => {
    let categories = await categoreModel.find({}).populate({ path: "subcategories", select: "_id name" }).select("_id name image slug discount subcategories");
    apiResponse(res, 200, "All categories fetched successfully", categories);

});

exports.singleCategoryController = asyncHandler(async (req, res, next) => {
    let { slug } = req.params;
    let categorySingle = await categoreModel.findOne({ slug });

    if (categorySingle) {
        apiResponse(res, 200, "Slug categories fetched successfully", categorySingle);

    } else {
        apiResponse(res, 404, "Slug categories fetched not found");

    }


})
