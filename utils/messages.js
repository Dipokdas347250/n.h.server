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
  currentPasswordRequired: {
    en: "Enter your current password to change the email",
    bn: "ইমেইল পরিবর্তন করতে বর্তমান পাসওয়ার্ড দিন",
  },
  notVerified: { en: "Please verify your email before logging in", bn: "লগইন করার আগে আপনার ইমেইল যাচাই করুন" },
  noDashboardAccess: {
    en: "Only administrators and approved merchants can sign in to the dashboard",
    bn: "শুধুমাত্র অ্যাডমিন ও অনুমোদিত মার্চেন্টরা ড্যাশবোর্ডে সাইন ইন করতে পারেন",
  },
  dashboardStatusFetched: { en: "Dashboard status fetched", bn: "ড্যাশবোর্ডের অবস্থা আনা হয়েছে" },
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
  adminRequired: { en: "Access denied. Admin access required.", bn: "প্রবেশাধিকার নেই। অ্যাডমিন অনুমতি প্রয়োজন।" },
  userNotFound: { en: "User not found", bn: "ব্যবহারকারী পাওয়া যায়নি" },
  profileFetched: { en: "Profile fetched successfully", bn: "প্রোফাইল সফলভাবে আনা হয়েছে" },
  profileUpdated: { en: "Profile updated successfully", bn: "প্রোফাইল সফলভাবে হালনাগাদ হয়েছে" },
  photoRequired: { en: "Please choose a picture to upload", bn: "আপলোড করার জন্য একটি ছবি নির্বাচন করুন" },
  photoUpdated: { en: "Profile picture updated", bn: "প্রোফাইল ছবি হালনাগাদ হয়েছে" },
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
  youtubeUrlInvalid: {
    en: "That does not look like a YouTube video link",
    bn: "এটি সঠিক ইউটিউব ভিডিও লিংক নয়",
  },
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

  // ---- Meta Pixel / Steadfast courier ----
  pixelIdInvalid: {
    en: "The Meta Pixel ID should be the number from Events Manager (digits only)",
    bn: "মেটা পিক্সেল আইডি হবে ইভেন্টস ম্যানেজারের নম্বরটি (শুধু সংখ্যা)",
  },
  steadfastNotConfigured: {
    en: "Add your Steadfast API key and secret key in Store settings first",
    bn: "আগে স্টোর সেটিংসে স্টেডফাস্টের API কী ও সিক্রেট কী দিন",
  },
  steadfastSent: { en: "Order sent to Steadfast", bn: "অর্ডার স্টেডফাস্টে পাঠানো হয়েছে" },
  steadfastAlreadySent: { en: "This order is already booked with Steadfast", bn: "এই অর্ডারটি ইতিমধ্যে স্টেডফাস্টে বুক করা হয়েছে" },
  steadfastNotSent: { en: "This order has not been sent to Steadfast yet", bn: "এই অর্ডারটি এখনও স্টেডফাস্টে পাঠানো হয়নি" },
  steadfastNotReady: {
    en: "Cancelled or delivered orders cannot be sent to the courier",
    bn: "বাতিল বা ডেলিভারি হওয়া অর্ডার কুরিয়ারে পাঠানো যায় না",
  },
  steadfastNeedsReview: {
    en: "Confirm this order in Fake order review before sending it",
    bn: "পাঠানোর আগে ভুয়া অর্ডার যাচাই পাতায় অর্ডারটি নিশ্চিত করুন",
  },
  steadfastStatusFetched: { en: "Courier status updated", bn: "কুরিয়ারের অবস্থা হালনাগাদ হয়েছে" },
  steadfastConnected: { en: "Connected to Steadfast", bn: "স্টেডফাস্টের সাথে সংযোগ হয়েছে" },
  steadfastBulkDone: (sent, failed) => ({
    en: `${sent} sent to Steadfast${failed ? `, ${failed} not sent` : ""}`,
    bn: `${sent} টি স্টেডফাস্টে পাঠানো হয়েছে${failed ? `, ${failed} টি পাঠানো যায়নি` : ""}`,
  }),

  // ---- merchants ----
  merchantApplied: {
    en: "Your application has been submitted. We will review it and contact you.",
    bn: "আপনার আবেদন জমা হয়েছে। আমরা যাচাই করে আপনার সাথে যোগাযোগ করব।",
  },
  merchantApplicationInvalid: {
    en: "Name, mobile number, business name, address, product type, NID number and a password of at least 8 characters are required",
    bn: "নাম, মোবাইল নম্বর, ব্যবসার নাম, ঠিকানা, পণ্যের ধরন, এনআইডি নম্বর এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিতে হবে",
  },
  facebookPageInvalid: {
    en: "Enter your Facebook page link, for example https://facebook.com/yourpage",
    bn: "আপনার ফেসবুক পেজের লিংক দিন, যেমন https://facebook.com/yourpage",
  },
  nidInvalid: {
    en: "Enter a valid NID number (10, 13 or 17 digits)",
    bn: "সঠিক এনআইডি নম্বর দিন (১০, ১৩ বা ১৭ সংখ্যা)",
  },
  nidPhotoMismatch: {
    en: "The NID number you typed does not match the number on your NID photo. Check the number, or upload a clearer photo of the front of the card.",
    bn: "আপনার লেখা এনআইডি নম্বর এনআইডির ছবির নম্বরের সাথে মিলছে না। নম্বরটি আবার দেখুন, অথবা কার্ডের সামনের দিকের আরও পরিষ্কার ছবি দিন।",
  },
  nidImagesRequired: {
    en: "Upload clear photos of the front and back of your NID",
    bn: "আপনার এনআইডির সামনের ও পেছনের পরিষ্কার ছবি আপলোড করুন",
  },
  merchantApplicationPending: {
    en: "An application with this NID, email or mobile number is already waiting for review",
    bn: "এই এনআইডি, ইমেইল বা মোবাইল নম্বর দিয়ে একটি আবেদন ইতিমধ্যে যাচাইয়ের অপেক্ষায় আছে",
  },
  listingStatusInvalid: { en: "Choose to show or hide the product", bn: "পণ্যটি দেখাতে বা লুকাতে নির্বাচন করুন" },
  productHidden: { en: "Product hidden from the website", bn: "পণ্যটি ওয়েবসাইট থেকে লুকানো হয়েছে" },
  productShown: { en: "Product shown on the website again (once approved)", bn: "পণ্যটি আবার ওয়েবসাইটে দেখানো হবে (অনুমোদিত হলে)" },
  phoneLoginAmbiguous: {
    en: "More than one merchant account uses this mobile number. Sign in with your email instead.",
    bn: "এই মোবাইল নম্বর দিয়ে একাধিক মার্চেন্ট অ্যাকাউন্ট আছে। ইমেইল দিয়ে সাইন ইন করুন।",
  },
  nidRevealed: { en: "Full NID shown. This was recorded in the audit log.", bn: "পুরো এনআইডি দেখানো হয়েছে। এটি অডিট লগে রেকর্ড করা হয়েছে।" },
  merchantPhoneInUse: {
    en: "A merchant account already uses this mobile number. Add an email address to apply for another account.",
    bn: "এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি মার্চেন্ট অ্যাকাউন্ট আছে। আরেকটি অ্যাকাউন্টের জন্য একটি ইমেইল ঠিকানা দিন।",
  },
  merchantEmailInUse: {
    en: "This email already has an account. Apply with a different email.",
    bn: "এই ইমেইলে ইতিমধ্যে একটি অ্যাকাউন্ট আছে। অন্য ইমেইল দিয়ে আবেদন করুন।",
  },
  merchantApplicationsFetched: { en: "Merchant applications fetched", bn: "মার্চেন্ট আবেদনের তালিকা আনা হয়েছে" },
  merchantApplicationNotFound: { en: "Merchant application not found", bn: "মার্চেন্ট আবেদন পাওয়া যায়নি" },
  merchantApplicationDecided: {
    en: "This application has already been decided",
    bn: "এই আবেদনের সিদ্ধান্ত ইতিমধ্যে নেওয়া হয়েছে",
  },
  merchantDuplicateNid: {
    en: "This NID already belongs to a merchant. Confirm that you want to approve a second account for the same person.",
    bn: "এই এনআইডি দিয়ে ইতিমধ্যে একটি মার্চেন্ট অ্যাকাউন্ট আছে। একই ব্যক্তির দ্বিতীয় অ্যাকাউন্ট অনুমোদন করতে চাইলে নিশ্চিত করুন।",
  },
  merchantApproved: { en: "Merchant approved and account created", bn: "মার্চেন্ট অনুমোদিত হয়েছে এবং অ্যাকাউন্ট তৈরি হয়েছে" },
  merchantRejected: { en: "Merchant application rejected", bn: "মার্চেন্ট আবেদন বাতিল করা হয়েছে" },
  merchantsFetched: { en: "Merchants fetched", bn: "মার্চেন্টদের তালিকা আনা হয়েছে" },
  merchantFetched: { en: "Merchant fetched", bn: "মার্চেন্টের তথ্য আনা হয়েছে" },
  merchantNotFound: { en: "Merchant not found", bn: "মার্চেন্ট পাওয়া যায়নি" },
  merchantUpdated: { en: "Merchant updated", bn: "মার্চেন্ট হালনাগাদ হয়েছে" },
  merchantPaymentRecorded: { en: "Payment recorded", bn: "পেমেন্ট রেকর্ড করা হয়েছে" },
  merchantPaymentInvalid: {
    en: "Enter the amount paid and how many months it covers",
    bn: "পরিশোধিত টাকার পরিমাণ এবং কত মাসের জন্য তা লিখুন",
  },
  merchantRequired: { en: "Access denied. Merchant account required.", bn: "প্রবেশাধিকার নেই। মার্চেন্ট অ্যাকাউন্ট প্রয়োজন।" },
  merchantLocked: {
    en: "This merchant account is locked. Please contact N H Shop.",
    bn: "এই মার্চেন্ট অ্যাকাউন্টটি লক করা আছে। অনুগ্রহ করে এন এইচ শপের সাথে যোগাযোগ করুন।",
  },
  merchantSuspended: {
    en: "This merchant account is suspended. Your products and orders are kept safe. Submit your payment proof under Payment & subscription, or contact Help & Support, to reactivate it.",
    bn: "এই মার্চেন্ট অ্যাকাউন্টটি স্থগিত আছে। আপনার পণ্য ও অর্ডার সংরক্ষিত আছে। পুনরায় চালু করতে পেমেন্ট ও সাবস্ক্রিপশন থেকে পেমেন্টের প্রমাণ জমা দিন, অথবা হেল্প ও সাপোর্টে যোগাযোগ করুন।",
  },
  merchantPaymentDue: {
    en: "Your monthly payment is due. Pay it to add or edit products again.",
    bn: "আপনার মাসিক পেমেন্ট বাকি আছে। আবার পণ্য যোগ বা সম্পাদনা করতে পেমেন্ট করুন।",
  },
  merchantAwaitingPayment: {
    en: "Your account is approved. Pay your first monthly subscription to start adding products.",
    bn: "আপনার অ্যাকাউন্ট অনুমোদিত হয়েছে। পণ্য যোগ করা শুরু করতে প্রথম মাসের সাবস্ক্রিপশন পরিশোধ করুন।",
  },
  merchantProductSubmitted: {
    en: "Product submitted. It will appear on the website after approval.",
    bn: "পণ্য জমা হয়েছে। অনুমোদনের পর এটি ওয়েবসাইটে দেখা যাবে।",
  },
  merchantProductResubmitted: {
    en: "Product updated and sent for approval again",
    bn: "পণ্য হালনাগাদ হয়েছে এবং আবার অনুমোদনের জন্য পাঠানো হয়েছে",
  },
  productApproved: { en: "Product approved and now visible on the website", bn: "পণ্য অনুমোদিত হয়েছে এবং এখন ওয়েবসাইটে দেখা যাচ্ছে" },
  productRejected: { en: "Product rejected", bn: "পণ্য বাতিল করা হয়েছে" },
  stockInvalid: { en: "Stock must be a whole number of 0 or more", bn: "স্টক ০ বা তার বেশি পূর্ণ সংখ্যা হতে হবে" },
  outOfStock: (title, left) => ({
    en: left > 0 ? `Only ${left} left of "${title}". Reduce the quantity and try again.` : `"${title}" is out of stock`,
    bn: left > 0 ? `"${title}" মাত্র ${left} টি আছে। পরিমাণ কমিয়ে আবার চেষ্টা করুন।` : `"${title}" স্টকে নেই`,
  }),
  merchantOrderStatusInvalid: {
    en: "That status change is not allowed for this order",
    bn: "এই অর্ডারের জন্য এই অবস্থা পরিবর্তন অনুমোদিত নয়",
  },
  merchantOrderUnderReview: {
    en: "N H Shop is still verifying this order. Wait before confirming it.",
    bn: "এন এইচ শপ এখনও এই অর্ডারটি যাচাই করছে। নিশ্চিত করার আগে অপেক্ষা করুন।",
  },

  // ---- merchant payment proofs ----
  billingFetched: { en: "Subscription details fetched", bn: "সাবস্ক্রিপশনের তথ্য আনা হয়েছে" },
  paymentProofInvalid: {
    en: "Choose the payment method and enter the amount you sent and the transaction ID",
    bn: "পেমেন্ট মাধ্যম নির্বাচন করুন এবং পাঠানো টাকার পরিমাণ ও ট্রানজেকশন আইডি লিখুন",
  },
  paymentProofScreenshotRequired: { en: "Upload a screenshot of the payment", bn: "পেমেন্টের একটি স্ক্রিনশট আপলোড করুন" },
  paymentProofPending: {
    en: "You already have a payment waiting for verification. Wait for it to be checked before submitting another.",
    bn: "আপনার একটি পেমেন্ট যাচাইয়ের অপেক্ষায় আছে। আরেকটি জমা দেওয়ার আগে সেটি যাচাই হওয়া পর্যন্ত অপেক্ষা করুন।",
  },
  paymentProofDuplicate: {
    en: "This transaction ID has already been submitted",
    bn: "এই ট্রানজেকশন আইডি ইতিমধ্যে জমা দেওয়া হয়েছে",
  },
  paymentProofSubmitted: {
    en: "Payment proof submitted. Your account will be activated after N H Shop verifies it.",
    bn: "পেমেন্টের প্রমাণ জমা হয়েছে। এন এইচ শপ যাচাই করার পর আপনার অ্যাকাউন্ট সক্রিয় হবে।",
  },
  paymentProofsFetched: { en: "Payment proofs fetched", bn: "পেমেন্টের প্রমাণের তালিকা আনা হয়েছে" },
  paymentProofNotFound: { en: "Payment proof not found", bn: "পেমেন্টের প্রমাণ পাওয়া যায়নি" },
  paymentProofDecided: {
    en: "This payment proof has already been decided",
    bn: "এই পেমেন্টের প্রমাণের সিদ্ধান্ত ইতিমধ্যে নেওয়া হয়েছে",
  },
  paymentProofApproved: {
    en: "Payment approved. Press Activate account to start the new subscription period.",
    bn: "পেমেন্ট অনুমোদিত হয়েছে। নতুন সাবস্ক্রিপশন শুরু করতে অ্যাকাউন্ট সক্রিয় করুন চাপুন।",
  },
  paymentProofRejected: { en: "Payment rejected and the merchant informed", bn: "পেমেন্ট বাতিল করা হয়েছে এবং মার্চেন্টকে জানানো হয়েছে" },
  paymentProofReasonRequired: {
    en: "Write the reason so the merchant knows what to fix",
    bn: "কারণ লিখুন, যাতে মার্চেন্ট বুঝতে পারেন কী ঠিক করতে হবে",
  },
  paymentProofNotApproved: {
    en: "Approve the payment before activating the account",
    bn: "অ্যাকাউন্ট সক্রিয় করার আগে পেমেন্ট অনুমোদন করুন",
  },
  merchantActivated: { en: "Account activated and the new subscription period started", bn: "অ্যাকাউন্ট সক্রিয় হয়েছে এবং নতুন সাবস্ক্রিপশন শুরু হয়েছে" },

  merchantProductNotDeletable: {
    en: "Merchant products are kept permanently. Reject the product instead, or suspend the merchant to hide all of their products.",
    bn: "মার্চেন্টের পণ্য স্থায়ীভাবে সংরক্ষিত থাকে। এর বদলে পণ্যটি বাতিল করুন, অথবা সব পণ্য লুকাতে মার্চেন্টকে স্থগিত করুন।",
  },

  // ---- support tickets ----
  ticketsFetched: { en: "Support requests fetched", bn: "সাপোর্ট অনুরোধের তালিকা আনা হয়েছে" },
  ticketFetched: { en: "Support request fetched", bn: "সাপোর্ট অনুরোধ আনা হয়েছে" },
  ticketNotFound: { en: "Support request not found", bn: "সাপোর্ট অনুরোধ পাওয়া যায়নি" },
  ticketInvalid: {
    en: "Write a subject and describe the problem",
    bn: "একটি বিষয় লিখুন এবং সমস্যার বিবরণ দিন",
  },
  ticketMessageRequired: {
    en: "Write a message or attach a picture or voice recording",
    bn: "একটি বার্তা লিখুন অথবা ছবি বা ভয়েস রেকর্ডিং যুক্ত করুন",
  },
  ticketTooManyOpen: {
    en: "You have too many open support requests. Reply in an existing one instead.",
    bn: "আপনার অনেকগুলো সাপোর্ট অনুরোধ খোলা আছে। নতুনটির বদলে আগেরটিতে উত্তর দিন।",
  },
  ticketTooLong: {
    en: "This conversation is too long. Please open a new support request.",
    bn: "এই কথোপকথনটি অনেক বড় হয়ে গেছে। অনুগ্রহ করে নতুন সাপোর্ট অনুরোধ খুলুন।",
  },
  ticketCreated: { en: "Support request sent. We will reply here.", bn: "সাপোর্ট অনুরোধ পাঠানো হয়েছে। আমরা এখানেই উত্তর দেব।" },
  ticketReplied: { en: "Reply sent", bn: "উত্তর পাঠানো হয়েছে" },
  ticketUpdated: { en: "Support request updated", bn: "সাপোর্ট অনুরোধ হালনাগাদ হয়েছে" },
  ticketStatusInvalid: { en: "Choose Open, In progress or Resolved", bn: "খোলা, চলমান অথবা সমাধান হয়েছে নির্বাচন করুন" },

  // ---- uploads ----
  attachmentInvalidType: {
    en: "Only PNG, JPEG or WebP pictures and MP3, M4A, WAV, OGG or WebM audio are allowed",
    bn: "শুধুমাত্র PNG, JPEG বা WebP ছবি এবং MP3, M4A, WAV, OGG বা WebM অডিও আপলোড করা যাবে",
  },
  attachmentTooLarge: {
    en: "Pictures can be up to 5 MB and audio up to 10 MB",
    bn: "ছবি সর্বোচ্চ ৫ এমবি এবং অডিও সর্বোচ্চ ১০ এমবি হতে পারে",
  },
  attachmentTooMany: {
    en: "Attach up to 3 pictures and 1 audio file",
    bn: "সর্বোচ্চ ৩টি ছবি এবং ১টি অডিও ফাইল যুক্ত করা যাবে",
  },

  // ---- notifications and audit ----
  notificationsFetched: { en: "Notifications fetched", bn: "নোটিফিকেশন আনা হয়েছে" },
  notificationsRead: { en: "Notifications marked as read", bn: "নোটিফিকেশন পড়া হয়েছে হিসেবে চিহ্নিত" },
  auditFetched: { en: "Audit log fetched", bn: "অডিট লগ আনা হয়েছে" },

  // ---- misc ----
  visitRecorded: { en: "Visit recorded", bn: "ভিজিট রেকর্ড করা হয়েছে" },
  visitorKeyRequired: { en: "A visitor key is required", bn: "ভিজিটর কী প্রয়োজন" },
  dashboardFetched: { en: "Dashboard data fetched successfully", bn: "ড্যাশবোর্ডের তথ্য সফলভাবে আনা হয়েছে" },
  analyticsFetched: { en: "Analytics fetched successfully", bn: "অ্যানালিটিক্স সফলভাবে আনা হয়েছে" },
  reportFetched: { en: "Report fetched successfully", bn: "হিসাব সফলভাবে আনা হয়েছে" },
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
