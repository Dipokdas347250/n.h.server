/*
 * Acceptance tests for the merchant system — one `describe` per acceptance
 * criterion in the requirements (1–14). They drive the real API over HTTP.
 *
 *   npm run test:acceptance
 *
 * By default an in-memory MongoDB is started and thrown away. To run against
 * a staging database instead, set TEST_DB_URL — never point it at production:
 * the suite creates accounts, orders and products.
 *
 * Cloudinary is replaced by a stub, so no files are uploaded anywhere and no
 * keys are needed. Email is switched off. The NID photo check runs for real
 * (it downloads its language data once).
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const PORT = 18600 + Math.floor(Math.random() * 300);
const BASE = `http://localhost:${PORT}/api/v1/api`;
const ORIGIN = "http://localhost:5173";
const DAY = 24 * 60 * 60 * 1000;
const FIXTURES = path.join(__dirname, "fixtures");
const PNG = Buffer.from(
  "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8FFFF3F0005FE02FEA7D6A4E50000000049454E44AE426082",
  "hex"
);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200, 1)]);

let memoryServer;
let models;
let jobs;

/** A cookie-keeping HTTP client, one per signed-in person. */
const client = () => {
  let cookie = "";
  return async (method, url, body) => {
    const options = { method, headers: { Origin: ORIGIN } };
    if (cookie) options.headers.Cookie = cookie;
    if (body instanceof FormData) options.body = body;
    else if (body) {
      options.body = JSON.stringify(body);
      options.headers["Content-Type"] = "application/json";
    }
    const response = await fetch(BASE + url, options);
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { status: response.status, ...(await response.json().catch(() => ({}))) };
  };
};

const form = (fields, files = []) => {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  files.forEach(([key, buffer, type, name]) => data.append(key, new Blob([buffer], { type }), name));
  return data;
};

const login = async (http, email, password = "password123") => {
  const response = await http("POST", "/auth/login", { email, password, scope: "dashboard" });
  assert.equal(response.status, 200, `login ${email}: ${response.message}`);
};

const apply = (http, fields, nidFile = "nid-1234567890.png") => {
  const photo = fs.readFileSync(path.join(FIXTURES, nidFile));
  return http(
    "POST",
    "/merchant/apply",
    form(
      { fullname: "Test Seller", phone: "01711111111", businessName: "Test Shop", address: "House 1, Road 2, Dhanmondi, Dhaka", productType: "Bags", nidNumber: "1234567890", password: "password123", ...fields },
      [["nidFront", photo, "image/png", "front.png"], ["nidBack", photo, "image/png", "back.png"]]
    )
  );
};

<<<<<<< HEAD
const today = () => new Date().toISOString().slice(0, 10);

const proof = (http, transactionId, amount = "500", fields = {}) =>
  http("POST", "/merchant/payment-submissions", form({ method: "bkash", amount, transactionId, paidAt: today(), ...fields }, [["screenshot", PNG, "image/png", "s.png"]]));
=======
const proof = (http, transactionId, amount = "500") =>
  http("POST", "/merchant/payment-submissions", form({ method: "bkash", amount, transactionId }, [["screenshot", PNG, "image/png", "s.png"]]));
>>>>>>> origin/main

/** Moves a merchant's dates as if `days` had passed, then runs the scheduled job. */
const timeTravel = async (merchantId, days) => {
  const merchant = await models.Merchant.findById(merchantId).lean();
  const shift = (date) => (date ? new Date(new Date(date).getTime() - days * DAY) : date);
  await models.Merchant.collection.updateOne(
    { _id: merchant._id },
    { $set: { trialEndsAt: shift(merchant.trialEndsAt), paidUntil: shift(merchant.paidUntil), graceEndsAt: shift(merchant.graceEndsAt), trialStartsAt: shift(merchant.trialStartsAt) } }
  );
  await jobs.runMerchantBillingJob();
};

const admin = client();
const alice = client();
const bob = client();
const guest = client();
let aliceMerchant;
let bobMerchant;
let aliceProduct;
let hiddenProduct;
let rejectedProduct;

before(async () => {
  let url = process.env.TEST_DB_URL;
  if (!url) {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    url = `${memoryServer.getUri()}nh-shop-acceptance`;
  }
  Object.assign(process.env, {
    DB_DATA_URL: url,
    PORT: String(PORT),
    SESSION_SECRET: "acceptance-test-secret",
    NID_ENCRYPTION_KEY: "acceptance-test-nid-key",
    CORS_ORIGINS: ORIGIN,
    AUTH_EMAIL: "",
    NODE_ENV: "test",
  });

  const cloudinary = require("../utils/cloudinary");
  cloudinary.config({ cloud_name: "test", api_key: "test", api_secret: "test" });
  let uploads = 0;
  cloudinary.uploader.upload = async (file, options) => {
    if (options.folder && /merchant-private|merchant-nid/.test(options.folder)) assert.equal(options.type, "authenticated", "private files must be uploaded as authenticated");
    uploads += 1;
    return { public_id: `${options.folder || "test"}/file-${uploads}`, format: "png", bytes: 100, secure_url: `https://example.test/${uploads}.png` };
  };
  cloudinary.uploader.destroy = async () => ({});

  require("../index.js");
  const mongoose = require("mongoose");
  if (mongoose.connection.readyState !== 1) await new Promise((resolve) => mongoose.connection.once("open", resolve));
  await new Promise((resolve) => setTimeout(resolve, 1000));

  models = {
    User: require("../models/user.model"),
    Merchant: require("../models/merchant.model"),
    Application: require("../models/merchantApplication.model"),
    Product: require("../models/product.model"),
    Category: require("../models/categore.model"),
    Order: require("../models/checkout.model"),
    Submission: require("../models/paymentSubmission.model"),
    Subscription: require("../models/subscription.model"),
    Notification: require("../models/notification.model"),
    Ticket: require("../models/supportTicket.model"),
    Audit: require("../models/auditLog.model"),
    JobLock: require("../models/jobLock.model"),
    Setting: require("../models/setting.model"),
<<<<<<< HEAD
    LandingPage: require("../models/landingPage.model"),
    LandingOrder: require("../models/landingOrder.model"),
=======
>>>>>>> origin/main
  };
  jobs = require("../utils/merchant");

  const bcrypt = require("bcrypt");
  await models.User.create({ fullname: "Admin", email: "admin@test.local", password: await bcrypt.hash("password123", 10), role: "admin", verified: true });
  await login(admin, "admin@test.local");
});

