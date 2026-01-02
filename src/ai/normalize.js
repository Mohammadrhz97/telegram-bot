// ===============================================================
// normalize.js — FINAL FULL VERSION (2025)
// Intelligent model normalizer for:
//   • Apple (iPhone)
//   • Samsung (A / S / Note / M / Z Fold / Z Flip)
//   • Xiaomi
//   • Redmi (Note-series / Number-series)
//   • Poco (X-series / F-series)
// Converts messy Persian/English shorthand into clean SHORTCODES.
//
// Output format:
//   {
//     brand: "apple" | "samsung" | "xiaomi" | "redmi" | "poco",
//     shortcode: "app-13pm",
//     modelCore: "13pm",
//     fullname: "iPhone 13 Pro Max"
//   }
//
// Used everywhere across the bot (search, adminAddProduct, etc.)
// ===============================================================

// ---------------------------------------------------------------
// Persian → English digits
// ---------------------------------------------------------------
function toEnglishDigits(str = "") {
  const map = "۰۱۲۳۴۵۶۷۸۹";
  return String(str).replace(/[۰-۹]/g, (d) => map.indexOf(d));
}

// ---------------------------------------------------------------
// Basic sanitization
// ---------------------------------------------------------------
function baseSanitize(modelRaw = "", userText = "") {
  return toEnglishDigits(`${modelRaw} ${userText}`)
    .toLowerCase()
    .replace(/\s+/g, "")
    .trim();
}

// ===============================================================
// APPLE NORMALIZER
// ===============================================================
export function normalizeAppleModel(modelRaw = "", userText = "") {
  let t = baseSanitize(modelRaw, userText)
    .replace(/ایفون|آیفون/g, "iphone")
    .replace(/پرومکس/g, "promax")
    .replace(/پرو/g, "pro")
    .replace(/مکس/g, "max")
    .replace(/مینی/g, "mini")
    .replace(/پلاس/g, "plus");

  // Direct shorthand map
  const shorthandMap = {
    17: "iPhone 17",
    "17p": "iPhone 17 Pro",
    "17pm": "iPhone 17 Pro Max",
    16: "iPhone 16",
    "16p": "iPhone 16 Pro",
    "16pm": "iPhone 16 Pro Max",
    15: "iPhone 15",
    "15p": "iPhone 15 Pro",
    "15pm": "iPhone 15 Pro Max",
    14: "iPhone 14",
    "14p": "iPhone 14 Pro",
    "14pm": "iPhone 14 Pro Max",
    13: "iPhone 13",
    "13p": "iPhone 13 Pro",
    "13pm": "iPhone 13 Pro Max",
    12: "iPhone 12",
    "12p": "iPhone 12 Pro",
    "12pm": "iPhone 12 Pro Max",
    11: "iPhone 11",
    "11p": "iPhone 11 Pro",
    "11pm": "iPhone 11 Pro Max",
    x: "iPhone X",
    xs: "iPhone XS",
    xr: "iPhone XR",
    se: "iPhone SE",
    8: "iPhone 8",
    "8p": "iPhone 8 Plus",
  };

  if (shorthandMap[t]) {
    return { shortcode: t, fullname: shorthandMap[t] };
  }

  // Generic pattern
  const m = t.match(/(?:iphone)?(\d{1,2})(pro)?(max)?(mini)?(plus)?/);
  if (!m) return null;

  const num = m[1];
  const hasPro = !!m[2];
  const hasMax = !!m[3];
  const hasMini = !!m[4];
  const hasPlus = !!m[5];

  let core = num;
  let full = `iPhone ${num}`;

  if (hasMini) {
    core += "mini";
    full += " Mini";
  } else {
    if (hasPro) {
      core += "p";
      full += " Pro";
    }
    if (hasMax) {
      core += "m";
      full += " Max";
    }
  }

  if (hasPlus && !hasMini && !hasMax) {
    full += " Plus";
  }

  return { shortcode: core, fullname: full };
}

