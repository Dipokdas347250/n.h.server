const otpGenerator = require('otp-generator')




const otpNumber = ()=>{
   return otpGenerator.generate(6, { upperCaseAlphabets: true, specialChars: false });

}
module.exports =otpNumber;