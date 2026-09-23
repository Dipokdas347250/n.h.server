const reviewModel = require("../models/review.model");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/checkout.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");

exports.addreviewContaroller = asyncHandler(async (req, res) => {
  const user = req.session?.user?._id;
  if (!user) return apiResponse(res, 401, messages.reviewLoginRequired);

  const { product, comment, rating } = req.body || {};
  const score = Number(rating);
  if (!product || !comment?.trim() || !Number.isFinite(score) || score < 1 || score > 5) {
    return apiResponse(res, 400, messages.reviewInvalid);
  }
  if (!(await productModel.exists({ _id: product }))) return apiResponse(res, 404, messages.productNotFound);

  // A review counts as verified when the customer actually received the product.
  const purchased = await orderModel.exists({
    user,
    "items.product": product,
    deliveryStatus: "deliverd",
  });

  const created = await reviewModel.create({
    user,
    product,
    comment: comment.trim(),
    rating: Math.round(score),
    verifiedPurchase: Boolean(purchased),
  });

  await Promise.all([
    userModel.findByIdAndUpdate(user, { $push: { review: created._id } }),
    productModel.findByIdAndUpdate(product, { $push: { review: created._id } }),
  ]);

  const review = await reviewModel.findById(created._id).populate("user", "fullname photo");
  apiResponse(res, 201, messages.reviewCreated, review);
});

exports.productReviewsController = asyncHandler(async (req, res) => {
  const reviews = await reviewModel
    .find({ product: req.params.productId })
    .sort({ createdAt: -1 })
    .populate("user", "fullname photo");
  apiResponse(res, 200, messages.reviewsFetched, reviews);
});

exports.allReviewsController = asyncHandler(async (req, res) => {
  const reviews = await reviewModel
    .find({ rating: { $gte: 4 } })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("user", "fullname photo")
    .populate("product", "title");
  apiResponse(res, 200, messages.reviewsFetched, reviews);
});
