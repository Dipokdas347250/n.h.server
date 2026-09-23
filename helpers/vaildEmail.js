/** Loose but practical email check used before hitting the database. */
exports.vaildEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
