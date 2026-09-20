const jwt = require("jsonwebtoken");
const { apiResponse } = require("../utils/apiResponse");
exports.vailddataCheker=(req,res,next)=>{

     let {token} = req.headers;  
     jwt.verify(token, process.env.JWT_SECRET, function(err, decoded) {
  if(err){
    apiResponse(res,401, err.message)
   
  }else{
    if(decoded.user.role == "admin" ){
     next()
    }else{
        apiResponse(res,401, "access denied")
    }
    
  }
});
    
     
     
}