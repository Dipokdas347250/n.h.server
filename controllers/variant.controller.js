const productModel = require("../models/product.model");
const variantModel = require("../models/variant.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");

exports.addVariantController = asyncHandler(async (req, res) => {
  const { size, color, sku, product } = req.body || {};
  const productData = await productModel.findById(product);
  if (!productData) return apiResponse(res, 404, messages.productNotFound);

  const variant = await variantModel.create({
    size,
    color,
    sku: sku || `${productData.sku || productData.slug}-${size || ""}-${color || ""}`,
    product,
  });

  // The first variant turns a single-variant product into a multi-variant one.
  await productModel.findByIdAndUpdate(product, {
    $push: { variant: variant._id },
    $set: { variantType: "multivariant" },
  });

  apiResponse(res, 201, messages.variantCreated, variant);
});

exports.deleteVariantController = asyncHandler(async (req, res) => {
  const variant = await variantModel.findByIdAndDelete(req.params.id);
  if (!variant) return apiResponse(res, 404, messages.variantNotFound);

  await productModel.findByIdAndUpdate(variant.product, { $pull: { variant: variant._id } });
  const product = await productModel.findById(variant.product).select("variant");
  if (product && !product.variant.length) {
    await productModel.findByIdAndUpdate(variant.product, { variantType: "singlevariant" });
  }

  apiResponse(res, 200, messages.variantDeleted);
});

exports.updateVariantController = asyncHandler(async (req, res) => {
  const { size, color, sku } = req.body || {};
  const updates = {};
  if (size !== undefined) updates.size = String(size).trim();
  if (color !== undefined) updates.color = String(color).trim();
  if (sku !== undefined) updates.sku = String(sku).trim();

  const variant = await variantModel.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!variant) return apiResponse(res, 404, messages.variantNotFound);
  apiResponse(res, 200, messages.variantUpdated, variant);
});

exports.productVariantsController = asyncHandler(async (req, res) => {
  const variants = await variantModel.find({ product: req.params.productId });
  apiResponse(res, 200, messages.productsFetched, variants);
});
