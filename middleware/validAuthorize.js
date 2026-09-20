const { apiResponse } = require("../utils/apiResponse");

exports.validAuthorize = (req, res, next) => {
    
    // if (req.session.user && (req.session.user.role === "admin" || req.session.user.role === "subadmin")) {
    //     next();
    // } else {
    //     return res.status(403).json({ message: "Access denied. Admin or Subadmin required." });
    // }
    if(req.session.user?.login){
      next()
    }else{
    apiResponse(res, 401, "Access denied. Please login first.")
    }
};