<<<<<<< HEAD
describe("Standalone landing page", () => {
  it("serves public content while keeping content management admin-only", async () => {
    const response = await guest("GET", "/landing-page");
    assert.equal(response.status, 200);
    assert.equal(response.data.products.length, 3);
    assert.equal((await guest("PATCH", "/landing-page", { bannerTitle: "Not allowed" })).status, 401);

    const products = [
      { name: "Sleep Balm", title: "Pocket", weight: "25 g", price: 777 },
      { name: "Sleep Balm", title: "Everyday", weight: "40 g", price: 888 },
      { name: "Sleep Balm", title: "Full", weight: "75 g", price: 999 },
    ];
    const updated = await admin("PATCH", "/landing-page", {
      bannerTitle: "A managed banner",
      bannerText: "Managed landing page copy",
      products,
      deliveryZones: [
        { key: "inside_dhaka", label: "Inside Dhaka", labelBn: "ঢাকার ভেতরে", charge: 75 },
        { key: "dhaka_suburb", label: "Dhaka suburb", labelBn: "ঢাকার আশপাশ", charge: 95 },
        { key: "outside_dhaka", label: "Outside Dhaka", labelBn: "ঢাকার বাইরে", charge: 140 },
      ],
    });
    assert.equal(updated.status, 200, updated.message);
    assert.equal(updated.data.bannerTitle, "A managed banner");
    assert.equal(updated.data.products[0].price, 777);
    assert.equal(updated.data.products[0].weight, "25 g");
    assert.equal(updated.data.products[0].village, undefined);
    assert.equal(updated.data.deliveryZones[0].charge, 75);
  });

  it("uploads banner and product images and keeps internal asset ids private", async () => {
    const products = [
      { name: "Sleep Balm", title: "Pocket", weight: "25 g", price: 777 },
      { name: "Sleep Balm", title: "Everyday", weight: "40 g", price: 888 },
      { name: "Sleep Balm", title: "Full", weight: "75 g", price: 999 },
    ];
    const updated = await admin("PATCH", "/landing-page", form(
      { bannerTitle: "Uploaded banner", bannerText: "Image test", products: JSON.stringify(products) },
      [["bannerImage", PNG, "image/png", "banner.png"], ["productImage0", PNG, "image/png", "product.png"]]
    ));
    assert.equal(updated.status, 200, updated.message);
    assert.match(updated.data.bannerImage, /^https:\/\/example\.test\//);
    assert.equal(updated.data.bannerImageId, undefined);
    assert.match(updated.data.products[0].image, /^https:\/\/example\.test\//);
    assert.equal(updated.data.products[0].imageId, undefined);
    const publicPage = await guest("GET", "/landing-page");
    assert.equal(publicPage.data.bannerImage, updated.data.bannerImage);
    assert.equal(publicPage.data.bannerImageId, undefined);
    assert.equal(publicPage.data.products[0].image, updated.data.products[0].image);
    assert.equal(publicPage.data.products[0].imageId, undefined);

    const gallery = await admin("PATCH", "/landing-page", form({}, [
      ["bannerImages", PNG, "image/png", "banner-one.png"],
      ["bannerImages", PNG, "image/png", "banner-two.png"],
    ]));
    assert.equal(gallery.status, 200, gallery.message);
    assert.equal(gallery.data.bannerImages.length, 2);
    assert.equal(gallery.data.bannerImage, gallery.data.bannerImages[0].url);
    assert.equal(gallery.data.bannerImages[0].imageId, undefined);
    const publicGallery = await guest("GET", "/landing-page");
    assert.equal(publicGallery.data.bannerImages.length, 2);
    assert.equal(publicGallery.data.bannerImages[1].imageId, undefined);

    const cleared = await admin("PATCH", "/landing-page", form({ removeBannerImages: "true" }));
    assert.equal(cleared.status, 200, cleared.message);
    assert.deepEqual(cleared.data.bannerImages, []);
    assert.equal(cleared.data.bannerImage, "");
  });

  it("records customer details using server-side product and delivery prices", async () => {
    const placed = await guest("POST", "/landing-page/orders", {
      productCode: "15g",
      quantity: 2,
      deliveryZone: "inside_dhaka",
      customer: {
        name: "Landing Customer",
        phone: "01712345678",
        address: "House 10 Road 2 Dhanmondi",
        city: "Dhaka",
      },
    });
    assert.equal(placed.status, 201, placed.message);
    assert.match(placed.data.orderNumber, /^LP-/);
    assert.equal(placed.data.product.unitPrice, 777);
    assert.equal(placed.data.product.weight, "25 g");
    assert.equal(placed.data.product.image, (await models.LandingPage.findOne({ singleton: "store" })).products[0].image);
    assert.equal(placed.data.subtotal, 1554);
    assert.equal(placed.data.deliveryCharge, 75);
    assert.equal(placed.data.total, 1629);
    assert.equal(placed.data.customer.phone, "01712345678");
    assert.equal((await models.LandingOrder.findById(placed.data._id)).status, "pending");
    assert.equal((await guest("GET", "/landing-page/orders")).status, 401);

    const inbox = await admin("GET", "/landing-page/orders");
    assert.equal(inbox.status, 200);
    assert.ok(inbox.data.some((order) => order._id === placed.data._id));
    const updated = await admin("PATCH", `/landing-page/orders/${placed.data._id}`, { status: "confirmed" });
    assert.equal(updated.status, 200, updated.message);
    assert.equal(updated.data.status, "confirmed");
    assert.equal((await admin("PATCH", `/landing-page/orders/${placed.data._id}`, { status: "invalid" })).status, 400);
  });

  it("rejects orders with invalid delivery areas", async () => {
    const invalidZone = await guest("POST", "/landing-page/orders", {
      productCode: "15g",
      quantity: 1,
      deliveryZone: "free_delivery",
      customer: {
        name: "Landing Customer",
        phone: "01712345678",
        address: "House 10 Road 2 Dhanmondi",
        city: "Dhaka",
      },
    });
    assert.equal(invalidZone.status, 400);
  });
});

=======
>>>>>>> origin/main
after(async () => {
  const mongoose = require("mongoose");
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  setTimeout(() => process.exit(0), 100).unref();
});

describe("1. New merchant registration and admin approval", () => {
  it("refuses an application whose NID number does not match the card photo", async () => {
    const response = await apply(guest, { email: "x@test.local", phone: "01700000001" }, "nid-9876543210.png");
    assert.equal(response.status, 400);
    assert.match(response.message, /does not match/);
  });

  it("accepts an application with business name and address and no email, stored as pending", async () => {
    const response = await apply(guest, { phone: "01711111111", nidNumber: "1234567890" });
    assert.equal(response.status, 201, response.message);
    const application = await models.Application.findById(response.data._id).select("+nidEncrypted +nidNumber").lean();
    assert.equal(application.status, "pending");
    assert.equal(application.businessName, "Test Shop");
    assert.equal(application.nidCheck.status, "matched");
    assert.equal(application.nidNumber, undefined, "NID must not be stored in plain text");
    assert.ok(application.nidEncrypted && application.nidHash && application.nidLast4 === "7890");
  });

  it("notifies administrators and shows only the masked NID", async () => {
    const notes = await admin("GET", "/admin/notifications");
    assert.ok(notes.data.latest.some((note) => note.type === "merchant_application"));
    const list = await admin("GET", "/admin/merchant-applications");
    const application = list.data.applications[0];
    assert.equal(application.nidMasked, "••••••7890");
    assert.equal(JSON.stringify(list).includes("1234567890"), false, "full NID must not be in the list");
  });

  it("reveals the full NID only on request, and audits it", async () => {
    const list = await admin("GET", "/admin/merchant-applications");
    const reveal = await admin("GET", `/admin/merchant-applications/${list.data.applications[0]._id}/nid`);
    assert.equal(reveal.data.nidNumber, "1234567890");
    assert.ok(await models.Audit.exists({ action: "nid.viewed" }));
  });

  it("approves the application and the merchant signs in with the mobile number", async () => {
    const list = await admin("GET", "/admin/merchant-applications");
    const approved = await admin("POST", `/admin/merchant-applications/${list.data.applications[0]._id}/approve`, { monthlyFee: 500 });
    assert.equal(approved.status, 201, approved.message);
    aliceMerchant = approved.data._id;
    await login(alice, "01711111111");
    const me = await alice("GET", "/merchant/me");
    assert.equal(me.data.businessName, "Test Shop");
  });
});

describe("2. Seven-day free trial", () => {
  it("starts on approval with start and end dates stored", async () => {
    const merchant = await models.Merchant.findById(aliceMerchant).lean();
    assert.equal(merchant.status, "trial");
    assert.ok(merchant.trialStartsAt && merchant.trialEndsAt);
    assert.equal(Math.round((merchant.trialEndsAt - merchant.trialStartsAt) / DAY), 7);
    assert.ok(await models.Subscription.exists({ merchant: aliceMerchant, kind: "trial", source: "approval" }));
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "trial_started" }));
  });

  it("sends a second application with the same NID to manual review without a free trial", async () => {
    const response = await apply(guest, { email: "second@test.local", phone: "01822222222", nidNumber: "1234567890" });
    assert.equal(response.status, 201, response.message);
    const application = await models.Application.findById(response.data._id).lean();
    assert.equal(application.duplicateNid, true);
    const refused = await admin("POST", `/admin/merchant-applications/${application._id}/approve`, {});
    assert.equal(refused.status, 409, "needs the administrator's explicit confirmation");
    const approved = await admin("POST", `/admin/merchant-applications/${application._id}/approve`, { allowDuplicateNid: true });
    assert.equal(approved.status, 201);
    assert.equal(approved.data.status, "approved", "no free trial for a second account");
    bobMerchant = approved.data._id;
    await login(bob, "second@test.local");
  });
});

