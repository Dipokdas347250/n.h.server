const sendEmail = require("../helpers/sendEmail");
const subadminModel = require("../models/subadmin.model");
const userModel = require("../models/user.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");


exports.applySubadminController = asyncHandler(async (req, res, next) => {
  let {user, storename, logo, phone }= req.body;
  let subadmin = await subadminModel.findOne({user: user});
  let userData = await userModel.findOne({_id: user})


  if(subadmin){
    apiResponse(res, 400, "subadmin alredy exist")

  }else{
    let applysubadmin = new subadminModel({
        user,
        storename,
        logo,
        phone
    })

    await applysubadmin.save()
    // sendEmail(userData.fullname, process.env.AUTH_EMAIL)
     apiResponse(res, 201, "your request send successfully")

  }


});

exports.approveSubadminController = asyncHandler(async (req, res, next) => {
    let {id} = req.params;
      let {status }= req.body;

    let subadmin = await subadminModel.findOneAndUpdate({_id:id},{status}, {new:true});

    apiResponse(res , 200 , "subAdmin status update" ,subadmin)





});