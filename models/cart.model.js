const {default: mongoose} = require('mongoose');

const cartSchema = new mongoose.Schema(
    {
        product:{
            type:mongoose.Types.ObjectId,
            ref: "Product"
        },
        quntity:{
            type:Number,
            default: 1
        },
        user:{
            type:mongoose.Types.ObjectId,
            ref: "User"
        },
        variant:{
            type:mongoose.Types.ObjectId,
            ref: "Variant"
        },
        
        totalprice:{
            type: Number,
            require:[true , "totalprice is require"]
        }
  
   

   
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Cart", cartSchema);