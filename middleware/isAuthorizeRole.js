const { apiResponse } = require("../utils/apiResponse")

exports.isAuthorizeRole=(...role)=>{
 return (req,res,next)=>{
     if(role.includes(req.session.user.role)){
    next()
   }else{
    apiResponse(res,403,"Access denied. Admin or Subadmin required.")
   }
 }


    
}
    