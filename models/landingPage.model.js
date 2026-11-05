const mongoose = require("mongoose");

const landingProductSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    weight: { type: String, required: true, trim: true, maxlength: 50, default: "" },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, trim: true, default: "" },
    imageId: { type: String, default: "" },
  },
  { _id: false }
);

const landingBannerImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    imageId: { type: String, default: "" },
  },
  { _id: false }
);

const landingPageSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: "store", unique: true },
    bannerTitle: { type: String, trim: true, maxlength: 200, default: "আপনার রাতের যত্নে প্রাকৃতিক ছোঁয়া" },
    bannerText: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "আপনার নতুন শয়নকালীন অভ্যাসের সাথে পরিচিত হোন: ভেষজ উপাদানের সুচিন্তিত মিশ্রণে তৈরি ল্যাভেন্ডার-সুগন্ধি এক প্রশান্তিদায়ক ম্যাসাজ বাম।",
    },
    bannerImage: { type: String, trim: true, default: "/slide1.jpg" },
    bannerImageId: { type: String, default: "" },
    bannerImages: { type: [landingBannerImageSchema], default: [] },
    products: {
      type: [landingProductSchema],
      default: [
        { code: "15g", name: "Green Seven Sleep Balm", title: "Pocket size", price: 570 },
        { code: "20g", name: "Green Seven Sleep Balm", title: "Everyday jar", price: 599 },
        { code: "50g", name: "Green Seven Sleep Balm", title: "The full ritual", price: 1050 },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LandingPage", landingPageSchema);
