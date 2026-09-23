/**
 * Fake / risky order detection.
 *
 * Every rule that matches contributes points and a bilingual explanation. The
 * total decides whether the order is accepted silently (`clean`), accepted but
 * queued for a phone call (`review`), or rejected outright (`blocked`).
 */

const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com",
  "temp-mail.org", "yopmail.com", "trashmail.com", "sharklasers.com",
  "getnada.com", "dispostable.com", "fakeinbox.com", "maildrop.cc",
  "throwawaymail.com", "mohmal.com", "emailondeck.com",
];

/** Bangladeshi mobile numbers: 11 digits starting 013–019, optional +88 prefix. */
const BD_PHONE = /^(?:\+?88)?01[3-9]\d{8}$/;

/** Strips spaces, dashes and the +88 country code so numbers compare equal. */
const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("88")) return digits.slice(2);
  if (digits.length === 14 && digits.startsWith("088")) return digits.slice(3);
  return digits;
};

const isValidBdPhone = (phone) => BD_PHONE.test(String(phone || "").replace(/[\s-]/g, ""));

/** 01111111111, 01234567890 and friends — almost always made up. */
const hasSuspiciousPattern = (phone) => {
  const local = normalizePhone(phone).slice(2); // drop the leading "01"
  if (local.length < 9) return false;
  if (/^(\d)\1+$/.test(local)) return true;
  if (/0123456789|9876543210|1234567890/.test(local)) return true;
  return new Set(local).size <= 2;
};

/** An address of only repeated letters, or with no real words, reads as junk. */
const looksLikeGibberish = (address) => {
  const value = String(address || "").trim();
  if (!value) return true;
  const letters = value.replace(/[^a-zA-Zঀ-৿]/g, "");
  if (letters.length && new Set(letters.toLowerCase()).size <= 2) return true;
  if (/(.)\1{4,}/.test(value)) return true;
  const words = value.split(/\s+/).filter((word) => word.length > 1);
  return words.length < 2;
};

const isDisposableEmail = (email) => {
  const domain = String(email || "").toLowerCase().split("@")[1];
  return Boolean(domain) && DISPOSABLE_EMAIL_DOMAINS.includes(domain);
};

const RULES = {
  invalid_phone: { score: 45, label: "Phone number is not a valid Bangladeshi mobile number", labelBn: "মোবাইল নম্বরটি সঠিক বাংলাদেশি নম্বর নয়" },
  fake_phone_pattern: { score: 40, label: "Phone number looks made up (repeated or sequential digits)", labelBn: "মোবাইল নম্বরটি বানানো মনে হচ্ছে (একই বা ধারাবাহিক সংখ্যা)" },
  phone_velocity: { score: 30, label: "Too many orders from this phone number today", labelBn: "আজ এই নম্বর থেকে অনেকগুলো অর্ডার এসেছে" },
  ip_velocity: { score: 25, label: "Too many orders from this device or network today", labelBn: "আজ এই ডিভাইস বা নেটওয়ার্ক থেকে অনেকগুলো অর্ডার এসেছে" },
  pending_pileup: { score: 20, label: "This customer already has unconfirmed orders", labelBn: "এই গ্রাহকের আগের অর্ডার এখনও নিশ্চিত হয়নি" },
  cancel_history: { score: 30, label: "This phone number has cancelled orders before", labelBn: "এই নম্বর থেকে আগে অর্ডার বাতিল হয়েছে" },
  previous_fake: { score: 60, label: "This phone number was marked as a fake order before", labelBn: "এই নম্বর আগে ভুয়া অর্ডার হিসেবে চিহ্নিত হয়েছে" },
  high_value_cod: { score: 20, label: "Unusually large cash-on-delivery amount", labelBn: "ক্যাশ অন ডেলিভারিতে অস্বাভাবিক বড় অঙ্ক" },
  cod_over_limit: { score: 35, label: "Cash-on-delivery amount is above the allowed limit", labelBn: "ক্যাশ অন ডেলিভারির অনুমোদিত সীমার বেশি" },
  short_address: { score: 20, label: "Delivery address is too short to be usable", labelBn: "ডেলিভারি ঠিকানা ব্যবহার করার মতো যথেষ্ট নয়" },
  gibberish_address: { score: 30, label: "Delivery address does not look like a real address", labelBn: "ডেলিভারি ঠিকানাটি বাস্তব ঠিকানার মতো মনে হচ্ছে না" },
  disposable_email: { score: 20, label: "A throwaway email address was used", labelBn: "সাময়িক বা ভুয়া ইমেইল ঠিকানা ব্যবহার হয়েছে" },
  bulk_quantity: { score: 15, label: "Unusually high quantity for a retail order", labelBn: "খুচরা অর্ডারের তুলনায় অস্বাভাবিক বেশি পরিমাণ" },
  no_user_agent: { score: 15, label: "Order was placed without normal browser information", labelBn: "স্বাভাবিক ব্রাউজার তথ্য ছাড়াই অর্ডারটি এসেছে" },
  guest_high_value: { score: 15, label: "Large order placed without an account", labelBn: "অ্যাকাউন্ট ছাড়াই বড় অঙ্কের অর্ডার" },
  name_too_short: { score: 15, label: "Customer name is too short to be real", labelBn: "গ্রাহকের নামটি বাস্তব হওয়ার মতো যথেষ্ট নয়" },
};

