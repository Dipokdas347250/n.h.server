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
    image:[String],
    // Cloudinary public ids, kept so deletes can clean the remote gallery up.
    imageIds:[String],
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
    // Units on hand. `null` means stock is not tracked for this product.
    stock:{
        type:Number,
        min: 0,
        default: null
    },
    // The merchant who sells it; `null` for the store's own products.
    merchant:{
        type: mongoose.Types.ObjectId,
        ref: 'Merchant',
        default: null,
        index: true
    },
    // Merchant products start "pending" and only reach the storefront once an
    // administrator approves them. The default stays "approved" so products
    // created before merchants existed (which have no value here) stay visible.
    approvalStatus:{
        type:String,
        enum:["pending", "approved", "rejected"],
        default:"approved",
        index: true
    },
    rejectionReason:{
        type:String,
        trim: true,
        default: ""
    },
    // The merchant's own choice: "hidden" takes an approved product off the
    // storefront without deleting it. Separate from the account status, so
    // suspending and reactivating a merchant never changes it — products the
    // merchant hid (or that are pending or rejected) stay off the storefront
    // after reactivation, and only active approved ones come back.
    listingStatus:{
        type:String,
        enum:["active", "hidden"],
        default:"active",
        index: true
    },
    reviewedBy:{
        type: mongoose.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewedAt:{
        type: Date,
        default: null
    },

   
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Product", productSchema);