// ===============================================================
// SAMSUNG NORMALIZER
// ===============================================================
export function normalizeSamsungModel(modelRaw = "", userText = "") {
  let t = baseSanitize(modelRaw, userText)
    .replace(/سامسونگ/g, "samsung")
    .replace(/گلکسی|galaxy/g, "");

  // A-series
  const a = t.match(/samsunga?(\d{1,3})/);
  if (a) {
    const n = a[1];
    return { shortcode: `a${n}`, fullname: `Samsung A${n}` };
  }

  // S-series
  const s = t.match(/samsungs?(\d{1,3})(ultra)?/);
  if (s) {
    const n = s[1];
    const ultra = !!s[2];
    return {
      shortcode: ultra ? `s${n}u` : `s${n}`,
      fullname: ultra ? `Samsung S${n} Ultra` : `Samsung S${n}`,
    };
  }

  // Note-series
  const note = t.match(/note(\d{1,2})(ultra)?/);
  if (note) {
    const n = note[1];
    const ultra = !!note[2];
    return {
      shortcode: `note${n}`,
      fullname: ultra ? `Samsung Note ${n} Ultra` : `Samsung Note ${n}`,
    };
  }

  // M-series
  const m = t.match(/samsungm(\d{1,3})/);
  if (m) {
    const n = m[1];
    return { shortcode: `m${n}`, fullname: `Samsung M${n}` };
  }

  // Z-series
  const z = t.match(/samsungz(fold|flip)(\d{1,2})?/);
  if (z) {
    const series = z[1];
    const num = z[2] || "";
    return {
      shortcode: `z${series}${num}`,
      fullname: `Samsung Z ${series} ${num}`.trim(),
    };
  }

  return null;
}

// ===============================================================
// XIAOMI / REDMI / POCO NORMALIZER (FULL VERSION)
// ===============================================================
function normalizeXiaomiFamilyCore(
  brandHint = "xiaomi",
  modelRaw = "",
  userText = ""
) {
  let t = baseSanitize(modelRaw, userText)
    .replace(/شیائومی|شیاومی/g, "xiaomi")
    .replace(/ردمی/g, "redmi")
    .replace(/پوکو/g, "poco");

  const brand =
    /redmi/.test(t) || brandHint === "redmi"
      ? "redmi"
      : /poco/.test(t) || brandHint === "poco"
      ? "poco"
      : "xiaomi";

  const brandName =
    brand === "redmi" ? "Redmi" : brand === "poco" ? "Poco" : "Xiaomi";

  // Remove brand words
  t = t.replace(/xiaomi|redmi|poco/g, "");

  // ---------------------------------------------------------------
  // NOTE-SERIES
  // ---------------------------------------------------------------
  const note = t.match(
    /note(\d{1,3})(t)?(pro)?(\+|plus)?(s)?(se)?(max)?(ultra)?/
  );
  if (note) {
    const num = note[1];
    let core = `n${num}`;
    let full = `${brandName} Note ${num}`;

    if (note[2]) {
      core += "t";
      full += "T";
    }
    if (note[3]) {
      core += "p";
      full += " Pro";
    }
    if (note[4]) {
      core += "pplus";
      full += " Pro Plus";
    }
    if (note[5]) {
      core += "s";
      full += "S";
    }
    if (note[6]) {
      core += "se";
      full += " SE";
    }
    if (note[7]) {
      core += "max";
      full += " Max";
    }
    if (note[8]) {
      core += "u";
      full += " Ultra";
    }

    return { shortcode: core, fullname: full };
  }

  // ---------------------------------------------------------------
  // T-series
  // ---------------------------------------------------------------
  const tSeries = t.match(/(\d{1,2})t(pro)?/);
  if (tSeries) {
    const num = tSeries[1];
    let core = `${num}t`;
    let full = `${brandName} ${num}T`;
    if (tSeries[2]) {
      core += "p";
      full += " Pro";
    }
    return { shortcode: core, fullname: full };
  }

  // ---------------------------------------------------------------
  // X-series
  // ---------------------------------------------------------------
  const x = t.match(/x(\d{1,2})(pro)?/);
  if (x) {
    const num = x[1];
    let core = `x${num}`;
    let full = `${brandName} X${num}`;
    if (x[2]) {
      core += "p";
      full += " Pro";
    }
    return { shortcode: core, fullname: full };
  }

  // ---------------------------------------------------------------
  // F-series (Poco)
  // ---------------------------------------------------------------
  const f = t.match(/f(\d{1,2})(pro)?/);
  if (f) {
    const num = f[1];
    let core = `f${num}`;
    let full = `${brandName} F${num}`;
    if (f[2]) {
      core += "p";
      full += " Pro";
    }
    return { shortcode: core, fullname: full };
  }

  // ---------------------------------------------------------------
  // Simple numbers
  // ---------------------------------------------------------------
  const numOnly = t.match(/^(\d{1,2})$/);
  if (numOnly) {
    const num = numOnly[1];
    return {
      shortcode: num,
      fullname: `${brandName} ${num}`,
    };
  }

  return null;
}