describe("3. Reminders before the subscription ends", () => {
  it("sends the 3-day reminder to merchant and admin, once", async () => {
    await timeTravel(aliceMerchant, 4.5); // 2.5 days of trial left
    await jobs.runMerchantBillingJob();
    const merchantNotes = await models.Notification.find({ merchant: aliceMerchant, type: "trial_ending" }).lean();
    assert.equal(merchantNotes.length, 1);
    assert.equal(merchantNotes[0].params.days, 3);
    assert.equal(await models.Notification.countDocuments({ type: "merchant_expiring", merchant: aliceMerchant }), 1);
  });

  it("sends the 1-day reminder", async () => {
    await timeTravel(aliceMerchant, 2); // 0.5 days left
    const notes = await models.Notification.find({ merchant: aliceMerchant, type: "trial_ending" }).lean();
    assert.deepEqual(notes.map((note) => note.params.days).sort(), [1, 3]);
  });

  it("on the expiry day: payment due with a 3-day grace period, merchant and admin told", async () => {
    await timeTravel(aliceMerchant, 1);
    const merchant = await models.Merchant.findById(aliceMerchant).lean();
    assert.equal(merchant.status, "payment_due");
    assert.ok(Math.abs(merchant.graceEndsAt - Date.now() - 3 * DAY) < 60 * 1000 + 0.5 * DAY);
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "payment_due" }));
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "merchant_payment_due", audience: "admin" }));
    const me = await alice("GET", "/merchant/me");
    assert.equal(me.data.accountStatus, "grace");
  });
});

