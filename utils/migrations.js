const userModel = require("../models/user.model");
const merchantModel = require("../models/merchant.model");
const applicationModel = require("../models/merchantApplication.model");
const subscriptionModel = require("../models/subscription.model");
const { protectNid } = require("./nidCrypto");
const { normalizeNid } = require("./merchant");
const notificationModel = require("../models/notification.model");
const { CATEGORY } = require("./notify");

/*
 * Data changes the merchant system needs on databases created before it.
 * Run once at startup, after the database connects. Every step only touches
 * documents that still need it, so running it again (every restart) is safe
 * and does nothing. Nothing is deleted except the plain-text NID copy, and
 * only after its encrypted form is saved.
 */

/** Emails were required and unique for everyone; merchants may now have none. */
const relaxUserEmailIndex = async () => {
  const indexes = await userModel.collection.indexes().catch(() => []);
  const old = indexes.find((index) => index.name === "email_1" && index.unique && !index.partialFilterExpression);
  if (!old) return;
  await userModel.createIndexes();
  await userModel.collection.dropIndex("email_1");
  console.log("Migration: users email index now allows merchants without an email");
};

/** Moves plain-text NID numbers into the hashed + encrypted fields. */
const encryptStoredNids = async (model, label) => {
  const cursor = model.collection.find({ nidNumber: { $type: "string" }, nidHash: { $exists: false } }, { projection: { nidNumber: 1 } });
  let count = 0;
  for await (const doc of cursor) {
    const nid = normalizeNid(doc.nidNumber);
    if (!nid) continue;
    await model.collection.updateOne({ _id: doc._id, nidHash: { $exists: false } }, { $set: protectNid(nid), $unset: { nidNumber: "" } });
    count += 1;
  }
  // Numbers read off NID photos were briefly stored; they are NIDs too.
  await model.collection.updateMany({ "nidCheck.readNumbers": { $exists: true } }, { $unset: { "nidCheck.readNumbers": "" } });
  // Plain copies left behind on documents that were already protected.
  const leftovers = await model.collection.updateMany({ nidNumber: { $exists: true }, nidHash: { $exists: true } }, { $unset: { nidNumber: "" } });
  if (count || leftovers.modifiedCount) console.log(`Migration: encrypted ${count} ${label} NID numbers`);
};

/** Trial start dates and subscription history for merchants approved before they were recorded. */
const backfillSubscriptions = async () => {
  const merchants = await merchantModel.collection
    .find({}, { projection: { trialEndsAt: 1, trialStartsAt: 1, createdAt: 1, payments: 1, monthlyFee: 1 } })
    .toArray();
  let count = 0;
  for (const merchant of merchants) {
    if (merchant.trialEndsAt && !merchant.trialStartsAt) {
      await merchantModel.collection.updateOne({ _id: merchant._id }, { $set: { trialStartsAt: merchant.createdAt || merchant.trialEndsAt } });
    }
    if (await subscriptionModel.exists({ merchant: merchant._id })) continue;
    const records = [];
    if (merchant.trialEndsAt) {
      records.push({ merchant: merchant._id, kind: "trial", startsAt: merchant.trialStartsAt || merchant.createdAt || merchant.trialEndsAt, endsAt: merchant.trialEndsAt, source: "migration" });
    }
    (merchant.payments || []).forEach((payment) =>
      records.push({
        merchant: merchant._id,
        kind: "paid",
        startsAt: payment.periodStart,
        endsAt: payment.periodEnd,
        fee: merchant.monthlyFee || 0,
        amountPaid: payment.amount || 0,
        source: "migration",
        paymentSubmission: payment.submission || null,
        createdBy: payment.recordedBy || null,
        note: payment.reference || "",
      })
    );
    if (records.length) {
      await subscriptionModel.insertMany(records);
      count += 1;
    }
  }
  if (count) console.log(`Migration: subscription history created for ${count} merchants`);
};

/** Notification Center categories for notifications stored before categories existed. */
const backfillNotificationCategories = async () => {
  for (const [type, category] of Object.entries(CATEGORY)) {
    await notificationModel.updateMany({ type, $or: [{ category: { $exists: false } }, { category: "" }] }, { category });
  }
};

const runMigrations = async () => {
  const steps = [
    ["user email index", relaxUserEmailIndex],
    ["application NIDs", () => encryptStoredNids(applicationModel, "application")],
    ["merchant NIDs", () => encryptStoredNids(merchantModel, "merchant")],
    ["subscription history", backfillSubscriptions],
    ["notification categories", backfillNotificationCategories],
  ];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch (error) {
      console.error(`Migration "${name}" failed:`, error.message);
    }
  }
};

module.exports = { runMigrations };
