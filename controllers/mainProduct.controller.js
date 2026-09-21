const productModel = require("../models/product.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const slugify = require('slugify')
const path = require("path");
const fs = require("fs");
const categoryModel = require("../models/categore.model");
const variantModel = require("../models/variant.model");
const cloudinary = require("../utils/cloudinary");

const uploadProductImages = async (files = []) => Promise.all(files.map(async (file) => {
  const result = await cloudinary.uploader.upload(file.path, { folder: "nh-shop/products" });
  fs.unlink(file.path, () => {});
  return result.secure_url;
}));



exports.allMainProductController = asyncHandler(async (req, res) => {
  const category = await categoryModel.findById(req.body.category);
  if (!category) return apiResponse(res, 400, "A valid category is required");

  const filenames = await uploadProductImages(req.files);
  let slug = slugify(req.body.title, {
    replacement: '-',
    remove: undefined,
    lower: true,
    trim: true
  })
  let variantInput = [];
  try {
    variantInput = JSON.parse(req.body.variants || "[]");
  } catch {
    return apiResponse(res, 400, "Invalid variants format");
  }

  let products = new productModel({
    ...req.body,
    category: category._id,
    variantType: variantInput.length ? "multivariant" : "singlevariant",
    image: filenames,
    slug
  })
  await products.save();
  if (variantInput.length) {
    const variants = await variantModel.insertMany(variantInput.map((variant) => ({
      size: variant.size,
      color: variant.color,
      sku: variant.sku || `${products.sku || products.slug}-${variant.size}-${variant.color}`,
      product: products._id,
    })));
    products.variant = variants.map((variant) => variant._id);
    await products.save();
  }
  apiResponse(res, 201, "Main Product created successfully", products);

})


exports.deleteProductController = asyncHandler(async (req, res) => {
  let { id } = req.params;
  let deleteCategory = await productModel.findOne({ _id: id });
  if (!deleteCategory) {
    apiResponse(res, 404, "product not found")
  } else {
    deleteCategory.image.forEach((img) => {
      let filepath = img.split("/")
      let imagepath = filepath[filepath.length - 1]
      let oldpath = path.join(__dirname, "../uploads")
      fs.unlink(`${oldpath}/${imagepath}`, () => {})
    })
    await productModel.findOneAndDelete({ _id: id })
    apiResponse(res, 200, "product deleted successfully")
  }
})

exports.updateProductController = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);
  if (!product) return apiResponse(res, 404, "product not found");

  const { title, description, price, sku } = req.body;
  if (title !== undefined) {
    product.title = title;
    product.slug = slugify(title, { replacement: "-", lower: true, trim: true });
  }
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = price;
  if (sku !== undefined) product.sku = sku;
  if (req.files?.length) product.image = await uploadProductImages(req.files);

  await product.save();
  apiResponse(res, 200, "product updated successfully", product);
});

exports.allProductController = asyncHandler(async(req,res)=>{
  let products = await productModel.find({}).populate({
    path: "category",
    select: "_id name slug"
  }).populate({
    path:"variant",
    select: "size color sku"
  }).populate({
    path: "review",
    select: "comment rating createdAt user",
    populate: { path: "user", select: "fullname photo" }
  })
  apiResponse(res,200,"all product", products)
})

exports.topSellingProductController = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 8, 1), 24);
  const products = await require("./admin.controller").getTopSellingProducts(limit);
  apiResponse(res, 200, "top selling products", products);
});

exports.categoryProductsController = asyncHandler(async (req, res) => {
  const category = await categoryModel.findOne({ slug: req.params.slug }).select("_id name slug image discount");
  if (!category) return apiResponse(res, 404, "category not found");

  const products = await productModel.find({ category: category._id }).populate({
    path: "category",
    select: "_id name slug"
  }).populate({
    path: "variant",
    select: "size color sku"
  }).populate({
    path: "review",
    select: "comment rating createdAt user",
    populate: { path: "user", select: "fullname photo" }
  });
  apiResponse(res, 200, "category products", { category, products });
});
exports.singleProductController = asyncHandler(async(req,res)=>{
  let { slug } = req.params;
  let products = await productModel.findOne({slug}).populate({
    path:"variant",
    select: "size color sku"
  }).populate({
    path: "review",
    select: "comment rating createdAt user",
    populate: { path: "user", select: "fullname photo" }
  })
  if(!products){
    apiResponse(res,404,"product not found")
  }else{

    apiResponse(res,200,"single product", products)
  }
})