describe("4. Admin is notified of a payment proof", () => {
  it("records the proof as pending and notifies admin and merchant", async () => {
    const submitted = await proof(alice, "TRX-ALICE-1");
    assert.equal(submitted.status, 201, submitted.message);
    assert.equal(submitted.data.status, "pending");
    const notes = await admin("GET", "/admin/notifications");
    assert.ok(notes.data.latest.some((note) => note.type === "payment_submitted"));
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "payment_pending" }));
    const me = await alice("GET", "/merchant/me");
    assert.equal(me.data.accountStatus, "payment_pending");
    const fresh = await admin("GET", "/admin/payment-submissions?status=new");
    assert.equal(fresh.data.submissions.length, 1);
  });
});

describe("5. No activation until the administrator activates", () => {
  it("approval alone does not activate; a rejected proof cannot be activated", async () => {
    const list = await admin("GET", "/admin/payment-submissions?status=pending");
    const id = list.data.submissions[0]._id;
    assert.equal((await admin("POST", `/admin/payment-submissions/${id}/activate`)).status, 409);
    assert.equal((await admin("POST", `/admin/payment-submissions/${id}/approve`)).status, 200);
    assert.equal((await models.Merchant.findById(aliceMerchant)).status, "payment_due");

    const other = await proof(bob, "TRX-BOB-1");
    await admin("POST", `/admin/payment-submissions/${other.data._id}/reject`, { reason: "Amount not received" });
    assert.equal((await admin("POST", `/admin/payment-submissions/${other.data._id}/activate`)).status, 409);
    assert.equal((await models.Merchant.findById(bobMerchant)).status, "approved");
  });
});

describe("6. The new 30-day period", () => {
  it("starts at the moment of activation, not from an earlier date", async () => {
    const list = await admin("GET", "/admin/payment-submissions?status=approved");
    const before = Date.now();
    const activated = await admin("POST", `/admin/payment-submissions/${list.data.submissions[0]._id}/activate`);
    assert.equal(activated.status, 200, activated.message);
    const merchant = await models.Merchant.findById(aliceMerchant).lean();
    assert.equal(merchant.status, "active");
    const period = await models.Subscription.findOne({ merchant: aliceMerchant, source: "payment_proof" }).lean();
    assert.ok(period.startsAt.getTime() >= before - 1000 && period.startsAt.getTime() <= Date.now());
    assert.equal(Math.round((period.endsAt - period.startsAt) / DAY), 30);
    assert.equal(merchant.paidUntil.getTime(), period.endsAt.getTime());
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "account_activated" }));
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "merchant_reactivated", audience: "admin" }));
  });

  it("shows the subscription columns in the admin merchant list", async () => {
    const list = await admin("GET", "/admin/merchants");
    const row = list.data.merchants.find((merchant) => merchant._id === String(aliceMerchant));
    for (const field of ["subscriptionStart", "expiresAt", "monthlyFee", "paymentStatus", "accountStatus", "lastPaymentAt", "nextDueDate"]) {
      assert.ok(row[field] !== undefined && row[field] !== null, `missing ${field}`);
    }
    assert.equal(row.paymentStatus, "activated");
  });
});

