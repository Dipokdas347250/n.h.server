/**
 * Bilingual message catalogue. Each entry is `{ en, bn }` and is passed straight
 * to `apiResponse`, which puts both languages on the wire.
 */
const messages = {
  // ---- auth ----
  signupInvalid: {
    en: "Name, a valid email, and a password of at least 8 characters are required",
    bn: "নাম, সঠিক ইমেইল এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিতে হবে",
  },
  emailInUse: { en: "This email is already in use", bn: "এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হচ্ছে" },
  invalidEmail: { en: "Invalid email address", bn: "ইমেইল ঠিকানাটি সঠিক নয়" },
  emailNotFound: { en: "No account found with this email", bn: "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি" },
  invalidPassword: { en: "Incorrect password", bn: "পাসওয়ার্ড সঠিক নয়" },
  notVerified: { en: "Please verify your email before logging in", bn: "লগইন করার আগে আপনার ইমেইল যাচাই করুন" },
  noDashboardAccess: { en: "This account does not have dashboard access", bn: "এই অ্যাকাউন্টের ড্যাশবোর্ড ব্যবহারের অনুমতি নেই" },
  adminExists: {
    en: "An administrator already exists. Ask an administrator to create your account.",
    bn: "একজন অ্যাডমিন ইতিমধ্যে আছেন। নতুন অ্যাকাউন্টের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।",
  },
  userCreated: { en: "Account created successfully", bn: "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে" },
  adminCreated: { en: "Dashboard administrator created successfully", bn: "ড্যাশবোর্ড অ্যাডমিন সফলভাবে তৈরি হয়েছে" },
  loginSuccess: { en: "Login successful", bn: "সফলভাবে লগইন হয়েছে" },
  logoutSuccess: { en: "Logout successful", bn: "সফলভাবে লগআউট হয়েছে" },
  logoutFailed: { en: "Unable to logout", bn: "লগআউট করা যায়নি" },
  otpInvalid: { en: "The verification code is not correct", bn: "যাচাইকরণ কোডটি সঠিক নয়" },
  otpExpired: { en: "The verification code has expired", bn: "যাচাইকরণ কোডের মেয়াদ শেষ হয়ে গেছে" },
  otpVerified: { en: "Email verified successfully", bn: "ইমেইল সফলভাবে যাচাই হয়েছে" },
  otpResent: { en: "A new verification code has been sent", bn: "নতুন যাচাইকরণ কোড পাঠানো হয়েছে" },
  emailSendFailed: {
    en: "Unable to send the verification email. Check the mail server settings and try again.",
    bn: "যাচাইকরণ ইমেইল পাঠানো যায়নি। মেইল সার্ভারের সেটিংস দেখে আবার চেষ্টা করুন।",
  },
  loginRequired: { en: "Access denied. Please login first.", bn: "প্রবেশাধিকার নেই। আগে লগইন করুন।" },
  adminRequired: { en: "Access denied. Admin or sub-admin access required.", bn: "প্রবেশাধিকার নেই। অ্যাডমিন বা সাব-অ্যাডমিন অনুমতি প্রয়োজন।" },
  userNotFound: { en: "User not found", bn: "ব্যবহারকারী পাওয়া যায়নি" },
  profileFetched: { en: "Profile fetched successfully", bn: "প্রোফাইল সফলভাবে আনা হয়েছে" },
  profileUpdated: { en: "Profile updated successfully", bn: "প্রোফাইল সফলভাবে হালনাগাদ হয়েছে" },
  usersFetched: { en: "Users fetched successfully", bn: "ব্যবহারকারীদের তালিকা আনা হয়েছে" },

  // ---- catalogue ----
  categoryCreated: { en: "Category created successfully", bn: "ক্যাটাগরি সফলভাবে তৈরি হয়েছে" },
  categoryUpdated: { en: "Category updated successfully", bn: "ক্যাটাগরি সফলভাবে হালনাগাদ হয়েছে" },
  categoryDeleted: { en: "Category deleted successfully", bn: "ক্যাটাগরি সফলভাবে মুছে ফেলা হয়েছে" },
  categoryNotFound: { en: "Category not found", bn: "ক্যাটাগরি পাওয়া যায়নি" },
  categoriesFetched: { en: "Categories fetched successfully", bn: "ক্যাটাগরির তালিকা আনা হয়েছে" },
  categoryImageRequired: { en: "A category image is required", bn: "ক্যাটাগরির ছবি দেওয়া আবশ্যক" },
  categoryRequired: { en: "A valid category is required", bn: "সঠিক ক্যাটাগরি নির্বাচন করতে হবে" },

  subcategoryCreated: { en: "Sub-category created successfully", bn: "সাব-ক্যাটাগরি সফলভাবে তৈরি হয়েছে" },
  subcategoryUpdated: { en: "Sub-category updated successfully", bn: "সাব-ক্যাটাগরি সফলভাবে হালনাগাদ হয়েছে" },
  subcategoryDeleted: { en: "Sub-category deleted successfully", bn: "সাব-ক্যাটাগরি সফলভাবে মুছে ফেলা হয়েছে" },
  subcategoryNotFound: { en: "Sub-category not found", bn: "সাব-ক্যাটাগরি পাওয়া যায়নি" },
  subcategoriesFetched: { en: "Sub-categories fetched successfully", bn: "সাব-ক্যাটাগরির তালিকা আনা হয়েছে" },

  productCreated: { en: "Product created successfully", bn: "পণ্য সফলভাবে তৈরি হয়েছে" },
  productUpdated: { en: "Product updated successfully", bn: "পণ্য সফলভাবে হালনাগাদ হয়েছে" },
  productDeleted: { en: "Product deleted successfully", bn: "পণ্য সফলভাবে মুছে ফেলা হয়েছে" },
  productNotFound: { en: "Product not found", bn: "পণ্য পাওয়া যায়নি" },
  productsFetched: { en: "Products fetched successfully", bn: "পণ্যের তালিকা আনা হয়েছে" },
  titleDescriptionRequired: { en: "Title and description are required", bn: "শিরোনাম ও বিবরণ দেওয়া আবশ্যক" },
  priceRequired: { en: "A valid price is required", bn: "সঠিক মূল্য দিতে হবে" },
  discountRange: {
    en: "The offer price must be between 0 and the regular price",
    bn: "অফার মূল্য ০ থেকে নিয়মিত মূল্যের মধ্যে হতে হবে",
  },
  invalidVariants: { en: "The variant format is not valid", bn: "ভ্যারিয়েন্টের ফরম্যাট সঠিক নয়" },

  variantCreated: { en: "Variant added successfully", bn: "ভ্যারিয়েন্ট সফলভাবে যোগ হয়েছে" },
  variantUpdated: { en: "Variant updated successfully", bn: "ভ্যারিয়েন্ট সফলভাবে হালনাগাদ হয়েছে" },
  variantDeleted: { en: "Variant deleted successfully", bn: "ভ্যারিয়েন্ট সফলভাবে মুছে ফেলা হয়েছে" },
  variantNotFound: { en: "Variant not found", bn: "ভ্যারিয়েন্ট পাওয়া যায়নি" },
  variantRequired: { en: "Please choose a variant", bn: "একটি ভ্যারিয়েন্ট নির্বাচন করুন" },
  notMultivariant: { en: "This product does not use variants", bn: "এই পণ্যে ভ্যারিয়েন্ট ব্যবহার হয় না" },

  bannerCreated: { en: "Banner created successfully", bn: "ব্যানার সফলভাবে তৈরি হয়েছে" },
  bannerUpdated: { en: "Banner updated successfully", bn: "ব্যানার সফলভাবে হালনাগাদ হয়েছে" },
  bannerDeleted: { en: "Banner deleted successfully", bn: "ব্যানার সফলভাবে মুছে ফেলা হয়েছে" },
  bannerNotFound: { en: "Banner not found", bn: "ব্যানার পাওয়া যায়নি" },
  bannersFetched: { en: "Banners fetched successfully", bn: "ব্যানারের তালিকা আনা হয়েছে" },
  bannerImageRequired: { en: "A banner image is required", bn: "ব্যানারের ছবি দেওয়া আবশ্যক" },

  videoCreated: { en: "Video uploaded successfully", bn: "ভিডিও সফলভাবে আপলোড হয়েছে" },
  videoUpdated: { en: "Video updated successfully", bn: "ভিডিও সফলভাবে হালনাগাদ হয়েছে" },
  videoDeleted: { en: "Video deleted successfully", bn: "ভিডিও সফলভাবে মুছে ফেলা হয়েছে" },
  videoNotFound: { en: "Video not found", bn: "ভিডিও পাওয়া যায়নি" },
  videosFetched: { en: "Videos fetched successfully", bn: "ভিডিওর তালিকা আনা হয়েছে" },
  videoRequired: { en: "A video file is required", bn: "ভিডিও ফাইল দেওয়া আবশ্যক" },
  titleRequired: { en: "A title is required", bn: "শিরোনাম দেওয়া আবশ্যক" },

  // ---- cart ----
  cartAdded: { en: "Added to cart", bn: "কার্টে যোগ করা হয়েছে" },
  cartUpdated: { en: "Cart quantity updated", bn: "কার্টের পরিমাণ হালনাগাদ হয়েছে" },
  cartRemoved: { en: "Removed from cart", bn: "কার্ট থেকে সরানো হয়েছে" },
  cartFetched: { en: "Cart fetched successfully", bn: "কার্ট সফলভাবে আনা হয়েছে" },
  cartItemNotFound: { en: "Cart item not found", bn: "কার্টের পণ্যটি পাওয়া যায়নি" },
  cartEmpty: { en: "Your cart is empty", bn: "আপনার কার্ট খালি" },
  quantityInvalid: { en: "Quantity must be at least 1", bn: "পরিমাণ কমপক্ষে ১ হতে হবে" },

  // ---- reviews ----
  reviewCreated: { en: "Review submitted successfully", bn: "রিভিউ সফলভাবে জমা হয়েছে" },
  reviewsFetched: { en: "Reviews fetched successfully", bn: "রিভিউ সফলভাবে আনা হয়েছে" },
  reviewInvalid: {
    en: "A product, a comment, and a rating from 1 to 5 are required",
    bn: "পণ্য, মন্তব্য এবং ১ থেকে ৫ এর মধ্যে রেটিং দিতে হবে",
  },
  reviewLoginRequired: { en: "Please login before writing a review", bn: "রিভিউ লেখার আগে লগইন করুন" },

  // ---- orders ----
  orderPlaced: { en: "Your order has been placed successfully", bn: "আপনার অর্ডার সফলভাবে গ্রহণ করা হয়েছে" },
  ordersFetched: { en: "Orders fetched successfully", bn: "অর্ডারের তালিকা আনা হয়েছে" },
  orderFetched: { en: "Order fetched successfully", bn: "অর্ডার সফলভাবে আনা হয়েছে" },
  orderUpdated: { en: "Order updated successfully", bn: "অর্ডার সফলভাবে হালনাগাদ হয়েছে" },
  orderNotFound: { en: "Order not found", bn: "অর্ডার পাওয়া যায়নি" },
  paymentMethodRequired: { en: "Please choose a valid payment method", bn: "সঠিক পেমেন্ট মাধ্যম নির্বাচন করুন" },
  customerInfoRequired: {
    en: "Name, phone number, address, city and district are required",
    bn: "নাম, মোবাইল নম্বর, ঠিকানা, শহর ও জেলা দেওয়া আবশ্যক",
  },
  invalidPhone: {
    en: "Enter a valid Bangladeshi mobile number, for example 01XXXXXXXXX",
    bn: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন, যেমন ০১XXXXXXXXX",
  },
  orderBlocked: {
    en: "We could not accept this order automatically. Please call our hotline to confirm it.",
    bn: "এই অর্ডারটি স্বয়ংক্রিয়ভাবে গ্রহণ করা যায়নি। নিশ্চিত করতে আমাদের হটলাইনে কল করুন।",
  },
  orderRateLimited: {
    en: "Too many orders were placed from this number in a short time. Please try again later.",
    bn: "অল্প সময়ে এই নম্বর থেকে অনেকগুলো অর্ডার এসেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
  },
  paymentSuccess: { en: "Payment completed successfully", bn: "পেমেন্ট সফলভাবে সম্পন্ন হয়েছে" },
  paymentFailed: { en: "Payment failed", bn: "পেমেন্ট ব্যর্থ হয়েছে" },
  paymentCancelled: { en: "Payment was cancelled", bn: "পেমেন্ট বাতিল করা হয়েছে" },
  paymentGatewayUnavailable: {
    en: "The online payment gateway is not available right now. Please use cash on delivery.",
    bn: "অনলাইন পেমেন্ট গেটওয়ে এই মুহূর্তে কাজ করছে না। অনুগ্রহ করে ক্যাশ অন ডেলিভারি ব্যবহার করুন।",
  },
  trackingInfoRequired: {
    en: "Enter your order number and the phone number you ordered with",
    bn: "আপনার অর্ডার নম্বর এবং অর্ডারের সময় দেওয়া মোবাইল নম্বর দিন",
  },

  // ---- settings / delivery ----
  settingsFetched: { en: "Store settings fetched successfully", bn: "স্টোর সেটিংস সফলভাবে আনা হয়েছে" },
  settingsUpdated: { en: "Store settings updated successfully", bn: "স্টোর সেটিংস সফলভাবে হালনাগাদ হয়েছে" },
  deliveryZoneInvalid: { en: "Please choose a valid delivery area", bn: "সঠিক ডেলিভারি এলাকা নির্বাচন করুন" },

  // ---- misc ----
  visitRecorded: { en: "Visit recorded", bn: "ভিজিট রেকর্ড করা হয়েছে" },
  visitorKeyRequired: { en: "A visitor key is required", bn: "ভিজিটর কী প্রয়োজন" },
  dashboardFetched: { en: "Dashboard data fetched successfully", bn: "ড্যাশবোর্ডের তথ্য সফলভাবে আনা হয়েছে" },
  analyticsFetched: { en: "Analytics fetched successfully", bn: "অ্যানালিটিক্স সফলভাবে আনা হয়েছে" },
  transactionsFetched: { en: "Transactions fetched successfully", bn: "লেনদেনের তালিকা আনা হয়েছে" },
  subadminApplied: { en: "Your request has been submitted", bn: "আপনার আবেদন জমা হয়েছে" },
  subadminExists: { en: "A sub-admin request already exists", bn: "সাব-অ্যাডমিনের আবেদন ইতিমধ্যে আছে" },
  subadminUpdated: { en: "Sub-admin status updated", bn: "সাব-অ্যাডমিনের অবস্থা হালনাগাদ হয়েছে" },
  somethingWentWrong: { en: "Something went wrong", bn: "কিছু একটা ভুল হয়েছে" },
  invalidFileType: { en: "Only PNG and JPEG images are allowed", bn: "শুধুমাত্র PNG ও JPEG ছবি আপলোড করা যাবে" },
  invalidVideoType: { en: "Only video files are allowed", bn: "শুধুমাত্র ভিডিও ফাইল আপলোড করা যাবে" },
  fileTooLarge: { en: "The uploaded file is too large", bn: "আপলোড করা ফাইলটি অনেক বড়" },
};

module.exports = messages;
