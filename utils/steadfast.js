/**
 * Steadfast Courier (packzy) API client.
 *
 * Credentials come from Dashboard → Store settings, falling back to the
 * STEADFAST_API_KEY / STEADFAST_SECRET_KEY environment variables.
 * API reference: https://steadfast.com.bd/api-docs
 */
const BASE_URL = (process.env.STEADFAST_BASE_URL || "https://portal.packzy.com/api/v1").replace(/\/+$/, "");
const TIMEOUT_MS = 20 * 1000;

class SteadfastError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = "SteadfastError";
    this.status = status;
    this.details = details;
  }
}

const credentialsFrom = (settings) => ({
  apiKey: settings?.steadfast?.apiKey || process.env.STEADFAST_API_KEY || "",
  secretKey: settings?.steadfast?.secretKey || process.env.STEADFAST_SECRET_KEY || "",
});

const isConfigured = (settings) => {
  const { apiKey, secretKey } = credentialsFrom(settings);
  return Boolean(apiKey && secretKey);
};

/** Steadfast reports validation problems as `{ errors: { field: [msg] } }`. */
const describeFailure = (body, status) => {
  if (body?.errors && typeof body.errors === "object") {
    const lines = Object.values(body.errors).flat().filter(Boolean);
    if (lines.length) return lines.join(" ");
  }
  return body?.message || `Steadfast responded with HTTP ${status}`;
};

const request = async (settings, method, path, body) => {
  const { apiKey, secretKey } = credentialsFrom(settings);
  if (!apiKey || !secretKey) throw new SteadfastError("Steadfast API keys are not set", { status: 0 });

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Api-Key": apiKey, "Secret-Key": secretKey, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new SteadfastError(`Could not reach Steadfast: ${error.message}`, { status: 0 });
  }

  const payload = await response.json().catch(() => null);
  // Steadfast sometimes answers HTTP 200 with a non-200 `status` in the body.
  if (!response.ok || (payload?.status && Number(payload.status) !== 200)) {
    throw new SteadfastError(describeFailure(payload, response.status), { status: response.status, details: payload });
  }
  return payload || {};
};

/** Converts one of our orders into a Steadfast parcel. */
const parcelFromOrder = (order) => {
  const customer = order.shipping || order.customer || {};
  const address = [customer.address, customer.city, customer.district, customer.postcode]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    // The street line often already names the city; don't repeat it.
    .filter((part, index, parts) => index === 0 || !parts[0].toLowerCase().includes(part.toLowerCase()))
    .join(", ");

  const items = (order.items || [])
    .map((item) => `${item.title || "Item"} x${item.quntity || 1}`)
    .join(", ");

  const parcel = {
    invoice: order.orderNumber,
    recipient_name: String(customer.name || "").slice(0, 100),
    recipient_phone: String(customer.phone || "").replace(/\D/g, "").slice(-11),
    recipient_address: address.slice(0, 250),
    // Already paid online: the courier must not collect again.
    cod_amount: order.paymentStatus === "paid" ? 0 : Math.round(Number(order.totalprice) || 0),
    note: String(customer.note || "").slice(0, 250),
    item_description: items.slice(0, 250),
    total_lot: (order.items || []).reduce((sum, item) => sum + (Number(item.quntity) || 1), 0) || 1,
  };
  if (customer.email) parcel.recipient_email = customer.email;
  return parcel;
};

/** Books the parcel. Returns `{ consignmentId, trackingCode, status }`. */
const createParcel = async (settings, order) => {
  const payload = await request(settings, "POST", "/create_order", parcelFromOrder(order));
  const consignment = payload.consignment || {};
  if (!consignment.consignment_id) {
    throw new SteadfastError(payload.message || "Steadfast did not return a consignment", { details: payload });
  }
  return {
    consignmentId: String(consignment.consignment_id),
    trackingCode: String(consignment.tracking_code || ""),
    status: String(consignment.status || "in_review"),
  };
};

/** Current delivery status of a booked parcel, e.g. `in_review`, `delivered`. */
const parcelStatus = async (settings, consignmentId) => {
  const payload = await request(settings, "GET", `/status_by_cid/${encodeURIComponent(consignmentId)}`);
  return String(payload.delivery_status || "unknown");
};

/** Account balance; also a cheap way to test the keys. */
const balance = async (settings) => {
  const payload = await request(settings, "GET", "/get_balance");
  return Number(payload.current_balance || 0);
};

const trackingUrl = (trackingCode) => (trackingCode ? `https://steadfast.com.bd/t/${encodeURIComponent(trackingCode)}` : "");

module.exports = {
  SteadfastError,
  isConfigured,
  credentialsFrom,
  parcelFromOrder,
  createParcel,
  parcelStatus,
  balance,
  trackingUrl,
};
