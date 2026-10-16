const productModel = require("../models/product.model");
const orderModel = require("../models/checkout.model");

/** Quantity per product id, so two variants of one product draw on the same stock. */
const quantitiesByProduct = (items) => {
  const totals = new Map();
  items.forEach((item) => {
    const id = String(item.product);
    totals.set(id, (totals.get(id) || 0) + Number(item.quntity || 1));
  });
  return totals;
};

/** Adds the units of `items` back to their products, for products that track stock. */
const restock = (items) =>
  Promise.all(
    [...quantitiesByProduct(items)].map(([id, quantity]) =>
      productModel.updateOne({ _id: id, stock: { $type: "number" } }, { $inc: { stock: quantity } })
    )
  );

/**
 * Takes the ordered units out of stock for every product that tracks stock,
 * before a new order is first saved. Each decrement only succeeds while enough
 * is left, so two customers can never buy the last unit twice. If any product
 * runs short, everything already taken is put back and that product is
 * returned so the caller can report it.
 *
 * Marks each affected line `stockDeducted` so it is released exactly once.
 */
const reserveStock = async (items) => {
  const taken = [];
  for (const [productId, quantity] of quantitiesByProduct(items)) {
    const result = await productModel.updateOne(
      { _id: productId, stock: { $type: "number", $gte: quantity } },
      { $inc: { stock: -quantity } }
    );
    if (result.modifiedCount) {
      taken.push([productId, quantity]);
      continue;
    }

    const product = await productModel.findById(productId).select("title stock").lean();
    if (product && typeof product.stock === "number") {
      await Promise.all(taken.map(([id, qty]) => productModel.updateOne({ _id: id }, { $inc: { stock: qty } })));
      return { ok: false, product };
    }
  }

  const tracked = new Set(taken.map(([id]) => id));
  items.forEach((item) => {
    item.stockDeducted = tracked.has(String(item.product));
  });
  return { ok: true };
};

/** Gives back what `reserveStock` took for an order that was never saved. */
const releaseUnsavedStock = (items) => restock(items.filter((item) => item.stockDeducted));

/**
 * Puts the units of a cancelled order back into stock — all of them, or only
 * one merchant's lines when `merchantId` is given.
 *
 * The `stockDeducted` flags are cleared in a single atomic update that returns
 * the order as it was, and only the lines that update actually cleared are
 * restocked. Two cancellations racing on the same order (a merchant and an
 * administrator, say) therefore never return the same units twice.
 */
const releaseStock = async (orderId, merchantId = null) => {
  const lineFilter = { "line.stockDeducted": true, ...(merchantId ? { "line.merchant": merchantId } : {}) };
  const before = await orderModel
    .findOneAndUpdate(
      { _id: orderId },
      { $set: { "items.$[line].stockDeducted": false } },
      { arrayFilters: [lineFilter], returnDocument: "before" }
    )
    .select("items")
    .lean();
  if (!before) return;

  await restock(
    before.items.filter((item) => item.stockDeducted && (!merchantId || String(item.merchant) === String(merchantId)))
  );
};

module.exports = { reserveStock, releaseUnsavedStock, releaseStock };
