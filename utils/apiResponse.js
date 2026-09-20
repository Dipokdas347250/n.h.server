exports.apiResponse= (res,statusCode,statusMessage,data)=>{
  return res.status(statusCode).json({success: statusCode >= 400 ? false: true,statusCode, message:statusMessage, data })
}