const cartModel = require("../models/cart.model");
const productModel = require("../models/product.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const getProductPrice = (product) => Number(product.discountPrice ?? product.diccountprice ?? product.price);

exports.addCartController = asyncHandler(async(req ,res)=>{
    
    let {variant,quntity,product}= req.body;
    let user = req.session.user._id;
    let cartData = await cartModel.findOne({product,user,variant }).populate({
      path: "product",
      selete: "price"
    })

    if(cartData){
      cartData.quntity++;
      cartData.totalprice = getProductPrice(cartData.product) * cartData.quntity;
      await cartData.save()
      apiResponse(res ,200, "quntity updated")

    }else{

       let productData = await productModel.findOne({_id:product})
       let totalprice = getProductPrice(productData) * (quntity ? quntity: 1);
   
   
   
      if(productData.variantType == "multivariant"){ 
         if(!variant){
            apiResponse(res, 404,"variant is required...")
   
         }else{
   
            let addtocart = new cartModel({
                user,
                quntity,
                product,
                variant,
                totalprice
             });
              await addtocart.save()
             apiResponse(res, 201,"product add to cart...", addtocart)
         }
          
      }else{
       // single variant product
        let addtocart = new cartModel({
           user,
           quntity,
           product,
           totalprice
        });
        await addtocart.save()
        apiResponse(res, 201,"product add to cart...", addtocart)
      }
    }

})

exports.singleCartController = asyncHandler(async(req, res)=>{
   let {user} = req.params;
  
  

   let getCartlist = await cartModel.find({user}).populate({
      path:"product",
      select: "title price discountPrice diccountprice image"
   }).populate({
     path:"variant", 
   }).populate({
      path:"user",
      select: "fullname"
   }) 
   .select(" -updatedAt -createdAt")
   apiResponse(res, 200 , "single cart fatch ...",getCartlist)
})

exports.removeCartController = asyncHandler(async (req, res) => {
   const { product, variant } = req.body;
   await cartModel.findOneAndDelete({ user: req.session.user._id, product, ...(variant ? { variant } : { $or: [{ variant: null }, { variant: { $exists: false } }] }) });
   apiResponse(res, 200, "cart item removed");
});

exports.updateCartController = asyncHandler(async (req, res) => {
   const { product, variant, quntity } = req.body;
   const quantity = Number(quntity);
   if (!Number.isInteger(quantity) || quantity < 1) return apiResponse(res, 400, "Quantity must be at least 1");
   const cartItem = await cartModel.findOne({ user: req.session.user._id, product, ...(variant ? { variant } : { $or: [{ variant: null }, { variant: { $exists: false } }] }) }).populate("product", "price discountPrice diccountprice");
   if (!cartItem) return apiResponse(res, 404, "cart item not found");
   cartItem.quntity = quantity;
   cartItem.totalprice = getProductPrice(cartItem.product) * quantity;
   await cartItem.save();
   apiResponse(res, 200, "cart quantity updated", cartItem);
});