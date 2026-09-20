const cartModel = require("../models/cart.model");
const checkoutModel = require("../models/checkout.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { v4 } = require("uuid")
const userModel = require("../models/user.model");


const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
const is_live = false

exports.checkoutController = asyncHandler(async (req, res) => {

    let { user, paymentMethod, shipping } = req.body;
    let cartItems = await cartModel.find({ user }).populate({
        path: "product",
    })
    let totalprice = cartItems.reduce((total, item) => total + (item.totalprice || 0), 0)

    if (paymentMethod == "cashOnDelivery") {
        let placeOrder = new checkoutModel({
            user,
            paymentMethod,
            shipping,
            items: cartItems,
            totalprice: totalprice
        });
        await placeOrder.save()
        apiResponse(res, 201, "order successfull...", placeOrder)
    } else {
        // online paymentMethod
        let userData = await userModel.findOne({ _id: user })

        let uuid = v4()
        let transaction_id = uuid.slice(0, 16)

        let placeOrder = new checkoutModel({
            user,
            paymentMethod,
            shipping,
            items: cartItems,
            totalprice: totalprice,
            transaction_id: transaction_id
        });
        await placeOrder.save()
        apiResponse(res, 201, "order successfull...", placeOrder)

        const data = {
            total_amount: totalprice,
            currency: 'BDT',
            tran_id: transaction_id,
            success_url: `http://localhost:8080/api/v1/api/checkout/payment_success/${transaction_id}`,
            fail_url: 'http://localhost:8080/api/v1/api/checkout/payment_fail',
            cancel_url: 'http://localhost:3030/cancel',
            ipn_url: 'http://localhost:3030/ipn',
            shipping_method: 'Courier',
            product_name: `${cartItems[0].product.title} ${cartItems.length} more items `,
            product_category: 'Electronic',
            product_profile: 'general',
            cus_name: userData.fullname,
            cus_email: userData.email,
            cus_add1: shipping.address,
            cus_add2: 'Dhaka',
            cus_city: shipping.city,
            cus_state: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: shipping.phone,
            cus_fax: '01711111111',
            ship_name: 'Customer Name',
            ship_add1: 'Dhaka',
            ship_add2: 'Dhaka',
            ship_city: 'Dhaka',
            ship_state: 'Dhaka',
            ship_postcode: 1000,
            ship_country: 'Bangladesh',
        };
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
        sslcz.init(data).then(apiResponse => {
            // Redirect the user to payment gateway
            let GatewayPageURL = apiResponse.GatewayPageURL
            // res.redirect(GatewayPageURL)
            console.log('Redirecting to: ', GatewayPageURL)
        });


    }
})


exports.paymentSuccessController = asyncHandler(async (req, res) => {
    let { id } = req.params;
    let upDatepayment = await checkoutModel.findOneAndUpdate({ transaction_id: id }, { paymentStatus: "paid" }, { new: true })
    apiResponse(res , 200 , "paument successfull",upDatepayment)
})
exports.paymentFailController = asyncHandler(async (req, res) => {
   
    apiResponse(res , 500 , "paument fail")
})
exports.paymentCancelController = asyncHandler(async (req, res) => {
   
    apiResponse(res , 500 , "paument cancel")
})

exports.getallordersController = asyncHandler(async (req, res) => {
    let allorder = await checkoutModel.find({})
        .populate({
            path: "user",
            select: "fullname email -_id"
        })
        .populate({
            path: "items.product",
            select: "title description image price -_id"

        })
    apiResponse(res, 200, "order fatch successfull...", allorder)
})