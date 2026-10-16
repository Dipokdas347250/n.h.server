const os = require("os");
const path = require("path");
const { createWorker } = require("tesseract.js");

/*
 * Reads the NID number printed on the front of a card photo, so an applicant
 * cannot type one number and upload someone else's card.
 *
 * Outcomes of `checkNidPhoto`:
 * - "matched"     a 10, 13 or 17 digit number on the photo equals the typed one
 * - "mismatch"    the photo clearly shows a different NID number → refuse
 * - "unreadable"  no NID-length number could be read (blurry, rotated, dark)
 * - "unchecked"   the reader could not run (e.g. no language data yet)
 *
 * Only "mismatch" stops an application; the last two are flagged for the
 * administrator to check by eye, so a poor phone photo never locks out a
 * genuine applicant.
 *
 * The English language data is downloaded once from the tesseract.js CDN into
 * the system temp folder; set NID_OCR_LANG_PATH to a folder holding
 * eng.traineddata to run fully offline.
 */

const TIMEOUT_MS = 30 * 1000;
const NID_LENGTHS = [10, 13, 17];
const BN_DIGITS = { "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4", "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9" };

// One shared worker: OCR is CPU heavy, and the worker runs jobs one at a time,
// so a burst of applications queues instead of starving the API.
let workerPromise = null;
const getWorker = () => {
  if (!workerPromise) {
    workerPromise = createWorker("eng", 1, {
      cachePath: path.join(os.tmpdir(), "nh-shop-ocr"),
      ...(process.env.NID_OCR_LANG_PATH ? { langPath: process.env.NID_OCR_LANG_PATH, gzip: false } : {}),
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
};

/**
 * NID-length numbers in OCR text. Digits split by spaces or dashes ("600 123
 * 4567") are joined, and letters OCR often mistakes for digits are corrected
 * when they sit between digits.
 */
const nidCandidates = (text) => {
  const found = new Set();
  String(text || "")
    .replace(/[০-৯]/g, (digit) => BN_DIGITS[digit])
    .split(/\r?\n/)
    .forEach((line) => {
      const cleaned = line
        .replace(/(?<=\d)[Oo](?=[\dOo])|(?<=[\dOo])[Oo](?=\d)/g, "0")
        .replace(/(?<=\d)[Il|](?=\d)/g, "1")
        .replace(/(\d)[\s-]+(?=\d)/g, "$1");
      (cleaned.match(/\d+/g) || []).forEach((digits) => NID_LENGTHS.includes(digits.length) && found.add(digits));
    });
  return [...found];
};

/** 17-digit cards are the 13-digit number with the birth year in front, so either form matches the other. */
const sameNid = (a, b) => a === b || (a.length === 17 && b.length === 13 && a.endsWith(b)) || (b.length === 17 && a.length === 13 && b.endsWith(a));

/** Compares the typed NID number with the number on the front photo at `filePath`. */
const checkNidPhoto = async (filePath, nidNumber) => {
  let text;
  try {
    const worker = await getWorker();
    const result = await Promise.race([
      worker.recognize(filePath),
      new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS).unref()),
    ]);
    if (!result) return { status: "unreadable", readNumbers: [] };
    text = result.data?.text || "";
  } catch (error) {
    console.error("NID photo check could not run:", error.message);
    return { status: "unchecked", readNumbers: [] };
  }

  const readNumbers = nidCandidates(text);
  if (!readNumbers.length) return { status: "unreadable", readNumbers };
  if (readNumbers.some((number) => sameNid(number, nidNumber))) return { status: "matched", readNumbers };
  return { status: "mismatch", readNumbers };
};

module.exports = { checkNidPhoto, nidCandidates, sameNid };
