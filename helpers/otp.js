const otpGenerator = require('otp-generator')




const otpNumber = ()=>{
   return otpGenerator.generate(6, { upperCaseAlphabets: false, specialChars: false });

}
module.exports =otpNumber;