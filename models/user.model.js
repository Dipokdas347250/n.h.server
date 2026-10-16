const {default: mongoose} = require('mongoose');

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: [true, 'Name is required'],
        trim:true
    },
    // Required for everyone except merchants, who may sign in with their
    // mobile number instead. Unique whenever present (index below).
    email: {
        type: String,
        required: [function () { return this.role !== "merchant"; }, 'Email is required'],
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
        enum: ['user', 'admin','subadmin','merchant'],
        default: 'user',
    },
    Adderss:{
        type: String,    
    },
    photo:{
        type: String,
    },
    // Cloudinary id of `photo`, so replacing the picture deletes the old one.
    photoId:{
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





// Email is unique whenever it is set. Merchants without an email leave the
// field out entirely (never ""), so any number of them can exist. The old
// plain unique index is replaced by utils/migrations.js.
userSchema.index(
    { email: 1 },
    { unique: true, name: "email_unique_when_present", partialFilterExpression: { email: { $type: "string" } } }
);
// Merchants may sign in with their mobile number.
userSchema.index({ phone: 1 });

module.exports = mongoose.model("User", userSchema)