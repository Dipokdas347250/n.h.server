const reviewModel = require("../models/review.model");
const userModel = require("../models/user.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

exports.addreviewContaroller = asyncHandler(async(req , res)=>{
    let {user,comment,rating} = req.body;
    let addreview = new reviewModel({
        user,
        comment,
        rating
    })
    await addreview.save()
   await userModel.findOneAndUpdate({_id:user},{$push:{review:addreview._id}})
    apiResponse(res , 200 , "review submited successfull" ,addreview)
})