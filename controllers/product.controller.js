const fs = require("fs");
const slugify = require("slugify");
const categoreModel = require("../models/categore.model");
const subcategorieModel = require("../models/subcategorie.model");
const cloudinary = require("../utils/cloudinary");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");

/** Category slug that stays unique when two categories share a name. */
const buildSlug = async (name, ignoreId) => {
  const base = slugify(name, { replacement: "-", lower: true, trim: true }) || "category";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await categoreModel.findOne({ slug: candidate }).select("_id");
    if (!clash || String(clash._id) === String(ignoreId)) return candidate;
  }
  return `${base}-${Date.now()}`;
};

exports.productsController = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return apiResponse(res, 400, messages.titleRequired);
  if (!req.file) return apiResponse(res, 400, messages.categoryImageRequired);

  const uploadResult = await cloudinary.uploader.upload(req.file.path, { folder: "nh-shop/categories" });
  fs.unlink(req.file.path, () => {});

  const category = await categoreModel.create({
    name,
    discount: Math.max(Number(req.body.discount) || 0, 0),
    image: uploadResult.secure_url || uploadResult.url,
    uploadResultId: uploadResult.public_id,
    slug: await buildSlug(name),
  });

  apiResponse(res, 201, messages.categoryCreated, category);
});

exports.updateCategoryController = asyncHandler(async (req, res) => {
  const category = await categoreModel.findById(req.params.id);
  if (!category) return apiResponse(res, 404, messages.categoryNotFound);

  if (req.body.name !== undefined && String(req.body.name).trim()) {
    category.name = String(req.body.name).trim();
    category.slug = await buildSlug(category.name, category._id);
  }
  if (req.body.discount !== undefined) category.discount = Math.max(Number(req.body.discount) || 0, 0);

  if (req.file) {
    // Swap the Cloudinary asset rather than pointing at a local upload path.
    if (category.uploadResultId) await cloudinary.uploader.destroy(category.uploadResultId).catch(() => {});
    const uploadResult = await cloudinary.uploader.upload(req.file.path, { folder: "nh-shop/categories" });
    fs.unlink(req.file.path, () => {});
    category.image = uploadResult.secure_url || uploadResult.url;
    category.uploadResultId = uploadResult.public_id;
  }

  await category.save();
  apiResponse(res, 200, messages.categoryUpdated, category);
});

exports.deleteCategoryController = asyncHandler(async (req, res) => {
  const category = await categoreModel.findByIdAndDelete(req.params.id);
  if (!category) return apiResponse(res, 404, messages.categoryNotFound);

  if (category.uploadResultId) await cloudinary.uploader.destroy(category.uploadResultId).catch(() => {});
  await subcategorieModel.deleteMany({ category: category._id });

  apiResponse(res, 200, messages.categoryDeleted);
});

exports.allCategoryController = asyncHandler(async (req, res) => {
  const categories = await categoreModel
    .find({})
    .sort({ name: 1 })
    .populate({ path: "subcategories", select: "_id name" })
    .select("_id name image slug discount subcategories");
  apiResponse(res, 200, messages.categoriesFetched, categories);
});

exports.singleCategoryController = asyncHandler(async (req, res) => {
  const category = await categoreModel.findOne({ slug: req.params.slug }).populate({ path: "subcategories", select: "_id name" });
  if (!category) return apiResponse(res, 404, messages.categoryNotFound);
  apiResponse(res, 200, messages.categoriesFetched, category);
});
