const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Format a UI number with Persian digits while keeping stored values numeric. */
export function formatPersianNumber(value, options = {}) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return "۰";

  return new Intl.NumberFormat("fa-IR-u-nu-arabext", {
    maximumFractionDigits: 2,
    ...options,
  }).format(number);
}

/** Localize ASCII digits in display-only strings such as dates and relative time. */
export function formatPersianDigits(value) {
  return String(value ?? "").replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}
