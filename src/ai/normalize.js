// src/ai/normalize.js
// Helpers for normalizing Apple and Samsung phone model names
// Converts messy Persian/English/shorthand model names into clean, searchable codes.

// =============================================
// Normalize Apple iPhone Models
// Input examples it can handle:
//  - "ایفون ۱۳ پرومکس", "iphone 13 pro max", "13pm", "14 pro", "۱۱ پرومکس"
// Output format:
//  { shortcode: "13pm", fullname: "iPhone 13 Pro Max" }
// =============================================
export function normalizeAppleModel(modelRaw = "", userText = "") {
  // Combine raw model + user text → lowercase → cleanup
  let t = (String(modelRaw) + " " + String(userText))
    .toLowerCase()
    // Persian → English word normalization
    .replace(/ایفون|آیفون/g, "iphone")
    .replace(/پرومکس|پرو\s*مکس/gi, " pro max")
    .replace(/پرومکس/gi, " pro max")
    .replace(/مکس/gi, " max")
    .replace(/پرو/gi, " pro")
    .replace(/مینی/g, " mini")
    .replace(/اولترا/g, " ultra")
    .replace(/پلاس/g, " plus")
    // Convert Persian digits to English (۰–۹ → 0–9)
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    // Remove all whitespace for easier pattern matching
    .replace(/\s+/g, "")
    .trim();

  // Direct shorthand → full iPhone model mapping
  // Covers the majority of known iPhone shorthand patterns.
  const shorthandMap = {
    17: "iPhone 17",
    "17p": "iPhone 17 Pro",
    "17pro": "iPhone 17 Pro",
    "17pm": "iPhone 17 Pro Max",
    "17promax": "iPhone 17 Pro Max",

    16: "iPhone 16",
    "16p": "iPhone 16 Pro",
    "16pro": "iPhone 16 Pro",
    "16pm": "iPhone 16 Pro Max",
    "16promax": "iPhone 16 Pro Max",

    15: "iPhone 15",
    "15p": "iPhone 15 Pro",
    "15pro": "iPhone 15 Pro",
    "15pm": "iPhone 15 Pro Max",
    "15promax": "iPhone 15 Pro Max",

    14: "iPhone 14",
    "14p": "iPhone 14 Pro",
    "14pro": "iPhone 14 Pro",
    "14pm": "iPhone 14 Pro Max",
    "14promax": "iPhone 14 Pro Max",

    13: "iPhone 13",
    "13p": "iPhone 13 Pro",
    "13pro": "iPhone 13 Pro",
    "13pm": "iPhone 13 Pro Max",
    "13promax": "iPhone 13 Pro Max",

    12: "iPhone 12",
    "12p": "iPhone 12 Pro",
    "12pro": "iPhone 12 Pro",
    "12pm": "iPhone 12 Pro Max",
    "12promax": "iPhone 12 Pro Max",

    11: "iPhone 11",
    "11p": "iPhone 11 Pro",
    "11pro": "iPhone 11 Pro",
    "11pm": "iPhone 11 Pro Max",
    "11promax": "iPhone 11 Pro Max",

    x: "iPhone X",
    10: "iPhone X",
    xs: "iPhone XS",
    xr: "iPhone XR",
    se: "iPhone SE",
  };

  // If the normalized string exactly matches a known shorthand → return immediately
  if (shorthandMap[t]) {
    return { shortcode: t, fullname: shorthandMap[t] };
  }

  // Otherwise, try to detect model number + variations using regex
  const m = t.match(
    /(?:iphone)?\s*(\d{1,2})(?:\s*pro)?(?:\s*max)?(?:\s*mini)?(?:\s*plus)?/i
  );
  if (!m) return null;

  // Extract numeric part (e.g., "13" from "iphone13promax")
  const num = m[1];

  // Detect extra flags such as "pro", "max", "mini", "plus"
  const hasPro = /pro/.test(t);
  const hasMax = /max/.test(t);
  const hasMini = /mini/.test(t);
  const hasPlus = /plus/.test(t);

  // Build output
  let shortcode = num;
  let fullname = `iPhone ${num}`;

  if (hasPro) {
    shortcode += "p";
    fullname += " Pro";
  }
  if (hasMax) {
    shortcode += "m";
    fullname += " Max";
  }
  if (hasMini) {
    // Mini models overwrite the shortcode entirely
    shortcode = "mini";
    fullname += " Mini";
  }
  if (hasPlus) {
    fullname += " Plus";
  }

  return { shortcode, fullname };
}

// =============================================
// Normalize Samsung Models
// Handles Persian, English, and compressed inputs like:
//   "سامسونگ A04s", "Samsung Galaxy A04", "a04", "s24 ultra", "note10"
// Detects A-series, S-series, Note, M-series, and Z Fold/Flip.
// =============================================
export function normalizeSamsungModel(modelRaw = "", userText = "") {
  // Combine and sanitize input
  const t = (String(modelRaw) + " " + String(userText))
    .toLowerCase()
    // Normalize Persian → English brand
    .replace(/سامسونگ/g, "samsung")
    // Drop "galaxy" keyword completely
    .replace(/galaxy/g, "")
    // Remove all whitespace
    .replace(/\s+/g, "")
    .trim();

  // Match Samsung A-series (A04, A14, ...)
  const a = t.match(/samsunga?(\d{1,3})/);
  if (a) return { shortcode: `a${a[1]}`, fullname: `Samsung A${a[1]}` };

  // Match Samsung S-series (S24, S24 Ultra, ...)
  const s = t.match(/samsungs?(\d{1,3})(ultra)?/);
  if (s) {
    const code = s[2] ? `s${s[1]}u` : `s${s[1]}`;
    const full = s[2] ? `Samsung S${s[1]} Ultra` : `Samsung S${s[1]}`;
    return { shortcode: code, fullname: full };
  }

  // Match Samsung Note-series (Note 10, Note 20)
  const n = t.match(/note(\d{1,3})/);
  if (n) return { shortcode: `note${n[1]}`, fullname: `Samsung Note ${n[1]}` };

  // Match Samsung M-series (M31, M51, ...)
  const m = t.match(/m(\d{1,3})/);
  if (m) return { shortcode: `m${m[1]}`, fullname: `Samsung M${m[1]}` };

  // Match Samsung Z Fold / Z Flip (Fold4, Flip5, ...)
  const z = t.match(/z(fold|flip)(\d{1,2})?/);
  if (z) {
    const series = z[1]; // fold or flip
    const num = z[2] || ""; // optional number
    return {
      shortcode: `z${series}${num}`,
      fullname: `Samsung Z ${series} ${num}`.trim(),
    };
  }

  // If no known Samsung pattern matched
  return null;
}