describe("7–9. Suspension after the grace period, hiding and restoring products", () => {
  before(async () => {
    const category = await models.Category.create({ name: "Bags", slug: "bags", image: "https://example.test/c.png" });
    const base = { description: "d", price: 900, category: category._id, image: ["https://example.test/p.png"], merchant: aliceMerchant };
    aliceProduct = await models.Product.create({ ...base, title: "Live Bag", slug: "live-bag", approvalStatus: "approved" });
    hiddenProduct = await models.Product.create({ ...base, title: "Hidden Bag", slug: "hidden-bag", approvalStatus: "approved", listingStatus: "hidden" });
    rejectedProduct = await models.Product.create({ ...base, title: "Rejected Bag", slug: "rejected-bag", approvalStatus: "rejected" });
  });

  const publicTitles = async () => {
    const [list, category] = await Promise.all([guest("GET", "/mainproduct/all-product"), guest("GET", "/mainproduct/category/bags")]);
    return { list: list.data.map((product) => product.title), category: (category.data?.products || []).map((product) => product.title) };
  };

  it("shows only the live, approved product while active", async () => {
    const titles = await publicTitles();
    assert.deepEqual(titles.list, ["Live Bag"]);
    assert.deepEqual(titles.category, ["Live Bag"]);
  });

  it("suspends automatically after the grace period, with merchant and admin told", async () => {
    await timeTravel(aliceMerchant, 30.5); // past the end of the paid period
    assert.equal((await models.Merchant.findById(aliceMerchant)).status, "payment_due");
    await timeTravel(aliceMerchant, 3.5); // past the grace period
    const merchant = await models.Merchant.findById(aliceMerchant).lean();
    assert.equal(merchant.status, "suspended");
    assert.equal(merchant.suspendedAuto, true);
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "account_suspended" }));
    assert.ok(await models.Notification.exists({ merchant: aliceMerchant, type: "merchant_auto_suspended", audience: "admin" }));
  });

  it("hides every product from every public page and API, without deleting anything", async () => {
    const titles = await publicTitles();
    assert.deepEqual(titles.list, []);
    assert.deepEqual(titles.category, []);
    assert.equal((await guest("GET", "/mainproduct/single-product/live-bag")).status, 404);
    assert.equal((await guest("GET", `/mainproduct/product/${aliceProduct._id}`)).status, 404);
    assert.deepEqual((await guest("GET", `/variant/product/${aliceProduct._id}`)).data, []);
    assert.deepEqual((await guest("GET", `/review/product/${aliceProduct._id}`)).data, []);
    const order = await guest("POST", "/checkout/checkout_order", {
      items: [{ product: String(aliceProduct._id), quantity: 1 }],
      customer: { name: "Buyer Name", phone: "01712345678", address: "House 1, Road 2, Dhanmondi, Dhaka" },
      deliveryZone: "inside_dhaka",
      paymentMethod: "cod",
    });
    assert.ok(order.status >= 400, "checkout must refuse a hidden product");
    assert.equal(await models.Product.countDocuments({ merchant: aliceMerchant }), 3, "no product deleted");
    const adminList = await admin("GET", "/admin/products");
    assert.equal(adminList.data.find((product) => product.title === "Live Bag").visibility, "merchant_suspended");
    assert.equal((await admin("DELETE", `/mainproduct/delete-product/${aliceProduct._id}`)).status, 409);
  });

  it("blocks product changes for the suspended merchant", async () => {
    assert.equal((await alice("GET", "/merchant/products")).status, 403);
    assert.equal((await alice("PATCH", `/merchant/products/${aliceProduct._id}`, { price: 1 })).status, 403);
    assert.equal((await alice("POST", "/merchant/products", new FormData())).status, 403);
  });

  it("restores only the previously live products on reactivation", async () => {
    const submitted = await proof(alice, "TRX-ALICE-2");
    await admin("POST", `/admin/payment-submissions/${submitted.data._id}/approve`);
    assert.deepEqual((await publicTitles()).list, [], "still hidden until activation");
    await admin("POST", `/admin/payment-submissions/${submitted.data._id}/activate`);
    const titles = await publicTitles();
    assert.deepEqual(titles.list, ["Live Bag"], "hidden and rejected products must stay off");
    assert.deepEqual(titles.category, ["Live Bag"]);
    assert.equal((await models.Product.findById(hiddenProduct._id)).listingStatus, "hidden");
    assert.equal((await models.Product.findById(rejectedProduct._id)).approvalStatus, "rejected");
  });
});

describe("10. A suspended merchant can still pay and ask for help", () => {
  it("opens billing, submits proof and opens a ticket with picture and voice", async () => {
    await models.Merchant.updateOne({ _id: bobMerchant }, { status: "suspended", suspendedAuto: true });
    assert.equal((await bob("GET", "/merchant/billing")).status, 200);
    const submitted = await proof(bob, "TRX-BOB-2");
    assert.equal(submitted.status, 201, submitted.message);
    const ticket = await bob("POST", "/merchant/support-tickets", form({ subject: "Help", message: "Paid" }, [["images", PNG, "image/png", "a.png"], ["audio", WEBM, "audio/webm", "v.webm"]]));
    assert.equal(ticket.status, 201, ticket.message);
    assert.equal(ticket.data.messages[0].attachments.length, 2);
    const reply = await admin("POST", `/admin/support-tickets/${ticket.data._id}/messages`, form({ message: "Checking" }));
    assert.equal(reply.data.status, "in_progress");
    const seen = await bob("GET", `/merchant/support-tickets/${ticket.data._id}`);
    assert.equal(seen.data.messages[1].body, "Checking");
  });
});

describe("11. No access to other merchants' data", () => {
  it("returns 404 for another merchant's ticket and shows only your own proofs", async () => {
    const bobTicket = await models.Ticket.findOne({ merchant: bobMerchant });
    assert.equal((await alice("GET", `/merchant/support-tickets/${bobTicket._id}`)).status, 404);
    assert.equal((await alice("POST", `/merchant/support-tickets/${bobTicket._id}/messages`, form({ message: "x" }))).status, 404);
    const billing = await alice("GET", "/merchant/billing");
    assert.ok(billing.data.submissions.every((submission) => !submission.transactionId.startsWith("TRX-BOB")));
  });

  it("keeps merchants out of the admin API and refuses disguised files", async () => {
    for (const url of ["/admin/merchants", "/admin/payment-submissions", "/admin/support-tickets", "/admin/audit-logs", "/admin/products"]) {
      assert.equal((await alice("GET", url)).status, 403, url);
    }
    assert.equal((await guest("GET", "/merchant/billing")).status, 401);
    const disguised = await alice("POST", "/merchant/support-tickets", form({ subject: "x", message: "y" }, [["images", Buffer.from("<script>"), "image/png", "x.png"]]));
    assert.equal(disguised.status, 400);
  });
});

describe("12. The scheduled job across restarts", () => {
  it("catches up after downtime and takes over a lease left by a crashed process", async () => {
    // A lease held by a process that died: it has expired.
    await models.JobLock.updateOne({ name: "merchant-billing" }, { owner: "crashed-process", lockedUntil: new Date(Date.now() - 1000) }, { upsert: true });
    // While "down", Alice's period ran out.
    await models.Merchant.updateOne({ _id: aliceMerchant }, { paidUntil: new Date(Date.now() - DAY) });
    const summary = await jobs.runMerchantBillingJob();
    assert.ok(summary, "the job must take over the expired lease");
    assert.equal((await models.Merchant.findById(aliceMerchant)).status, "payment_due");
    const lock = await models.JobLock.findOne({ name: "merchant-billing" }).lean();
    assert.ok(lock.lastFinishedAt && lock.lockedUntil === null);
  });

  it("does not run while another live process holds the lease", async () => {
    await models.JobLock.updateOne({ name: "merchant-billing" }, { owner: "other-process", lockedUntil: new Date(Date.now() + 60 * 1000) });
    assert.equal(await jobs.runMerchantBillingJob(), null);
    await models.JobLock.updateOne({ name: "merchant-billing" }, { lockedUntil: null });
  });
});