// ===============================================================
// MAIN NORMALIZER: normalizeAnyModel()
// ===============================================================
export function normalizeAnyModel(modelRaw = "", userText = "") {
  const raw = `${modelRaw} ${userText}`.toLowerCase();

  // Brand detection
  const hasApple = /ایفون|آیفون|iphone/.test(raw);
  const hasSamsung = /سامسونگ|samsung|galaxy/.test(raw);
  const hasXiaomi = /شیائومی|شیاومی|xiaomi/.test(raw);
  const hasRedmi = /ردمی|redmi/.test(raw);
  const hasPoco = /پوکو|poco/.test(raw);

  // Explicit brands
  if (hasApple) {
    const core = normalizeAppleModel(modelRaw, userText);
    return core
      ? {
          brand: "apple",
          shortcode: `app-${core.shortcode}`,
          modelCore: core.shortcode,
          fullname: core.fullname,
        }
      : null;
  }

  if (hasSamsung) {
    const core = normalizeSamsungModel(modelRaw, userText);
    return core
      ? {
          brand: "samsung",
          shortcode: `sam-${core.shortcode}`,
          modelCore: core.shortcode,
          fullname: core.fullname,
        }
      : null;
  }

  if (hasRedmi || hasXiaomi || hasPoco) {
    const hint = hasRedmi ? "redmi" : hasPoco ? "poco" : "xiaomi";
    const core = normalizeXiaomiFamilyCore(hint, modelRaw, userText);
    if (!core) return null;

    const prefix = hint === "redmi" ? "red" : hint === "poco" ? "poc" : "xia";
    return {
      brand: hint,
      shortcode: `${prefix}-${core.shortcode}`,
      modelCore: core.shortcode,
      fullname: core.fullname,
    };
  }

  // Try guessing brand if user didn't specify
  const guessApple = normalizeAppleModel(modelRaw, userText);
  if (guessApple) {
    return {
      brand: "apple",
      shortcode: `app-${guessApple.shortcode}`,
      modelCore: guessApple.shortcode,
      fullname: guessApple.fullname,
    };
  }

  const guessSamsung = normalizeSamsungModel(modelRaw, userText);
  if (guessSamsung) {
    return {
      brand: "samsung",
      shortcode: `sam-${guessSamsung.shortcode}`,
      modelCore: guessSamsung.shortcode,
      fullname: guessSamsung.fullname,
    };
  }

  const guessXiaomi = normalizeXiaomiFamilyCore("xiaomi", modelRaw, userText);
  if (guessXiaomi) {
    return {
      brand: "xiaomi",
      shortcode: `xia-${guessXiaomi.shortcode}`,
      modelCore: guessXiaomi.shortcode,
      fullname: guessXiaomi.fullname,
    };
  }

  return null;
}
