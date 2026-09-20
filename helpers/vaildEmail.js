exports.vaildEmail=(email)=>{
   return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)
    //  apiResponse(res,400,"invaild Email")
 
}