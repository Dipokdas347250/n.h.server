const fs = require("fs");
const LandingPage = require("../models/landingPage.model");
const LandingOrder = require("../models/landingOrder.model");
const Setting = require("../models/setting.model");
const cloudinary = require("../utils/cloudinary");
const { apiResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { normalizePhone, isValidBdPhone } = require("../utils/fraudCheck");
const { resolveDelivery } = require("../utils/delivery");

const orderStatuses = ["pending", "confirmed", "delivered", "cancelled"];
const responseMessage = (en, bn) => ({ en, bn });

const getLandingPage = async () => {
  return LandingPage.findOneAndUpdate(
    { singleton: "store" },
    { $setOnInsert: { singleton: "store" } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const landingPageView = (page, deliveryZones) => {
  const view = page.toObject();
  delete view.bannerImageId;
  const bannerImages = view.bannerImages?.length
    ? view.bannerImages
    : view.bannerImage
      ? [{ url: view.bannerImage }]
      : [];
  view.bannerImages = bannerImages.map(({ url }) => ({ url }));
  view.bannerImage = bannerImages[0]?.url || "";
  view.products = view.products.map((product) => {
    const item = { ...product };
    delete item.imageId;
    return item;
  });
  view.deliveryZones = deliveryZones;
  return view;
};

const cleanProduct = (product, previous, code) => ({
  code,
  name: String(product?.name || "").trim(),
  title: String(product?.title || "").trim(),
  weight: String(product?.weight || "").trim(),
  price: Number(product?.price),
  image: previous?.image || "",
  imageId: previous?.imageId || "",
});

exports.publicLandingPageController = asyncHandler(async (req, res) => {
  const [page, settings] = await Promise.all([getLandingPage(), Setting.getSettings()]);
  const deliveryZones = (settings.deliveryZones?.length ? settings.deliveryZones : Setting.DEFAULT_ZONES).map((zone) => ({
    key: zone.key,
    label: zone.label,
    labelBn: zone.labelBn,
    charge: Number(zone.charge || 0),
  }));
  apiResponse(res, 200, responseMessage("Landing page content fetched", "ল্যান্ডিং পেজের তথ্য আনা হয়েছে"), landingPageView(page, deliveryZones));
});

const uploadedFiles = (req) => Object.values(req.files || {}).flat();

const removeTemporaryFiles = (files) => {
  files.forEach((file) => fs.unlink(file.path, (error) => {
    if (error) console.error("Could not remove temporary landing-page image:", error.message);
  }));
};

exports.updateLandingPageController = asyncHandler(async (req, res) => {
  const page = await getLandingPage();
  const files = uploadedFiles(req);
  const uploadedAssets = [];
  const replacedAssetIds = [];
  let settings;
  let pageSaved = false;

  try {

  if (req.body.bannerTitle !== undefined) {
    const bannerTitle = String(req.body.bannerTitle).trim();
    if (!bannerTitle || bannerTitle.length > 200) {
      return apiResponse(res, 400, responseMessage("Banner title is required and must be 200 characters or fewer", "ব্যানারের শিরোনাম দিতে হবে এবং তা ২০০ অক্ষরের মধ্যে হতে হবে"));
    }
    page.bannerTitle = bannerTitle;
  }

  if (req.body.bannerText !== undefined) {
    const bannerText = String(req.body.bannerText).trim();
    if (!bannerText || bannerText.length > 1000) {
      return apiResponse(res, 400, responseMessage("Banner text is required and must be 1000 characters or fewer", "ব্যানারের লেখা দিতে হবে এবং তা ১০০০ অক্ষরের মধ্যে হতে হবে"));
    }
    page.bannerText = bannerText;
  }

  let products = req.body.products;
  if (typeof products === "string") {
    try {
      products = JSON.parse(products);
    } catch {
      return apiResponse(res, 400, responseMessage("Products must be valid JSON", "পণ্যের তথ্য সঠিক JSON হতে হবে"));
    }
  }
  if (products !== undefined) {
    if (!Array.isArray(products) || products.length !== 3) {
      return apiResponse(res, 400, responseMessage("Exactly three products are required", "ঠিক তিনটি পণ্যের তথ্য দিতে হবে"));
    }
    const cleaned = products.map((product, index) => cleanProduct(product, page.products[index], page.products[index]?.code || ["15g", "20g", "50g"][index]));
    if (cleaned.some((product, index) =>
      products[index]?.price === "" ||
      products[index]?.price === null ||
      !product.name ||
      !product.title ||
      !product.weight ||
      product.name.length > 120 ||
      product.title.length > 120 ||
      product.weight.length > 50 ||
      !Number.isFinite(product.price) ||
      product.price < 0
    )) {
      return apiResponse(res, 400, responseMessage(
        "Each product needs a name, title, fixed weight, and non-negative price",
        "প্রতিটি পণ্যের নাম, শিরোনাম, নির্দিষ্ট ওজন এবং শূন্য বা তার বেশি দাম দিতে হবে"
      ));
    }
    page.products = cleaned;
  }

  const bannerFiles = req.files?.bannerImages || (req.files?.bannerImage ? [req.files.bannerImage[0]] : []);
  if (bannerFiles.length) {
    replacedAssetIds.push(page.bannerImageId, ...page.bannerImages.map((item) => item.imageId));
    const newBannerImages = [];
    for (const file of bannerFiles) {
      const uploadResult = await cloudinary.uploader.upload(file.path, { folder: "nh-shop/landing-page" });
      uploadedAssets.push(uploadResult.public_id);
      newBannerImages.push({
        url: uploadResult.secure_url || uploadResult.url,
        imageId: uploadResult.public_id,
      });
    }
    page.bannerImages = newBannerImages;
    page.bannerImage = newBannerImages[0].url;
    page.bannerImageId = newBannerImages[0].imageId;
  } else if (req.body.removeBannerImages === "true") {
    replacedAssetIds.push(page.bannerImageId, ...page.bannerImages.map((item) => item.imageId));
    page.bannerImages = [];
    page.bannerImage = "";
    page.bannerImageId = "";
  }

  if (products !== undefined) {
    page.products = await Promise.all(page.products.map(async (product, index) => {
      const file = req.files?.[`productImage${index}`]?.[0];
      if (file) {
        const uploadResult = await cloudinary.uploader.upload(file.path, { folder: "nh-shop/landing-products" });
        uploadedAssets.push(uploadResult.public_id);
        if (product.imageId) replacedAssetIds.push(product.imageId);
        product.image = uploadResult.secure_url || uploadResult.url;
        product.imageId = uploadResult.public_id;
      } else if (req.body[`removeProductImage${index}`] === "true") {
        if (product.imageId) replacedAssetIds.push(product.imageId);
        product.image = "";
        product.imageId = "";
      }
      return product;
    }));
  }

  if (req.body.deliveryZones !== undefined) {
    let deliveryZones = req.body.deliveryZones;
    if (typeof deliveryZones === "string") {
      try {
        deliveryZones = JSON.parse(deliveryZones);
      } catch {
        return apiResponse(res, 400, responseMessage("Delivery areas must be valid JSON", "ডেলিভারি এলাকার তথ্য সঠিক JSON হতে হবে"));
      }
    }
    if (!Array.isArray(deliveryZones) || !deliveryZones.length) {
      return apiResponse(res, 400, responseMessage("At least one delivery area is required", "অন্তত একটি ডেলিভারি এলাকা দিতে হবে"));
    }
    const keys = new Set();
    const cleanedZones = deliveryZones.map((zone) => {
      const key = String(zone?.key || "").trim();
      const label = String(zone?.label || "").trim();
      const labelBn = String(zone?.labelBn || "").trim();
      const charge = Number(zone?.charge);
      if (
        !/^[a-z0-9_-]{2,40}$/.test(key) ||
        keys.has(key) ||
        !label ||
        !labelBn ||
        label.length > 100 ||
        labelBn.length > 100 ||
        zone?.charge === "" ||
        !Number.isFinite(charge) ||
        charge < 0
      ) return null;
      keys.add(key);
      return {
        key,
        label,
        labelBn,
        charge,
        estimatedDays: String(zone.estimatedDays || "2-3"),
        estimatedDaysBn: String(zone.estimatedDaysBn || "২-৩"),
      };
    });
    if (cleanedZones.some((zone) => !zone)) {
      return apiResponse(res, 400, responseMessage(
        "Each delivery area needs a unique key, English and Bangla labels, and a non-negative charge",
        "প্রতিটি ডেলিভারি এলাকার স্বতন্ত্র কী, ইংরেজি ও বাংলা নাম এবং শূন্য বা তার বেশি চার্জ দিতে হবে"
      ));
    }
    settings = await Setting.getSettings();
    settings.deliveryZones = cleanedZones;
  }

  await page.save();
  pageSaved = true;
  if (settings) await settings.save();

  for (const assetId of new Set(replacedAssetIds.filter(Boolean))) {
    if (assetId) {
      await cloudinary.uploader.destroy(assetId).catch((error) => {
        console.error("Could not remove previous landing-page image:", error.message);
      });
    }
  }
  settings ||= await Setting.getSettings();
  const deliveryZones = (settings.deliveryZones?.length ? settings.deliveryZones : Setting.DEFAULT_ZONES).map((zone) => ({
    key: zone.key,
    label: zone.label,
    labelBn: zone.labelBn,
    charge: Number(zone.charge || 0),
  }));
  apiResponse(res, 200, responseMessage("Landing page content updated", "ল্যান্ডিং পেজের তথ্য হালনাগাদ হয়েছে"), landingPageView(page, deliveryZones));
  } catch (error) {
    if (!pageSaved) {
      await Promise.all(uploadedAssets.filter(Boolean).map((assetId) =>
        cloudinary.uploader.destroy(assetId).catch((cleanupError) => {
          console.error("Could not remove an unsaved landing-page image:", cleanupError.message);
        })
      ));
    }
    throw error;
  } finally {
    removeTemporaryFiles(files);
  }
});

const buildOrderNumber = async () => {
  const date = new Date();
  const stamp = `${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const number = `LP-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await LandingOrder.exists({ orderNumber: number }))) return number;
  }
  return `LP-${stamp}-${Date.now().toString().slice(-6)}`;
};

exports.createLandingOrderController = asyncHandler(async (req, res) => {
  const page = await getLandingPage();
  const { customer = {}, productCode, quantity: rawQuantity, deliveryZone } = req.body || {};
  const product = page.products.find((item) => item.code === String(productCode || ""));
  if (!product) return apiResponse(res, 400, responseMessage("Choose a valid product", "সঠিক পণ্য নির্বাচন করুন"));

  const quantity = Number(rawQuantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return apiResponse(res, 400, responseMessage("Quantity must be between 1 and 50", "পরিমাণ ১ থেকে ৫০-এর মধ্যে হতে হবে"));
  }

  const normalizedCustomer = {
    name: String(customer.name || "").trim(),
    phone: normalizePhone(customer.phone),
    address: String(customer.address || "").trim(),
    city: String(customer.city || "").trim(),
  };
  if (
    !normalizedCustomer.name ||
    normalizedCustomer.name.length > 120 ||
    !normalizedCustomer.phone ||
    !normalizedCustomer.address ||
    normalizedCustomer.address.length > 500 ||
    !normalizedCustomer.city ||
    normalizedCustomer.city.length > 120
  ) {
    return apiResponse(res, 400, responseMessage(
      "Name, valid phone, delivery address, and city are required",
      "নাম, সঠিক ফোন নম্বর, ডেলিভারির ঠিকানা এবং শহর দিতে হবে"
    ));
  }
  if (!isValidBdPhone(normalizedCustomer.phone)) {
    return apiResponse(res, 400, responseMessage("Enter a valid Bangladesh phone number", "সঠিক বাংলাদেশি মোবাইল নম্বর দিন"));
  }

  const subtotal = product.price * quantity;
  const settings = await Setting.getSettings();
  const zoneKey = String(deliveryZone || "inside_dhaka");
  const zones = settings.deliveryZones?.length ? settings.deliveryZones : Setting.DEFAULT_ZONES;
  if (!zones.some((zone) => zone.key === zoneKey)) {
    return apiResponse(res, 400, responseMessage("Choose a valid delivery area", "সঠিক ডেলিভারি এলাকা নির্বাচন করুন"));
  }
  const delivery = resolveDelivery(settings, zoneKey, subtotal);
  const order = await LandingOrder.create({
    orderNumber: await buildOrderNumber(),
    customer: normalizedCustomer,
    product: {
      code: product.code,
      name: product.name,
      title: product.title,
      weight: product.weight,
      image: product.image,
      unitPrice: product.price,
    },
    quantity,
    deliveryZone: delivery.zone.key,
    deliveryZoneLabel: delivery.zone.label,
    deliveryCharge: delivery.charge,
    subtotal,
    total: subtotal + delivery.charge,
  });
  apiResponse(res, 201, responseMessage("Your landing page order was received", "আপনার ল্যান্ডিং পেজের অর্ডার গ্রহণ করা হয়েছে"), order);
});

exports.allLandingOrdersController = asyncHandler(async (req, res) => {
  const orders = await LandingOrder.find({}).sort({ createdAt: -1 }).limit(200);
  apiResponse(res, 200, responseMessage("Landing page orders fetched", "ল্যান্ডিং পেজের অর্ডার আনা হয়েছে"), orders);
});

exports.updateLandingOrderController = asyncHandler(async (req, res) => {
  if (!orderStatuses.includes(req.body?.status)) {
    return apiResponse(res, 400, responseMessage("Choose a valid order status", "সঠিক অর্ডার অবস্থা নির্বাচন করুন"));
  }
  const order = await LandingOrder.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true, runValidators: true }
  );
  if (!order) return apiResponse(res, 404, responseMessage("Landing page order not found", "ল্যান্ডিং পেজের অর্ডার পাওয়া যায়নি"));
  apiResponse(res, 200, responseMessage("Landing page order updated", "ল্যান্ডিং পেজের অর্ডারের অবস্থা হালনাগাদ হয়েছে"), order);
});
