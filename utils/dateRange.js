/**
 * The shop runs on Bangladesh time (UTC+6, no daylight saving), so a "day" in
 * the dashboard means midnight-to-midnight in Dhaka, not in UTC or on whatever
 * machine hosts the API.
 */
const TIMEZONE = "Asia/Dhaka";
const OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The Dhaka calendar date of an instant, as `YYYY-MM-DD`. */
const dhakaDateOf = (instant) => new Date(new Date(instant).getTime() + OFFSET_MS).toISOString().slice(0, 10);

/** Today's date in Dhaka as `YYYY-MM-DD`. */
const todayInDhaka = () => dhakaDateOf(Date.now());

/** Start of the Dhaka day `YYYY-MM-DD` as a UTC instant, or null if malformed. */
const startOfDhakaDay = (value) => {
  const match = DATE_PATTERN.exec(String(value || "").trim());
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - OFFSET_MS);
  return Number.isNaN(start.getTime()) ? null : start;
};

/**
 * Turns `from`/`to` query strings into a half-open `[start, end)` range covering
 * both whole days. Either end may be missing; `to` alone means that single day.
 * Returns null when neither end was given.
 */
const parseDateRange = ({ from, to } = {}) => {
  const start = startOfDhakaDay(from) || startOfDhakaDay(to);
  const lastDay = startOfDhakaDay(to) || startOfDhakaDay(from);
  if (!start || !lastDay) return null;

  // Accept a reversed range rather than returning nothing.
  const [first, last] = start <= lastDay ? [start, lastDay] : [lastDay, start];
  return { start: first, end: new Date(last.getTime() + DAY_MS) };
};

module.exports = { TIMEZONE, DAY_MS, dhakaDateOf, todayInDhaka, startOfDhakaDay, parseDateRange };
