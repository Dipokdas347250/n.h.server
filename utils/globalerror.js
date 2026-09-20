const { apiResponse } = require("./apiResponse");

exports.globalerrorhandler = (error, req, res, next) => {
    
     if (error.name === 'ValidationError') {
    let errors = {};
    Object.keys(error.errors).forEach((key) => {
      errors[key] = error.errors[key].message;
    });
    // return res.status(400).json({success:false,message:errors}); 
     apiResponse(res,400,Object.values(errors)[0])
  }else if(error.message){
    apiResponse(res,500,error.message)
  //  return res.status(500).json({success:false, message:error.message})
  }else{
     apiResponse(res,500,"Something went wrong")
    // return res.status(500).json({success:false, message:"Something went wrong"})
  }
  

}