describe("13. Nothing is processed twice", () => {
  it("re-running the job sends no duplicate notifications and changes nothing", async () => {
    const before = await models.Notification.countDocuments();
    await jobs.runMerchantBillingJob();
    await jobs.runMerchantBillingJob();
    await Promise.all([jobs.syncMerchantStatuses(), jobs.syncMerchantStatuses()]);
    assert.equal(await models.Notification.countDocuments(), before);
    const dupes = await models.Notification.aggregate([{ $match: { dedupeKey: { $type: "string" } } }, { $group: { _id: "$dedupeKey", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]);
    assert.equal(dupes.length, 0);
  });

  it("a transaction ID cannot be reused, and one proof cannot be activated twice", async () => {
    // Alice has no proof waiting, so only the reused ID can refuse this.
    await models.Merchant.updateOne({ _id: aliceMerchant }, { status: "payment_due" });
    const reused = await proof(alice, "TRX-ALICE-2");
    assert.equal(reused.status, 409);
    assert.match(reused.message, /already been submitted/);
    const activated = await models.Submission.findOne({ transactionId: "TRX-ALICE-2" });
    assert.equal((await admin("POST", `/admin/payment-submissions/${activated._id}/activate`)).status, 409);
    assert.equal(await models.Subscription.countDocuments({ paymentSubmission: activated._id }), 1);
    // Two merchants submit one ID at the same moment: exactly one is stored.
    const waiting = await models.Submission.findOne({ merchant: bobMerchant, status: "pending" });
    await admin("POST", `/admin/payment-submissions/${waiting._id}/reject`, { reason: "Test cleanup" });
    const results = await Promise.all([proof(alice, "TRX-RACE"), proof(bob, "TRX-RACE")]);
    assert.equal(results.filter((result) => result.status === 201).length, 1);
    assert.equal(await models.Submission.countDocuments({ transactionId: "TRX-RACE" }), 1);
  });
});

describe("14. Audit log and permanent records", () => {
  it("has an entry for every kind of change", async () => {
    const actions = new Set(await models.Audit.distinct("action"));
    for (const action of [
      "account.approved", "payment.submitted", "payment.approved", "payment.rejected",
      "account.activated", "account.suspended", "subscription.expired", "ticket.created", "nid.viewed",
    ]) {
      assert.ok(actions.has(action), `missing audit action ${action}`);
    }
  });

  it("cannot be changed, and records cannot be deleted", async () => {
    await assert.rejects(models.Audit.updateMany({}, { action: "x" }));
    await assert.rejects(models.Audit.deleteMany({}));
    for (const model of [models.Merchant, models.Order, models.Submission, models.Ticket, models.Subscription]) {
      await assert.rejects(model.deleteMany({}), `${model.modelName} must not be deletable`);
    }
  });
});
<<<<<<< HEAD

// ---------------------------------------------------------------- referrals

/** Applies with a blank NID photo: unreadable, so accepted and flagged for the administrator. */
const applyWithoutPhoto = (http, fields) =>
  http(
    "POST",
    "/merchant/apply",
    form(
      { fullname: "Referral Seller", businessName: "Referral Shop", address: "House 9, Road 9, Mirpur, Dhaka", productType: "Shoes", password: "password123", ...fields },
      [["nidFront", PNG, "image/png", "front.png"], ["nidBack", PNG, "image/png", "back.png"]]
    )
  );

const approveApplication = async (applicationId, body = { monthlyFee: 500 }) => {
  const approved = await admin("POST", `/admin/merchant-applications/${applicationId}/approve`, body);
  assert.equal(approved.status, 201, approved.message);
  return approved.data;
};

/** Approves and activates a proof as the administrator would. */
const verify = async (submissionId) => {
  assert.equal((await admin("POST", `/admin/payment-submissions/${submissionId}/approve`)).status, 200);
  const activated = await admin("POST", `/admin/payment-submissions/${submissionId}/activate`);
  assert.equal(activated.status, 200, activated.message);
  return activated.data;
};

const creditOf = async (merchantId) => (await models.CreditAccount.findOne({ merchant: merchantId }).lean()) || {};

describe("15. Manual bKash/Nagad payments and referral credit", () => {
  const rina = client();
  const sam = client();
  let rinaMerchant;
  let samMerchant;
  let rinaCode;

  before(() => {
    models.Referral = require("../models/referral.model");
    models.CreditAccount = require("../models/referralCreditAccount.model");
    models.CreditLedger = require("../models/referralCreditTransaction.model");
  });

  it("lets the administrator set the bKash and Nagad numbers and the referral credit", async () => {
    const invalid = await admin("PATCH", "/admin/settings", { merchantBilling: { accounts: { bkash: { number: "12345" } } } });
    assert.equal(invalid.status, 400);
    const saved = await admin("PATCH", "/admin/settings", {
      merchantBilling: { accounts: { bkash: { number: "+8801712345678", type: "personal" }, nagad: { number: "" } } },
      merchantReferral: { creditAmount: 100 },
    });
    assert.equal(saved.status, 200, saved.message);
    assert.equal(saved.data.merchantBilling.accounts.bkash.number, "01712345678");
    assert.equal(saved.data.merchantReferral.creditAmount, 100);
  });

  it("gives every merchant a referral code, and refuses an unknown code on an application", async () => {
    const applied = await applyWithoutPhoto(guest, { email: "rina@test.local", phone: "01912345671", nidNumber: "5550000001" });
    assert.equal(applied.status, 201, applied.message);
    rinaMerchant = (await approveApplication(applied.data._id))._id;
    await login(rina, "rina@test.local");
    const mine = await rina("GET", "/merchant/referrals");
    assert.equal(mine.status, 200);
    rinaCode = mine.data.referralCode;
    assert.match(rinaCode, /^NH[A-Z2-9]{6}$/);
    assert.equal(mine.data.creditPerReferral, 100);
    assert.deepEqual([mine.data.credit.available, mine.data.credit.earned], [0, 0]);

    const unknown = await applyWithoutPhoto(guest, { email: "nobody@test.local", phone: "01912345679", nidNumber: "5550000009", referralCode: "NHZZZZZZ" });
    assert.equal(unknown.status, 400);
  });

  it("shows only the configured wallet, the payment number and the invoice on the billing page", async () => {
    const billing = await rina("GET", "/merchant/billing");
    assert.deepEqual(billing.data.methods, ["bkash"]);
    assert.equal(billing.data.paymentAccounts[0].number, "01712345678");
    assert.deepEqual(billing.data.invoice, { fee: 500, creditApplied: 0, payable: 500, creditLeft: 0 });
    // Nagad has no number, so it cannot be used; a payment date is required.
    assert.equal((await proof(rina, "TRX-RINA-NAGAD", "500", { method: "nagad" })).status, 400);
    assert.equal((await proof(rina, "TRX-RINA-NODATE", "500", { paidAt: "" })).status, 400);
    assert.equal((await proof(rina, "TRX-RINA-FUTURE", "500", { paidAt: "2999-01-01" })).status, 400);
    await admin("PATCH", "/admin/settings", { merchantBilling: { accounts: { nagad: { number: "01812345678" } } } });
    assert.deepEqual((await rina("GET", "/merchant/billing")).data.methods, ["bkash", "nagad"]);
  });

  it("links a merchant who registers with a referral link to the referrer", async () => {
    const applied = await applyWithoutPhoto(guest, { email: "sam@test.local", phone: "01912345672", nidNumber: "5550000002", referralCode: rinaCode.toLowerCase() });
    assert.equal(applied.status, 201, applied.message);
    samMerchant = (await approveApplication(applied.data._id))._id;
    await login(sam, "sam@test.local");
    const sammy = await models.Merchant.findById(samMerchant).lean();
    assert.equal(String(sammy.referredBy), String(rinaMerchant));
    const referral = await models.Referral.findOne({ referred: samMerchant }).lean();
    assert.equal(referral.status, "pending");
    assert.ok(await models.Audit.exists({ action: "referral.linked", subjectId: referral._id }));
  });

  it("does not count a referrer referring themselves", async () => {
    // Same mobile number as Rina, with an email so the number is allowed.
    const applied = await applyWithoutPhoto(guest, { email: "rina2@test.local", phone: "01912345671", nidNumber: "5550000003", referralCode: rinaCode });
    assert.equal(applied.status, 201, applied.message);
    const second = await approveApplication(applied.data._id);
    const referral = await models.Referral.findOne({ referred: second._id }).lean();
    assert.equal(referral.status, "void");
    assert.equal(referral.voidReason, "same_person");
  });

  it("earns nothing until the referred merchant's first payment is verified, then 100 Tk once", async () => {
    const submitted = await proof(sam, "TRX-SAM-1", "500");
    assert.equal(submitted.status, 201, submitted.message);
    assert.equal(submitted.data.status, "pending");
    assert.ok(submitted.data.paidAt);
    assert.equal(submitted.data.payTo, "01712345678");
    assert.equal((await creditOf(rinaMerchant)).earned || 0, 0, "submitting is not verification");

    assert.equal((await admin("POST", `/admin/payment-submissions/${submitted.data._id}/approve`)).status, 200);
    assert.equal((await creditOf(rinaMerchant)).earned || 0, 0, "approval alone starts nothing");
    assert.equal((await admin("POST", `/admin/payment-submissions/${submitted.data._id}/activate`)).status, 200);

    const account = await creditOf(rinaMerchant);
    assert.deepEqual([account.available, account.earned], [100, 100]);
    assert.equal((await models.Referral.findOne({ referred: samMerchant }).lean()).status, "credited");
    assert.ok(await models.Notification.exists({ merchant: rinaMerchant, type: "referral_credit_earned" }));
    // Paid; still "trial" until the free trial ends, as before.
    assert.ok((await models.Merchant.findById(samMerchant).lean()).paidUntil > new Date());

    // Activating again, a second payment by Sam, and racing grants: still 100.
    assert.equal((await admin("POST", `/admin/payment-submissions/${submitted.data._id}/activate`)).status, 409);
    const second = await proof(sam, "TRX-SAM-2", "500");
    await verify(second.data._id);
    const { qualifyReferral } = require("../utils/referral");
    const sammy = await models.Merchant.findById(samMerchant);
    await Promise.all([qualifyReferral({ merchant: sammy, amountPaid: 500 }), qualifyReferral({ merchant: sammy, amountPaid: 500 })]);
    assert.equal((await creditOf(rinaMerchant)).earned, 100);
    assert.equal(await models.CreditLedger.countDocuments({ merchant: rinaMerchant, type: "earned" }), 1);
  });

  it("takes the credit off the next invoice: 500 fee − 100 credit = 400 to pay", async () => {
    const billing = await rina("GET", "/merchant/billing");
    assert.deepEqual(billing.data.invoice, { fee: 500, creditApplied: 100, payable: 400, creditLeft: 0 });

    const submitted = await proof(rina, "TRX-RINA-1", "400");
    assert.equal(submitted.status, 201, submitted.message);
    assert.deepEqual([submitted.data.fee, submitted.data.creditApplied, submitted.data.expectedAmount], [500, 100, 400]);
    let account = await creditOf(rinaMerchant);
    assert.deepEqual([account.available, account.reserved], [0, 100], "reserved while waiting");

    // Rejected: the merchant is told why and the credit comes back.
    await admin("POST", `/admin/payment-submissions/${submitted.data._id}/reject`, { reason: "Transaction not found" });
    account = await creditOf(rinaMerchant);
    assert.deepEqual([account.available, account.reserved], [100, 0]);
    const mine = await rina("GET", "/merchant/billing");
    assert.equal(mine.data.submissions[0].rejectionReason, "Transaction not found");

    // Submitted again and verified: the credit is spent.
    const again = await proof(rina, "TRX-RINA-1", "400");
    assert.equal(again.status, 201, "a rejected transaction ID can be submitted again");
    await verify(again.data._id);
    account = await creditOf(rinaMerchant);
    assert.deepEqual([account.available, account.reserved, account.used], [0, 0, 100]);
    const period = await models.Subscription.findOne({ paymentSubmission: again.data._id }).lean();
    assert.deepEqual([period.fee, period.amountPaid, period.creditApplied], [500, 400, 100]);
    const types = (await models.CreditLedger.find({ merchant: rinaMerchant }).sort({ createdAt: 1 }).lean()).map((entry) => entry.type);
    assert.deepEqual(types, ["earned", "reserved", "released", "reserved", "used"]);
  });

  it("pays a whole fee from credit and keeps the rest for the next month", async () => {
    assert.equal((await admin("POST", `/admin/merchants/${rinaMerchant}/referral-credit/adjust`, { amount: 600, reason: "Five referrals before launch" })).status, 200);
    const billing = await rina("GET", "/merchant/billing");
    assert.deepEqual(billing.data.invoice, { fee: 500, creditApplied: 500, payable: 0, creditLeft: 100 });

    const submitted = await rina("POST", "/merchant/payment-submissions", form({ method: "credit" }));
    assert.equal(submitted.status, 201, submitted.message);
    assert.deepEqual([submitted.data.amount, submitted.data.creditApplied, submitted.data.expectedAmount], [0, 500, 0]);
    await verify(submitted.data._id);
    const account = await creditOf(rinaMerchant);
    assert.deepEqual([account.available, account.reserved, account.used], [100, 0, 600]);

    // 100 left cannot pay a 500 fee on its own, and nothing is held by trying.
    assert.equal((await rina("POST", "/merchant/payment-submissions", form({ method: "credit" }))).status, 400);
    assert.deepEqual([(await creditOf(rinaMerchant)).available, (await creditOf(rinaMerchant)).reserved], [100, 0]);
  });

  it("counts a payment the administrator records by hand as verified", async () => {
    const applied = await applyWithoutPhoto(guest, { email: "tom@test.local", phone: "01912345673", nidNumber: "5550000004", referralCode: rinaCode });
    const tom = await approveApplication(applied.data._id);
    assert.equal((await admin("POST", `/admin/merchants/${tom._id}/payments`, { amount: 500, months: 1, method: "bkash", reference: "CASH-TOM" })).status, 201);
    assert.equal((await creditOf(rinaMerchant)).earned, 200);
  });

  it("lets only administrators see and correct credit, never below zero", async () => {
    assert.equal((await admin("POST", `/admin/merchants/${rinaMerchant}/referral-credit/adjust`, { amount: -10000, reason: "Too much" })).status, 409);
    assert.equal((await admin("POST", `/admin/merchants/${rinaMerchant}/referral-credit/adjust`, { amount: 50 })).status, 400, "a reason is required");
    for (const [method, url] of [["GET", "/admin/referrals"], ["GET", `/admin/merchants/${rinaMerchant}/referral-credit`], ["POST", `/admin/merchants/${rinaMerchant}/referral-credit/adjust`]]) {
      assert.equal((await rina(method, url, method === "POST" ? { amount: 1000, reason: "please" } : undefined)).status, 403, url);
    }
    // Sam sees his own (empty) credit, not Rina's.
    const samView = await sam("GET", "/merchant/referrals");
    assert.equal(samView.data.ledger.length, 0);
    assert.equal(samView.data.credit.earned, 0);

    const overview = await admin("GET", "/admin/referrals");
    assert.equal(overview.status, 200);
    assert.equal(overview.data.counts.credited, 2);
    assert.equal(overview.data.counts.void, 1);
    const { earned, used, adjusted, available, reserved, unused } = overview.data.totals;
    assert.deepEqual([earned, used, adjusted], [200, 600, 600]);
    assert.equal(unused, earned + adjusted - used);
    assert.equal(unused, available + reserved);

    const detail = await admin("GET", `/admin/merchants/${rinaMerchant}/referral-credit`);
    assert.equal(detail.data.referrals.length, 3);
    assert.equal(detail.data.ledger.find((entry) => entry.type === "adjusted").note, "Five referrals before launch");
    assert.ok(await models.Audit.exists({ action: "credit.adjusted", merchant: rinaMerchant }));
  });

  it("keeps credit, referrals and credit history through a lock, and never deletes or rewrites them", async () => {
    await admin("POST", `/admin/merchants/${rinaMerchant}/lock`, { reason: "Test" });
    assert.equal((await rina("GET", "/merchant/billing")).status, 403);
    assert.equal((await creditOf(rinaMerchant)).available, 200);
    await admin("POST", `/admin/merchants/${rinaMerchant}/unlock`);
    assert.equal((await rina("GET", "/merchant/referrals")).data.credit.available, 200);

    await assert.rejects(models.CreditLedger.updateMany({}, { amount: 1 }));
    for (const model of [models.CreditLedger, models.CreditAccount, models.Referral]) {
      await assert.rejects(model.deleteMany({}), `${model.modelName} must not be deletable`);
    }
  });
});
=======
>>>>>>> origin/main
