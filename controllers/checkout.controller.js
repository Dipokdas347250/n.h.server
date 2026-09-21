const cartModel = require("../models/cart.model");
const checkoutModel = require("../models/checkout.model");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { v4 } = require("uuid")
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");


const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
const is_live = false

exports.checkoutController = asyncHandler(async (req, res) => {
    const sessionUser = req.session?.user;
    if (!sessionUser?._id) return apiResponse(res, 401, "Please login before placing an order");

    let { paymentMethod, shipping = {}, items } = req.body;
    const user = await userModel.findById(sessionUser._id).select("fullname email phone Adderss");
    if (!user) return apiResponse(res, 404, "Customer not found");
    if (!paymentMethod || !["cashOnDelivery", "online"].includes(paymentMethod)) {
        return apiResponse(res, 400, "A valid payment method is required");
    }
    const customer = {
        name: user.fullname,
        email: user.email,
        phone: shipping.phone || user.phone,
        address: shipping.address || user.Adderss,
        city: shipping.city,
        district: shipping.district,
        postcode: shipping.postcode,
    };
    if (!customer.phone || !customer.address || !customer.city || !customer.district) {
        return apiResponse(res, 400, "Complete customer and shipping information is required");
    }

    let cartItems;
    if (Array.isArray(items) && items.length) {
        const productIds = items.map((item) => item.product);
        const products = await productModel.find({ _id: { $in: productIds } });
        cartItems = products.map((product) => {
            const requested = items.find((item) => String(item.product) === String(product._id));
            const quantity = Number(requested?.quantity || requested?.quntity || 1);
            return { product: product._id, variant: requested?.variant, quntity: quantity, totalprice: product.price * quantity };
        });
    } else {
        const cart = await cartModel.find({ user: user._id }).populate({ path: "product" });
        cartItems = cart.map((item) => ({
            product: item.product._id,
            variant: item.variant,
            quntity: item.quntity || 1,
            totalprice: item.product.price * (item.quntity || 1),
        }));
    }
    if (!cartItems.length) return apiResponse(res, 400, "Your cart is empty");
    let totalprice = cartItems.reduce((total, item) => total + (item.totalprice || 0), 0)

    if (paymentMethod == "cashOnDelivery") {
        let placeOrder = new checkoutModel({
            user: user._id,
            customer,
            paymentMethod,
            shipping: customer,
            items: cartItems,
            totalprice: totalprice
        });
        await placeOrder.save()
        apiResponse(res, 201, "order successfull...", placeOrder)
    } else {
        // online paymentMethod
        let userData = user

        let uuid = v4()
        let transaction_id = uuid.slice(0, 16)

        let placeOrder = new checkoutModel({
            user: user._id,
            customer,
            paymentMethod,
            shipping: customer,
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
            product_name: `${cartItems.length} product${cartItems.length === 1 ? "" : "s"}`,
            product_category: 'Electronic',
            product_profile: 'general',
            cus_name: userData.fullname,
            cus_email: userData.email,
            cus_add1: customer.address,
            cus_add2: 'Dhaka',
            cus_city: customer.city,
            cus_state: 'Dhaka',
            cus_postcode: '1000',
            cus_country: 'Bangladesh',
            cus_phone: customer.phone,
            cus_fax: '01711111111',
            ship_name: 'Customer Name',
            ship_add1: customer.address,
            ship_add2: 'Dhaka',
            ship_city: customer.city,
            ship_state: 'Dhaka',
            ship_postcode: customer.postcode,
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
            select: "fullname email phone Adderss -_id"
        })
        .populate({
            path: "items.product",
            select: "title description image price -_id"

        })
    apiResponse(res, 200, "order fatch successfull...", allorder)
})