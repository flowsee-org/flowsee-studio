// Jalali (Persian) calendar <-> Julian Day Number conversion.
// Canonical public-domain algorithm (jalaali-js), used here to compute
// Persian weekdays and to add/subtract days across Persian month/year
// boundaries — where the old `new Date(y, m-1, 1).getDay()` approach was
// wrong because it treated Persian years as Gregorian.
//
// Weekday convention used across this app: Saturday = 0 ... Friday = 6.

const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

function jalCal(jy) {
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;
  let i;
  for (i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const gy = jy + 621;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

/** Gregorian y/m/d -> Julian Day Number */
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** Julian Day Number -> Gregorian y/m/d */
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/** Jalali y/m/d -> Julian Day Number */
export function jalaliToJdn(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/** Julian Day Number -> Jalali y/m/d */
export function jdnToJalali(jdn) {
  const g = d2g(jdn);
  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm, jd;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/** "1405/06/12" (or "14050612") -> weekday, Saturday = 0 ... Friday = 6 */
export function persianWeekday(key) {
  const s = String(key || "").replace(/\//g, "");
  if (s.length !== 8) return undefined;
  const jdn = jalaliToJdn(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
  // Verified against known weekdays: jdn % 7 with this offset gives Saturday = 0.
  return mod(jdn + 2, 7);
}

/** Compact "14050612" + integer days -> compact key. Returns "" on invalid input. */
export function addDaysToKey(key, days) {
  const s = String(key || "").replace(/\//g, "");
  if (s.length !== 8) return "";
  const jdn = jalaliToJdn(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
  const r = jdnToJalali(jdn + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${r.jy}${pad(r.jm)}${pad(r.jd)}`;
}

/** True when the Jalali year has a 30-day Esfand (leap year). */
export function isJalaliLeap(jy) {
  return jdnToJalali(jalaliToJdn(jy, 12, 29) + 1).jy === jy;
}