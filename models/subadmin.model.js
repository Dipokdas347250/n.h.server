const {default: mongoose} = require('mongoose');

const subadminSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId
    },

    storename: {
        type: String,
        required: [true, 'Name is required'],
        trim:true
    },
    logo:{
         type: String,
         ref: "User"

    },
    phone:{
        type: String,
        required: [true, 'phone is required'],

    },
    status:{
        type: String,
        enum: {
      values: ["pending", "approved", "rejected"],
      message: "{VALUE} is not a valid status"
    },
        default: 'pending',
    },
    
}, 
{
    timestamps: true,
})





module.exports = mongoose.model("Subadmin", subadminSchema)