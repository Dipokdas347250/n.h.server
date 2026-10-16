const notificationModel = require("../models/notification.model");
const { sendNotice } = require("../helpers/sendEmail");
const { storeName } = require("../config/mail.config");

/*
 * Notifications.
 *
 * Every notification is first stored for the dashboard (the Notification
 * Center and the bell). Then each registered delivery channel gets a chance to
 * send it elsewhere. Email is the first channel; web push or SMS can be added
 * later with `registerChannel` without touching any of the callers.
 *
 * A notification with a `dedupeKey` is stored at most once — a unique index
 * refuses the second insert — and when that happens no channel is run either,
 * so a scheduled job that runs again never repeats a reminder.
 *
 * Nothing here may break the action that triggered it: failures are logged.
 */

/** Notification Center groups. */
const CATEGORY = {
  trial_started: "subscription",
  account_approved: "subscription",
  trial_ending: "subscription",
  subscription_expiring: "subscription",
  payment_due: "subscription",
  merchant_expiring: "subscription",
  merchant_payment_due: "subscription",
  payment_pending: "payment",
  payment_submitted: "payment",
  payment_approved: "payment",
  payment_rejected: "payment",
  account_suspended: "suspension",
  merchant_auto_suspended: "suspension",
  account_activated: "reactivation",
  merchant_reactivated: "reactivation",
  ticket_created: "support",
  ticket_reply: "support",
  ticket_status: "support",
  merchant_application: "application",
};

const TIME_ZONE = "Asia/Dhaka";
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const bnDigits = (value) => String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]);
const dateEn = (value) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const dateBn = (value) => new Date(value).toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric", timeZone: TIME_ZONE });
const takaEn = (value) => `Tk ${Number(value || 0).toLocaleString("en-US")}`;
const takaBn = (value) => `৳${bnDigits(Number(value || 0).toLocaleString("en-US"))}`;

/** Email wording for merchant notifications that warrant one. Types without an entry are dashboard-only. */
const MERCHANT_EMAILS = {
  trial_started: (p) => ({
    subject: `${storeName}: your merchant account is approved`,
    en: [`Your merchant account is approved and your free trial runs until ${dateEn(p.endsAt)}.`],
    bn: [`আপনার মার্চেন্ট অ্যাকাউন্ট অনুমোদিত হয়েছে এবং ফ্রি ট্রায়াল ${dateBn(p.endsAt)} পর্যন্ত চলবে।`],
  }),
  trial_ending: (p) => ({
    subject: `${storeName}: your free trial ends ${dateEn(p.endsAt)}`,
    en: [`Your free trial ends on ${dateEn(p.endsAt)}. Pay your subscription and submit the payment proof from your dashboard to keep selling.`],
    bn: [`আপনার ফ্রি ট্রায়াল ${dateBn(p.endsAt)} তারিখে শেষ হবে। বিক্রি চালিয়ে যেতে সাবস্ক্রিপশন পরিশোধ করে ড্যাশবোর্ড থেকে পেমেন্টের প্রমাণ জমা দিন।`],
  }),
  subscription_expiring: (p) => ({
    subject: `${storeName}: your subscription ends ${dateEn(p.endsAt)}`,
    en: [`Your subscription ends on ${dateEn(p.endsAt)}. Pay and submit the payment proof from your dashboard to keep selling.`],
    bn: [`আপনার সাবস্ক্রিপশন ${dateBn(p.endsAt)} তারিখে শেষ হবে। বিক্রি চালিয়ে যেতে পরিশোধ করে ড্যাশবোর্ড থেকে পেমেন্টের প্রমাণ জমা দিন।`],
  }),
  payment_due: (p) => ({
    subject: `${storeName}: your subscription payment is due`,
    en: [
      "Your merchant subscription has ended.",
      p.graceEndsAt
        ? `Please pay and submit your payment proof from your dashboard by ${dateEn(p.graceEndsAt)}. After that date the account will be suspended until payment is verified.`
        : "Please pay and submit your payment proof from your dashboard.",
    ],
    bn: [
      "আপনার মার্চেন্ট সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে।",
      p.graceEndsAt
        ? `অনুগ্রহ করে ${dateBn(p.graceEndsAt)} এর মধ্যে পেমেন্ট করে ড্যাশবোর্ড থেকে পেমেন্টের প্রমাণ জমা দিন। এরপর পেমেন্ট যাচাই না হওয়া পর্যন্ত অ্যাকাউন্ট স্থগিত থাকবে।`
        : "অনুগ্রহ করে পেমেন্ট করে ড্যাশবোর্ড থেকে পেমেন্টের প্রমাণ জমা দিন।",
    ],
  }),
  account_suspended: () => ({
    subject: `${storeName}: your merchant account is suspended`,
    en: [
      "Your subscription was not paid within the grace period, so your merchant account is suspended and your products are hidden.",
      "Nothing has been deleted. Sign in to submit your payment proof or contact support.",
    ],
    bn: [
      "গ্রেস পিরিয়ডের মধ্যে সাবস্ক্রিপশন পরিশোধ না হওয়ায় আপনার মার্চেন্ট অ্যাকাউন্ট স্থগিত করা হয়েছে এবং পণ্যগুলো লুকানো আছে।",
      "কিছুই মুছে ফেলা হয়নি। পেমেন্টের প্রমাণ জমা দিতে বা সাপোর্টে যোগাযোগ করতে সাইন ইন করুন।",
    ],
  }),
  payment_rejected: (p) => ({
    subject: `${storeName}: your payment proof was not accepted`,
    en: [`Your payment proof of ${takaEn(p.amount)} was not accepted.`, `Reason: ${p.reason}`, "You can submit a new proof from your dashboard."],
    bn: [`আপনার ${takaBn(p.amount)} পেমেন্টের প্রমাণ গ্রহণ করা হয়নি।`, `কারণ: ${p.reason}`, "ড্যাশবোর্ড থেকে নতুন প্রমাণ জমা দিতে পারেন।"],
  }),
  account_activated: (p) => ({
    subject: `${storeName}: your merchant account is active`,
    en: [`Your payment was verified and your account is active until ${dateEn(p.paidUntil)}.`],
    bn: [`আপনার পেমেন্ট যাচাই হয়েছে এবং অ্যাকাউন্টটি ${dateBn(p.paidUntil)} পর্যন্ত সক্রিয়।`],
  }),
  ticket_reply: (p) => ({
    subject: `${storeName}: reply to your support request ${p.ticketNumber}`,
    en: [`N H Shop replied to your support request "${p.subject}" (${p.ticketNumber}). Sign in to your dashboard to read it.`],
    bn: [`আপনার সাপোর্ট অনুরোধ "${p.subject}" (${p.ticketNumber}) এর উত্তর দেওয়া হয়েছে। পড়তে ড্যাশবোর্ডে সাইন ইন করুন।`],
  }),
};

