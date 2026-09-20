const mongoose = require("mongoose");
const { Schema } = mongoose;

const shippingSchema = new Schema({
    phone: {
        type: String,
        require: true,
    },
    address: {
        type: String,
        require: true,
    },
    city: {
        type: String,
        require: true,
    },
    district: {
        type: String,
        require: true,
    },
    postcode: {
        type: String
    },
},
    {
        _id: false
    }
)



const orderSchema = new Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    totalprice: {
        type: Number,
        require: true,
    },
    // cart:{
    //     type: mongoose.Types.ObjectId,
    //     ref: "Cart"
    // },
    items: [
        {
            product: {
                type: mongoose.Types.ObjectId,
                ref: "Product"
            },
            variant: {
                type: mongoose.Types.ObjectId,
                ref: "Variant"
            },
            quntity: {
                type: Number,
                default: 1
            },
        },

    ],
    shipping: shippingSchema,
    paymentMethod: {
        type: String,
        enum: ["cashOnDelivery", "online"],
        required: true,
    },
    transaction_id:{
        type:String
    },
    deliveryStatus: {
        type: String,
        enum: ["pending", "confirm", "deliverd", "cenceled"],
        default: "pending"
    },
    paymentStatus:{
        type: String,
        enum: ["paid" , "unpaid"],
        default: "unpaid" 
    }
})

module.exports = mongoose.model("Order", orderSchema)