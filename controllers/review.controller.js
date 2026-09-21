const reviewModel = require("../models/review.model");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

exports.addreviewContaroller = asyncHandler(async(req , res)=>{
    const user = req.session?.user?._id;
    const { product, comment, rating } = req.body;
    if (!user) return apiResponse(res, 401, "Please login before reviewing");
    if (!product || !comment?.trim() || Number(rating) < 1 || Number(rating) > 5) {
        return apiResponse(res, 400, "Product, comment, and a rating from 1 to 5 are required");
    }
    let addreview = new reviewModel({
        user,
        comment,
        rating: Number(rating),
        product
    })
    await addreview.save()
    await userModel.findOneAndUpdate({_id:user},{$push:{review:addreview._id}})
    await productModel.findByIdAndUpdate(product, {$push: { review: addreview._id }})
    const review = await reviewModel.findById(addreview._id).populate("user", "fullname photo");
    apiResponse(res , 201 , "review submitted successfully" ,review)
})

exports.productReviewsController = asyncHandler(async (req, res) => {
    const reviews = await reviewModel.find({ product: req.params.productId })
        .sort({ createdAt: -1 })
        .populate("user", "fullname photo");
    apiResponse(res, 200, "product reviews fetched successfully", reviews);
});

exports.allReviewsController = asyncHandler(async (req, res) => {
    const reviews = await reviewModel.find({})
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("user", "fullname photo")
        .populate("product", "title");
    apiResponse(res, 200, "reviews fetched successfully", reviews);
});