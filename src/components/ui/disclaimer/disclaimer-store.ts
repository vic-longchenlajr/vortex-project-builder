// src/core/ui/disclaimer/disclaimer-store.ts
const KEY_DATE = "vortex:disclaimerDismissedDate";
const KEY_VER = "vortex:disclaimerDismissedVersion";

/**
 * Bump this string whenever you change the disclaimer text/meaning
 * to force everyone to see it again.
 */
export const DISCLAIMER_VERSION = "n2-total-capacity-2026-01-22";

export function todayLocalYYYYMMDD(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function shouldShowDisclaimer(version = DISCLAIMER_VERSION) {
  try {
    const dismissedDate = localStorage.getItem(KEY_DATE);
    const dismissedVer = localStorage.getItem(KEY_VER);
    const today = todayLocalYYYYMMDD();

    if (!dismissedDate) return true;
    if (dismissedDate !== today) return true;
    if (dismissedVer !== version) return true;

    return false;
  } catch {
    // If storage is blocked, fail "open" (show it)
    return true;
  }
}

export function dismissDisclaimerForToday(version = DISCLAIMER_VERSION) {
  try {
    localStorage.setItem(KEY_DATE, todayLocalYYYYMMDD());
    localStorage.setItem(KEY_VER, version);
  } catch {
    /* ignore */
  }
}
