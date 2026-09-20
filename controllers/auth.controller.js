const userModel = require("../models/user.model");
const { apiResponse } = require("../utils/apiResponse");
const bcrypt = require('bcrypt');
const asyncHandler = require("../utils/asyncHandler");
const sendEmail = require("../helpers/sendEmail");
const otpNumber = require("../helpers/otp");
const { vaildEmail } = require("../helpers/vaildEmail");
// const jwt = require('jsonwebtoken');


exports.signupController = asyncHandler(
    async (req, res) => {
    let { fullname, email, password, phone, address, photo,otp } = req.body;
   let emailCheker = vaildEmail(email);
   let checkUser = await userModel.findOne({email})
   if(checkUser){
    return apiResponse(res,400,"email already in use")
   }

   if(!emailCheker){
     apiResponse(res,400,"invaild Email")
   }else{
      bcrypt.hash(password, 12,async function(err, hash) {
       if(err){
        apiResponse(res,500,err)
       }
       let otp = otpNumber()
        let user = new userModel({
        fullname, email, password:hash, phone, address, photo,otp, otpExpire: Date.now() + 5 * 60 * 1000
    })
    await user.save()
    sendEmail(email,fullname,otp)
    apiResponse(res,201,"user created successfull",user)
       
    });
   }

    
}
)


exports.loginController = asyncHandler(async(req,res)=>{
    let {email, password}= req.body;
 let emailCheker = vaildEmail(email);

   if(!emailCheker){
     apiResponse(res,400,"invaild Email")
   }else{
    let loginUser = await userModel.findOne({email})
  if(!loginUser){
    apiResponse(res,404,"email not found")
  }else{
    bcrypt.compare(password, loginUser.password,function(err,result){
        if(err){
            apiResponse(res,500,"some went wrong")
        }else{
            if(!result){
              apiResponse(res,401,"Invalid password")
            }else{
              let user ={
                _id: loginUser._id,
                fullname:loginUser.fullname,
                email:loginUser.email,
                role:loginUser.role,
                login: true
              };

              if(loginUser.role == "admin" || loginUser.role == "subadmin"){
                req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 1 day
                 req.session.user = user;
              }else{
                req.session.cookie.maxAge = 24 * 7 * 60 * 60 * 1000; // 7 days
                 req.session.user = user;
              }



              // let token = jwt.sign({ user}, process.env.JWT_SECRET,{ expiresIn: "2m"});
              // apiResponse(res,200,"user login success",{...user, token})
              apiResponse(res,200,"user login success", user)
            }
            
        }
    })
  }

   }
  
})


exports.verifyOtpController = asyncHandler(async(req,res)=>{
  let {email, otp} = req.body;
  let user = await userModel.findOne({email});
  if(!user){
     apiResponse(res,404,"email not found")
  }
  if(user.otp != otp){
    apiResponse(res,401,"invalid otp")
  }
  if(user.otpExpire < new Date()){
    user.otp = null;
    user.otpExpire = null;
   await user.save();
    apiResponse(res,401,"otp expired")
  }else{
   user.verified = true;
   user.otp = null;
    user.otpExpire = null;
   await user.save();
    apiResponse(res,200,"otp verified successfully")
  }
 
})


exports.resendOtpController = asyncHandler(async(req,res)=>{
  let {email} = req.body;
  let user = await userModel.findOne({email});
  if(!user){
     apiResponse(res,404,"email not found")
  }
  let otp = otpNumber();
  user.otp = otp;
  user.otpExpire = Date.now() + 5 * 60 * 1000;
 await user.save();
 sendEmail(email,user.fullname,otp)
 apiResponse(res,200,"otp resend successfully")
})

exports.alluserController = asyncHandler(async(req,res)=>{
   let users = await userModel.find({}).select("fullname email role")
   apiResponse(res,200,"fetch all users successful",users)
})

exports.getMeController = asyncHandler(async(req,res)=>{
  let user = await userModel.findOne({email: req?.session?.user?.email}).select(" _id fullname email role")

  apiResponse(res,200,"fetch user successful",user)
})






// exports.productsController = (req, res) => {
//     res.send("Products Controller");
// }

