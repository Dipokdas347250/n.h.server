const {default: mongoose} = require('mongoose');

const productSchema = new mongoose.Schema(
    {
    title:{
        type:String,
        require: [true,"title is required"],
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
         require: [true,"description is required"],

    },
    image:[String ],
    price:{
        type:Number,
        require: [true,"title is price"],
    },
    diccountprice:{
        type:Number,
        
    },
   category: {
        type: mongoose.Types.ObjectId,
        ref: 'Category',
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