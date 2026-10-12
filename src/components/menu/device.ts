"use client";

export type DeviceInfo = {
  ios: boolean;
  android: boolean;
  mobile: boolean;
  /** Navigateur intégré (Instagram, Facebook, TikTok…) : l'AR y est souvent bloquée. */
  inApp: boolean;
};

export function detectDevice(): DeviceInfo {
  if (typeof navigator === "undefined") return { ios: false, android: false, mobile: false, inApp: false };
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|Twitter|LinkedInApp|Pinterest|GSA\//i.test(ua);
  return { ios, android, mobile: ios || android || /Mobi/i.test(ua), inApp };
}
