const {default: mongoose} = require('mongoose');

const reviewSchema = new mongoose.Schema(
    {
    user:{
        type: mongoose.Types.ObjectId,
        ref: 'User',
         required: [true,"user is required"],
    } ,
    comment:{
         type:String,
        

    },
    rating:{
         type:Number,
         required: [true,"rating is required"],
         min: 1,
         max: 5,

    },
    image:{
        type:String,
    },
    product:{
        type:mongoose.Types.ObjectId,
        ref: "Product"
    },
    // True when the reviewer has a delivered order containing this product.
    verifiedPurchase:{
        type:Boolean,
        default:false,
    }
   

   
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Review", reviewSchema);