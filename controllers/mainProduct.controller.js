const fs = require("fs");
const slugify = require("slugify");
const productModel = require("../models/product.model");
const categoryModel = require("../models/categore.model");
const variantModel = require("../models/variant.model");
const reviewModel = require("../models/review.model");
const cloudinary = require("../utils/cloudinary");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");

/** Pushes every uploaded image to Cloudinary and removes the local temp file. */
const uploadProductImages = async (files = []) =>
  Promise.all(files.map(async (file) => {
    const result = await cloudinary.uploader.upload(file.path, { folder: "nh-shop/products" });
    fs.unlink(file.path, () => {});
    return { url: result.secure_url || result.url, publicId: result.public_id };
  }));

/** Slug that stays unique even when two products share a title. */
const buildSlug = async (title, ignoreId) => {
  const base = slugify(title, { replacement: "-", lower: true, trim: true }) || "product";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await productModel.findOne({ slug: candidate }).select("_id");
    if (!clash || String(clash._id) === String(ignoreId)) return candidate;
  }
  return `${base}-${Date.now()}`;
};

const POPULATE = [
  { path: "category", select: "_id name slug" },
  { path: "variant", select: "size color sku" },
  { path: "review", select: "comment rating createdAt user verifiedPurchase", populate: { path: "user", select: "fullname photo" } },
];

/** Average star rating, attached so the storefront does not recompute it. */
const withRating = (product) => {
  const plain = typeof product.toObject === "function" ? product.toObject() : product;
  const reviews = plain.review || [];
  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  return { ...plain, rating: reviews.length ? Number((total / reviews.length).toFixed(1)) : 0 };
};

exports.allMainProductController = asyncHandler(async (req, res) => {
  const category = await categoryModel.findById(req.body.category);
  if (!category) return apiResponse(res, 400, messages.categoryRequired);

  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const price = Number(req.body.price);
  const discountPrice =
    req.body.discountPrice === "" || req.body.discountPrice === undefined ? undefined : Number(req.body.discountPrice);

  if (!title || !description) return apiResponse(res, 400, messages.titleDescriptionRequired);
  if (!Number.isFinite(price) || price < 0) return apiResponse(res, 400, messages.priceRequired);
  if (discountPrice !== undefined && (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice > price)) {
    return apiResponse(res, 400, messages.discountRange);
  }

  let variantInput = [];
  try {
    variantInput = JSON.parse(req.body.variants || "[]");
    if (!Array.isArray(variantInput)) throw new Error("variants must be an array");
  } catch {
    return apiResponse(res, 400, messages.invalidVariants);
  }

  const uploaded = await uploadProductImages(req.files);
  const slug = await buildSlug(title);

  const product = new productModel({
    title,
    description,
    price,
    discountPrice,
    offer: String(req.body.offer || "").trim(),
    sku: String(req.body.sku || "").trim(),
    category: category._id,
    variantType: variantInput.length ? "multivariant" : "singlevariant",
    image: uploaded.map((file) => file.url),
    imageIds: uploaded.map((file) => file.publicId),
    slug,
  });
  await product.save();

  if (variantInput.length) {
    const variants = await variantModel.insertMany(variantInput.map((variant) => ({
      size: variant.size,
      color: variant.color,
      sku: variant.sku || `${product.sku || product.slug}-${variant.size}-${variant.color}`,
      product: product._id,
    })));
    product.variant = variants.map((variant) => variant._id);
    await product.save();
  }

  apiResponse(res, 201, messages.productCreated, product);
});

exports.updateProductController = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);
  if (!product) return apiResponse(res, 404, messages.productNotFound);

  const { title, description, price, discountPrice, offer, sku, category } = req.body;

  if (title !== undefined && String(title).trim()) {
    product.title = String(title).trim();
    product.slug = await buildSlug(product.title, product._id);
  }
  if (description !== undefined) product.description = String(description).trim();
  if (price !== undefined) {
    const parsed = Number(price);
    if (!Number.isFinite(parsed) || parsed < 0) return apiResponse(res, 400, messages.priceRequired);
    product.price = parsed;
  }
  if (discountPrice !== undefined) {
    const parsed = discountPrice === "" ? undefined : Number(discountPrice);
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed < 0 || parsed > product.price)) {
      return apiResponse(res, 400, messages.discountRange);
    }
    product.discountPrice = parsed;
  }
  if (offer !== undefined) product.offer = String(offer).trim();
  if (sku !== undefined) product.sku = String(sku).trim();
  if (category) {
    if (!(await categoryModel.exists({ _id: category }))) return apiResponse(res, 400, messages.categoryRequired);
    product.category = category;
  }

  if (req.files?.length) {
    // Replace the gallery, cleaning up the images the product no longer uses.
    await Promise.all((product.imageIds || []).map((publicId) => cloudinary.uploader.destroy(publicId).catch(() => {})));
    const uploaded = await uploadProductImages(req.files);
    product.image = uploaded.map((file) => file.url);
    product.imageIds = uploaded.map((file) => file.publicId);
  }

  await product.save();
  apiResponse(res, 200, messages.productUpdated, product);
});

exports.deleteProductController = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);
  if (!product) return apiResponse(res, 404, messages.productNotFound);

  await Promise.all((product.imageIds || []).map((publicId) => cloudinary.uploader.destroy(publicId).catch(() => {})));
  await Promise.all([
    variantModel.deleteMany({ product: product._id }),
    reviewModel.deleteMany({ product: product._id }),
  ]);
  await product.deleteOne();

  apiResponse(res, 200, messages.productDeleted);
});

exports.allProductController = asyncHandler(async (req, res) => {
  const products = await productModel.find({}).sort({ createdAt: -1 }).populate(POPULATE);
  apiResponse(res, 200, messages.productsFetched, products.map(withRating));
});

exports.topSellingProductController = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 24);
  const products = await require("./admin.controller").getTopSellingProducts(limit);
  apiResponse(res, 200, messages.productsFetched, products);
});

exports.categoryProductsController = asyncHandler(async (req, res) => {
  const category = await categoryModel.findOne({ slug: req.params.slug }).select("_id name slug image discount");
  if (!category) return apiResponse(res, 404, messages.categoryNotFound);

  const products = await productModel.find({ category: category._id }).sort({ createdAt: -1 }).populate(POPULATE);
  apiResponse(res, 200, messages.productsFetched, { category, products: products.map(withRating) });
});

exports.singleProductController = asyncHandler(async (req, res) => {
  const product = await productModel.findOne({ slug: req.params.slug }).populate(POPULATE);
  if (!product) return apiResponse(res, 404, messages.productNotFound);
  apiResponse(res, 200, messages.productsFetched, withRating(product));
});

/** Product detail by database id, used by links that carry the id in the URL. */
exports.productByIdController = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id).populate(POPULATE);
  if (!product) return apiResponse(res, 404, messages.productNotFound);
  apiResponse(res, 200, messages.productsFetched, withRating(product));
});
