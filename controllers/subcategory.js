const categoreModel = require("../models/categore.model");
const subcategorieModel = require("../models/subcategorie.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
// const slugify = require('slugify')


exports.addSubcategory= asyncHandler(async (req, res, next) => {
    let { name , category} = req.body;
    //  let slug = slugify(name, {
    //   replacement: '-',  
    //   remove: undefined, 
    //   lower: true,            
    //   trim: true         
    // })
    let subcategory = new subcategorieModel({
        name, category
    });
    await subcategory.save();

   await categoreModel.findOneAndUpdate({_id:category},{$push:{subcategories:subcategory._id}}, {new:true});

    



    apiResponse(res, 200, "Subcategory created successfully", subcategory);

});
exports.updateSubcategory= asyncHandler(async (req,res,next)=>{
    let {id}= req.params;
    let {name, category}= req.body;
    if(category){
    let subcatecory = await subcategorieModel.findOneAndUpdate({_id:id},{name,category},{new:true});
    await categoreModel.findOneAndUpdate({_id:category},{$push:{subcategory:id}},{new:true})

    apiResponse(res, 200 , "subcategory createde",subcatecory)
    }else{
       let subcatecory = await subcategorieModel.findOneAndUpdate({_id:id},{name},{new:true});
         apiResponse(res, 200 , "subcategory createde success",subcatecory)

    }

});

exports.deleteSubcategory= asyncHandler(async(req,res,next)=>{
    let {id} = req.params;
    await subcategorieModel.findByIdAndDelete({_id: id})
    await categoreModel.findOneAndUpdate({subcategories:id},{$pull:{subcategories:id}})
    apiResponse(res , 200 , "subcategory deleteed")
});

exports.allSubcategory= asyncHandler(async(req,res,next)=>{
    let subcatecory = await subcategorieModel.find({})
    apiResponse(res, 200, "all subcategory fatch successfull", subcatecory)

})