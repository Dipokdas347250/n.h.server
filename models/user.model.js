const {default: mongoose} = require('mongoose');

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: [true, 'Name is required'],
        trim:true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: [true,"email already in use"],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
    },
    phone:{
        type: String,
    },
    role:{
        type: String,
        enum: ['user', 'admin','subadmin'],
        default: 'user',
    },
    Adderss:{
        type: String,    
    },
    photo:{
        type: String,
    },
    otp:{
        type:String,
        
    },
    otpExpire:{
        type:Date,
    },
    verified:{
        type:Boolean,
        default:false,
    },
    review:[
        {
        type:mongoose.Types.ObjectId,
        ref:"Review"
        }
    ]
}, 
{
    timestamps: true,
})





module.exports = mongoose.model("User", userSchema)