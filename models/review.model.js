const {default: mongoose} = require('mongoose');

const reviewSchema = new mongoose.Schema(
    {
    user:{
        type: mongoose.Types.ObjectId,
        ref: 'User',
         require: [true,"user is required"],
    } ,
    comment:{
         type:String,
        

    },
    rating:{
         type:Number,
         require: [true,"rating is required"],

    },
    image:{
        type:String,
    },
    product:{
        type:mongoose.Types.ObjectId,
        ref: "Product"
    }
   

   
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Review", reviewSchema);