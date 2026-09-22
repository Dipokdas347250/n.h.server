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
    let { fullname, email, password, phone, address, photo } = req.body;
    if (!fullname?.trim() || !email?.trim() || !password || password.length < 8) {
      return apiResponse(res, 400, "Name, valid email, and a password of at least 8 characters are required");
    }
   let emailCheker = vaildEmail(email);
   let checkUser = await userModel.findOne({email})
   if(checkUser){
    return apiResponse(res,400,"email already in use")
   }

   if(!emailCheker){
     apiResponse(res,400,"invaild Email")
   }else{
      const hash = await bcrypt.hash(password, 12);
      const otp = otpNumber();
      const user = new userModel({
        fullname: fullname.trim(), email: email.trim().toLowerCase(), password: hash, phone, Adderss: address, photo, otp, otpExpire: Date.now() + 5 * 60 * 1000
      });
      try {
        await sendEmail(user.email, user.fullname, otp);
      } catch (error) {
        console.error("Unable to send registration OTP:", error.message);
        return apiResponse(res, 503, error.message || "Unable to send verification email. Check the mail server configuration and try again.");
      }
      await user.save();
      apiResponse(res,201,"user created successfully",{ _id: user._id, fullname: user.fullname, email: user.email });
   }

    
}
)

exports.dashboardSignupController = asyncHandler(async (req, res) => {
  const { fullname, email, password, phone, address, photo } = req.body;
  if (!fullname?.trim() || !email?.trim() || !password || password.length < 8) {
    return apiResponse(res, 400, "Name, valid email, and a password of at least 8 characters are required");
  }
  if (!vaildEmail(email)) return apiResponse(res, 400, "Invalid email");
  if (await userModel.exists({ email: email.trim().toLowerCase() })) return apiResponse(res, 400, "Email already in use");
  if (await userModel.exists({ role: "admin" })) return apiResponse(res, 403, "An administrator already exists. Ask an administrator to create your account.");

  const passwordHash = await bcrypt.hash(password, 12);
  const otp = otpNumber();
  const user = new userModel({
    fullname: fullname.trim(), email: email.trim().toLowerCase(), password: passwordHash,
    phone, Adderss: address, photo, role: "admin", otp, otpExpire: Date.now() + 5 * 60 * 1000,
  });
  try {
    await sendEmail(user.email, user.fullname, otp);
  } catch (error) {
    console.error("Unable to send dashboard OTP:", error.message);
    return apiResponse(res, 503, error.message || "Unable to send verification email");
  }
  await user.save();
  apiResponse(res, 201, "Dashboard administrator created successfully", { _id: user._id, fullname: user.fullname, email: user.email });
});


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
    if (!loginUser.verified) return apiResponse(res, 403, "Please verify your email before logging in");
    if (!['admin', 'subadmin'].includes(loginUser.role)) return apiResponse(res, 403, "This account does not have dashboard access");
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
                req.session.cookie.maxAge = 24 * 7 * 60 * 60 * 1000; // 7 day
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
  if(!user) return apiResponse(res,404,"email not found");
  const submittedOtp = String(otp || "").trim().toUpperCase();
  const savedOtp = String(user.otp || "").trim().toUpperCase();
  if(!submittedOtp || savedOtp !== submittedOtp){
    return apiResponse(res,401,"invalid otp");
  }
  if(user.otpExpire < new Date()){
    user.otp = null;
    user.otpExpire = null;
   await user.save();
    return apiResponse(res,401,"otp expired")
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
    if(!user) return apiResponse(res,404,"email not found")
  let otp = otpNumber();
  user.otp = otp;
  user.otpExpire = Date.now() + 5 * 60 * 1000;
 await user.save();
 try {
   await sendEmail(email,user.fullname,otp)
 } catch (error) {
   console.error("Unable to resend OTP:", error.message);
   return apiResponse(res, 503, error.message || "Unable to send verification email. Check the mail server configuration and try again.");
 }
 apiResponse(res,200,"otp resend successfully")
})

exports.alluserController = asyncHandler(async(req,res)=>{
   let users = await userModel.find({}).select("fullname email role")
   apiResponse(res,200,"fetch all users successful",users)
})

exports.getMeController = asyncHandler(async(req,res)=>{
  let user = await userModel.findOne({email: req?.session?.user?.email}).select("_id fullname email phone Adderss role")

  apiResponse(res,200,"fetch user successful", user ? { ...user.toObject(), address: user.Adderss } : user)
})

exports.updateProfileController = asyncHandler(async (req, res) => {
  const sessionUser = req.session?.user;
  if (!sessionUser?._id) return apiResponse(res, 401, "Please login first");

  const { fullname, phone, address, password } = req.body;
  const user = await userModel.findById(sessionUser._id);
  if (!user) return apiResponse(res, 404, "user not found");

  if (fullname !== undefined) user.fullname = fullname.trim();
  if (phone !== undefined) user.phone = phone.trim();
  if (address !== undefined) user.Adderss = address.trim();
  if (password) user.password = await bcrypt.hash(password, 12);
  await user.save();

  req.session.user = {
    ...req.session.user,
    fullname: user.fullname,
  };
  apiResponse(res, 200, "profile updated successfully", {
    _id: user._id,
    fullname: user.fullname,
    email: user.email,
    phone: user.phone,
    address: user.Adderss,
    role: user.role,
  });
});

exports.logoutController = asyncHandler(async (req, res) => {
  req.session.destroy((error) => {
    if (error) return apiResponse(res, 500, "Unable to logout");
    res.clearCookie("ecommerce-session");
    apiResponse(res, 200, "logout successful");
  });
});






// exports.productsController = (req, res) => {
//     res.send("Products Controller");
// }

