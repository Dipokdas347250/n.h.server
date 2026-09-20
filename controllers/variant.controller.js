const productModel = require("../models/product.model");
const variantModel = require("../models/variant.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

exports.addVariantController = asyncHandler(async (req, res) => {
   let { size, color, sku, product } = req.body;
   let productData = await productModel.findOne({ _id: product });
   if (!productData) {
      apiResponse(res, 404, "product not found")
   }
   if (productData.variantType == "multivariant") {
      let variant = new variantModel({
         size, color, sku, product
      })

      await variant.save()
      await productModel.findOneAndUpdate({ _id: product }, { $push: { variant: variant._id } }, { new: true })

      apiResponse(res, 201, "variant added successfully", variant)
   } else {
      apiResponse(res, 500, "this product is not multivariant")
   }
   // if(!size || !color || !sku || !product){
   //  apiResponse(res,400,"all fields are required")
   // }else{
   //  apiResponse(res,200,"variant added successfully",productData)
   // }

})

exports.deleteVariantController = asyncHandler(async (req, res) => {
   let { id } = req.params;
   let deletevariant = await variantModel.findByIdAndDelete(id)
   if (!deletevariant) {
      apiResponse(res, 404, " variant not found ...",)

   }else{
     await productModel.findOneAndUpdate({_id:deletevariant.product},
       {$pull:{variant:deletevariant._id}})
      apiResponse(res, 200, " variant deleted successfull ...",)
   
   }
})

exports.updateVariantController = asyncHandler(async(req , res) =>{
   let {id} = req.params;
   let updatevariant = await variantModel.findOneAndUpdate({_id:id},{...req.body}, {new: true})
  
   apiResponse(res ,200, " variant update successfull",updatevariant)
})