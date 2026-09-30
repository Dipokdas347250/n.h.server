/**
 * Device, operating system and browser from a User-Agent string. Deliberately
 * small: it only needs to be right for the phones and browsers shoppers use.
 * `touch` is the browser's maxTouchPoints, which unmasks iPads that report
 * themselves as Macs.
 */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;

const firstMatch = (ua, rules) => rules.find(([pattern]) => pattern.test(ua))?.[1] || "Other";

const OS_RULES = [
  [/windows phone/i, "Windows Phone"],
  [/windows/i, "Windows"],
  [/iphone|ipad|ipod/i, "iOS"],
  [/android/i, "Android"],
  [/cros/i, "ChromeOS"],
  [/mac os x|macintosh/i, "macOS"],
  [/linux/i, "Linux"],
];

// In-app browsers first: their strings also contain Chrome or Safari.
const BROWSER_RULES = [
  [/FBAN|FBAV|FB_IAB/, "Facebook"],
  [/Instagram/, "Instagram"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera|OPiOS/, "Opera"],
  [/UCBrowser/, "UC Browser"],
  [/YaBrowser/, "Yandex"],
  [/Firefox|FxiOS/, "Firefox"],
  [/Chrome|CriOS/, "Chrome"],
  [/Safari/, "Safari"],
];

const parseUserAgent = (ua = "", touch = 0) => {
  const text = String(ua);
  const isBot = !text || BOT.test(text);

  let os = firstMatch(text, OS_RULES);
  let device = "desktop";
  if (/ipad|tablet|playbook|silk|kindle/i.test(text) || (/android/i.test(text) && !/mobile/i.test(text))) device = "tablet";
  else if (/mobi|iphone|ipod|android|windows phone/i.test(text)) device = "mobile";
  else if (os === "macOS" && Number(touch) > 1) {
    device = "tablet";
    os = "iOS";
  }

  return { isBot, device, os, browser: firstMatch(text, BROWSER_RULES) };
};

module.exports = { parseUserAgent };