/** Email channel: merchant notifications with a template, to merchants who gave an email. */
const emailChannel = {
  name: "email",
  deliver: async ({ audience, merchant, type, params }) => {
    const template = MERCHANT_EMAILS[type];
    if (audience !== "merchant" || !template || !merchant?.email) return;
    await sendNotice({ to: merchant.email, name: merchant.name, ...template(params) });
  },
};

const channels = [emailChannel];

/**
 * Adds a delivery channel, e.g. web push: `{ name, deliver(notification) }`.
 * `deliver` receives `{ audience, merchant, type, params, link, category }`
 * after the dashboard record is stored, and may throw without harm.
 */
const registerChannel = (channel) => channels.push(channel);

/** Stores a notification and delivers it on every channel. Returns false when it was a duplicate. */
const notify = async ({ audience, merchant = null, type, params = {}, link = "", dedupeKey }) => {
  const notification = { audience, merchant: merchant?._id || merchant || null, type, params, link, category: CATEGORY[type] || "", ...(dedupeKey ? { dedupeKey } : {}) };
  try {
    await notificationModel.create(notification);
  } catch (error) {
    if (error.code === 11000) return false;
    console.error(`Notification ${type} could not be stored:`, error.message);
  }

  const full = { ...notification, merchant: merchant && typeof merchant === "object" && merchant.name !== undefined ? merchant : null };
  channels.forEach((channel) =>
    Promise.resolve()
      .then(() => channel.deliver(full))
      .catch((error) => console.error(`Notification ${type} via ${channel.name} failed:`, error.message))
  );
  return true;
};

/** A notification every administrator sees. */
const notifyAdmins = (options) => notify({ ...options, audience: "admin" });

/** A notification only `merchant` sees (pass the merchant document so channels can reach them). */
const notifyMerchant = (options) => notify({ ...options, audience: "merchant" });

module.exports = { notify, notifyAdmins, notifyMerchant, registerChannel, CATEGORY };
