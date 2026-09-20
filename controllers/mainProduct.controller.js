const productModel = require("../models/product.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const slugify = require('slugify')
const path = require("path");
const fs = require("fs");



exports.allMainProductController = asyncHandler(async (req, res) => {
  let filenames = req.files.map((file) => {
    return `${process.env.SERVER_URL}/${file.filename}`
  });
  let slug = slugify(req.body.title, {
    replacement: '-',
    remove: undefined,
    lower: true,
    trim: true
  })
  let products = new productModel({
    ...req.body,
    image: filenames,
    slug
  })
  await products.save();
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

exports.allProductController = asyncHandler(async(req,res)=>{
  let products = await productModel.find({}).populate({
    path:"variant",
    select: "size color sku"
  })
  apiResponse(res,200,"all product", products)
})
exports.singleProductController = asyncHandler(async(req,res)=>{
  let { slug } = req.params;
  let products = await productModel.findOne({slug}).populate({
    path:"variant",
    select: "size color sku"
  })
  if(!products){
    apiResponse(res,404,"product not found")
  }else{

    apiResponse(res,200,"single product", products)
  }
})