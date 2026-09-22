const {default: mongoose} = require('mongoose');

const productSchema = new mongoose.Schema(
    {
    title:{
        type:String,
        required: [true,"title is required"],
          trim: true
    },
    sku:{
         type:String,
         trim: true
    },
    slug:{
         type:String,
         trim: true
    },
    description:{
         type:String,
         required: [true,"description is required"],
         trim: true
    },
    image:[String ],
    price:{
        type:Number,
        required: [true,"price is required"],
        min: 0
    },
    discountPrice:{
        type:Number,
        min: 0
    },
    // Kept for existing records and older cart documents.
    diccountprice:{
        type:Number,
        min: 0
    },
    offer:{
        type:String,
        trim: true,
        default: ""
    },
   category: {
        type: mongoose.Types.ObjectId,
        ref: 'categoryModle',
    },
    variantType:{
          type:String,
          enum:["singlevariant", "multivariant"],
          default:"singlevariant"
    },
    variant: [
        {
        type: mongoose.Types.ObjectId,
        ref: 'Variant',
    }
],
    review: [
        {
        type: mongoose.Types.ObjectId,
        ref: 'Review',
    }
],

   
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Product", productSchema);