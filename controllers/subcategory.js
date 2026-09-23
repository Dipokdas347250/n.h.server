const categoreModel = require("../models/categore.model");
const subcategorieModel = require("../models/subcategorie.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const messages = require("../utils/messages");

exports.addSubcategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const { category } = req.body || {};
  if (!name) return apiResponse(res, 400, messages.titleRequired);
  if (!(await categoreModel.exists({ _id: category }))) return apiResponse(res, 400, messages.categoryRequired);

  const subcategory = await subcategorieModel.create({ name, category });
  await categoreModel.findByIdAndUpdate(category, { $addToSet: { subcategories: subcategory._id } });

  apiResponse(res, 201, messages.subcategoryCreated, subcategory);
});

exports.updateSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await subcategorieModel.findById(req.params.id);
  if (!subcategory) return apiResponse(res, 404, messages.subcategoryNotFound);

  const { name, category } = req.body || {};
  if (name !== undefined && String(name).trim()) subcategory.name = String(name).trim();

  if (category && String(category) !== String(subcategory.category)) {
    if (!(await categoreModel.exists({ _id: category }))) return apiResponse(res, 400, messages.categoryRequired);
    // Move it: detach from the old parent before attaching to the new one.
    await categoreModel.findByIdAndUpdate(subcategory.category, { $pull: { subcategories: subcategory._id } });
    await categoreModel.findByIdAndUpdate(category, { $addToSet: { subcategories: subcategory._id } });
    subcategory.category = category;
  }

  await subcategory.save();
  apiResponse(res, 200, messages.subcategoryUpdated, subcategory);
});

exports.deleteSubcategory = asyncHandler(async (req, res) => {
  const subcategory = await subcategorieModel.findByIdAndDelete(req.params.id);
  if (!subcategory) return apiResponse(res, 404, messages.subcategoryNotFound);

  await categoreModel.findByIdAndUpdate(subcategory.category, { $pull: { subcategories: subcategory._id } });
  apiResponse(res, 200, messages.subcategoryDeleted);
});

exports.allSubcategory = asyncHandler(async (req, res) => {
  const query = req.query.category ? { category: req.query.category } : {};
  const subcategories = await subcategorieModel.find(query).populate("category", "name slug");
  apiResponse(res, 200, messages.subcategoriesFetched, subcategories);
});
