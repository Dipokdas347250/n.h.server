const {default: mongoose} = require('mongoose');

const variantSchema = new mongoose.Schema(
    {
    
   size:{
    type: String,
    trim: true
   },
   color:{
    type: String,
    trim: true
   },
   sku:{
    type: String,
    trim: true,
    required: [ true, "sku is required"]
   },
   product:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: [ true, "product is required"]
   }


   
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Variant", variantSchema);