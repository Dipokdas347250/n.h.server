const cartModel = require("../models/cart.model");
const productModel = require("../models/product.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");
const { publicProductFilter } = require("../utils/merchant");

const getProductPrice = (product) =>
  Number(product?.discountPrice ?? product?.diccountprice ?? product?.price ?? 0);

/** Matches a cart line, treating "no variant" as its own distinct line. */
const lineQuery = (user, product, variant) => ({
  user,
  product,
  ...(variant ? { variant } : { $or: [{ variant: null }, { variant: { $exists: false } }] }),
});

exports.addCartController = asyncHandler(async (req, res) => {
  const { variant, quntity, product } = req.body || {};
  const user = req.session.user._id;

  // Only products the storefront shows can go in a cart.
  const productData = await productModel.findOne({ _id: product, ...(await publicProductFilter()) });
  if (!productData) return apiResponse(res, 404, messages.productNotFound);
  if (productData.variantType === "multivariant" && !variant) {
    return apiResponse(res, 400, messages.variantRequired);
  }

  const quantity = Math.max(Math.trunc(Number(quntity)) || 1, 1);
  const unitPrice = getProductPrice(productData);

  const existing = await cartModel.findOne(lineQuery(user, product, variant));
  if (existing) {
    existing.quntity = (existing.quntity || 1) + quantity;
    existing.totalprice = unitPrice * existing.quntity;
    await existing.save();
    return apiResponse(res, 200, messages.cartUpdated, existing);
  }

  const line = await cartModel.create({
    user,
    product,
    variant: variant || undefined,
    quntity: quantity,
    totalprice: unitPrice * quantity,
  });
  return apiResponse(res, 201, messages.cartAdded, line);
});

exports.singleCartController = asyncHandler(async (req, res) => {
  // A customer may only read their own cart.
  const cart = await cartModel
    .find({ user: req.session.user._id })
    .populate({ path: "product", select: "title slug price discountPrice diccountprice image variantType", match: await publicProductFilter() })
    .populate({ path: "variant" })
    .select("-updatedAt -createdAt");

  // Lines whose product is hidden (e.g. its merchant was suspended) are kept,
  // and come back by themselves when the product is visible again.
  apiResponse(res, 200, messages.cartFetched, cart.filter((line) => line.product));
});

exports.removeCartController = asyncHandler(async (req, res) => {
  const { product, variant } = req.body || {};
  const removed = await cartModel.findOneAndDelete(lineQuery(req.session.user._id, product, variant));
  if (!removed) return apiResponse(res, 404, messages.cartItemNotFound);
  apiResponse(res, 200, messages.cartRemoved);
});

exports.updateCartController = asyncHandler(async (req, res) => {
  const { product, variant, quntity } = req.body || {};
  const quantity = Math.trunc(Number(quntity));
  if (!Number.isInteger(quantity) || quantity < 1) return apiResponse(res, 400, messages.quantityInvalid);

  const line = await cartModel
    .findOne(lineQuery(req.session.user._id, product, variant))
    .populate("product", "price discountPrice diccountprice");
  if (!line) return apiResponse(res, 404, messages.cartItemNotFound);

  line.quntity = quantity;
  line.totalprice = getProductPrice(line.product) * quantity;
  await line.save();
  apiResponse(res, 200, messages.cartUpdated, line);
});

/** Clears the whole cart, used after a successful checkout from another device. */
exports.clearCartController = asyncHandler(async (req, res) => {
  await cartModel.deleteMany({ user: req.session.user._id });
  apiResponse(res, 200, messages.cartRemoved);
});