/**
 * Scores one order attempt.
 *
 * @param {object} input
 * @param {object} input.customer   normalised customer/shipping details
 * @param {Array}  input.items      order lines with `quntity`
 * @param {number} input.total      grand total including delivery
 * @param {string} input.paymentMethod
 * @param {boolean} input.isGuest
 * @param {string} input.ipAddress
 * @param {string} input.userAgent
 * @param {object} input.history    counts gathered from past orders
 * @param {object} settings         the store settings document
 * @returns {{score:number, level:string, status:string, flags:Array}}
 */
const evaluateOrder = (input, settings) => {
  const config = settings?.fraud || {};
  const flags = [];
  const flag = (code) => {
    const rule = RULES[code];
    if (rule) flags.push({ code, score: rule.score, label: rule.label, labelBn: rule.labelBn });
  };

  const { customer = {}, items = [], total = 0, paymentMethod, isGuest, ipAddress, userAgent, history = {} } = input;

  if (!isValidBdPhone(customer.phone)) flag("invalid_phone");
  else if (hasSuspiciousPattern(customer.phone)) flag("fake_phone_pattern");

  if (String(customer.name || "").trim().length < 3) flag("name_too_short");

  const address = String(customer.address || "").trim();
  if (address.length < (config.minAddressLength ?? 15)) flag("short_address");
  if (looksLikeGibberish(address)) flag("gibberish_address");

  if (customer.email && isDisposableEmail(customer.email)) flag("disposable_email");

  if (history.phoneOrdersToday > (config.maxOrdersPerPhonePerDay ?? 3)) flag("phone_velocity");
  if (history.ipOrdersToday > (config.maxOrdersPerIpPerDay ?? 5)) flag("ip_velocity");
  if (history.phonePendingOrders > (config.maxPendingOrdersPerPhone ?? 3)) flag("pending_pileup");
  if (history.phoneCancelledOrders > (config.maxCancelledOrdersPerPhone ?? 2)) flag("cancel_history");
  if (history.phoneFakeOrders > 0) flag("previous_fake");

  if (paymentMethod === "cashOnDelivery") {
    if (total > (config.codMaxAmount ?? settings?.codMaxAmount ?? 20000)) flag("cod_over_limit");
    else if (total > (config.highValueCodAmount ?? 10000)) flag("high_value_cod");
  }

  const units = items.reduce((sum, item) => sum + Number(item.quntity || 1), 0);
  if (units > 20) flag("bulk_quantity");

  if (!String(userAgent || "").trim()) flag("no_user_agent");
  if (isGuest && total > (config.highValueCodAmount ?? 10000)) flag("guest_high_value");

  const score = Math.min(flags.reduce((sum, item) => sum + item.score, 0), 100);
  const blockScore = config.blockScore ?? 70;
  const reviewScore = config.reviewScore ?? 35;

  let status = "clean";
  let level = "low";
  if (config.enabled === false) {
    // Detection is switched off in settings: record the flags but accept the order.
    return { score, level: score >= blockScore ? "high" : score >= reviewScore ? "medium" : "low", status: "clean", flags };
  }
  if (score >= blockScore) {
    status = "blocked";
    level = "high";
  } else if (score >= reviewScore) {
    status = "review";
    level = "medium";
  }

  // An unusable phone number can never be delivered, so never accept it silently.
  if (flags.some((item) => item.code === "invalid_phone") && status === "clean") {
    status = "review";
    level = "medium";
  }

  return { score, level, status, flags };
};

module.exports = {
  evaluateOrder,
  normalizePhone,
  isValidBdPhone,
  hasSuspiciousPattern,
  looksLikeGibberish,
  isDisposableEmail,
  BD_PHONE,
};
