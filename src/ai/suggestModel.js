// src/ai/suggestModel.js
// Suggest model shortcodes for admin while typing
// Brands covered: Apple (app-*), Samsung (sam-*), Xiaomi (xia-*), Redmi (red-*), Poco (poc-*)

// -------------------------------
// Small helpers
// -------------------------------
function toEnglishDigits(str) {
  if (!str) return "";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(str).replace(/[۰-۹]/g, (d) => persian.indexOf(d));
}

function normalizeText(str) {
  return toEnglishDigits(str)
    .toLowerCase()
    .replace(/ایفون|آیفون/g, "iphone")
    .replace(/سامسونگ/g, "samsung")
    .replace(/شیائومی|شیاومی|شیامی/g, "xiaomi")
    .replace(/ردمی/g, "redmi")
    .replace(/پوکو/g, "poco")
    .replace(/galaxy/g, "")
    .replace(/[\s\-\_]+/g, "")
    .trim();
}

// Simple similarity: longer common substring / input length
function similarity(a, b) {
  if (!a || !b) return 0;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;

  let maxCommon = 0;
  for (let i = 0; i < na.length; i++) {
    for (let j = i + 1; j <= na.length; j++) {
      const sub = na.slice(i, j);
      if (nb.includes(sub) && sub.length > maxCommon) {
        maxCommon = sub.length;
      }
    }
  }
  return maxCommon / na.length;
}

// -------------------------------
// Model catalog
// Each item: { shortcode, label, keywords: [] }
// shortcode will be stored in DB (e.g. "app-13pm")
// label is a human-readable description
// keywords are for matching different ways of typing the same model
// -------------------------------

/** @type {Array<{shortcode: string, label: string, keywords: string[]}>} */
export const MODEL_CATALOG = [
  // ======================
  // APPLE - iPhone
  // ======================
  {
    shortcode: "app-17",
    label: "iPhone 17",
    keywords: ["iphone17", "ایفون ۱۷"],
  },
  {
    shortcode: "app-17p",
    label: "iPhone 17 Pro",
    keywords: ["iphone17pro", "17pro", "ایفون ۱۷ پرو"],
  },
  {
    shortcode: "app-17pm",
    label: "iPhone 17 Pro Max",
    keywords: ["iphone17promax", "17promax", "17pm", "ایفون ۱۷ پرومکس"],
  },

  {
    shortcode: "app-16",
    label: "iPhone 16",
    keywords: ["iphone16", "ایفون ۱۶"],
  },
  {
    shortcode: "app-16p",
    label: "iPhone 16 Pro",
    keywords: ["iphone16pro", "16pro", "ایفون ۱۶ پرو"],
  },
  {
    shortcode: "app-16pm",
    label: "iPhone 16 Pro Max",
    keywords: ["iphone16promax", "16promax", "16pm", "ایفون ۱۶ پرومکس"],
  },

  {
    shortcode: "app-15",
    label: "iPhone 15",
    keywords: ["iphone15", "ایفون ۱۵"],
  },
  {
    shortcode: "app-15p",
    label: "iPhone 15 Pro",
    keywords: ["iphone15pro", "15pro", "ایفون ۱۵ پرو"],
  },
  {
    shortcode: "app-15pm",
    label: "iPhone 15 Pro Max",
    keywords: ["iphone15promax", "15promax", "15pm", "ایفون ۱۵ پرومکس"],
  },

  {
    shortcode: "app-14",
    label: "iPhone 14",
    keywords: ["iphone14", "ایفون ۱۴"],
  },
  {
    shortcode: "app-14p",
    label: "iPhone 14 Pro",
    keywords: ["iphone14pro", "14pro", "ایفون ۱۴ پرو"],
  },
  {
    shortcode: "app-14pm",
    label: "iPhone 14 Pro Max",
    keywords: ["iphone14promax", "14promax", "14pm", "ایفون ۱۴ پرومکس"],
  },

  {
    shortcode: "app-13",
    label: "iPhone 13",
    keywords: ["iphone13", "ایفون ۱۳"],
  },
  {
    shortcode: "app-13p",
    label: "iPhone 13 Pro",
    keywords: ["iphone13pro", "13pro", "ایفون ۱۳ پرو"],
  },
  {
    shortcode: "app-13pm",
    label: "iPhone 13 Pro Max",
    keywords: ["iphone13promax", "13promax", "13pm", "ایفون ۱۳ پرومکس"],
  },

  {
    shortcode: "app-12",
    label: "iPhone 12",
    keywords: ["iphone12", "ایفون ۱۲"],
  },
  {
    shortcode: "app-12p",
    label: "iPhone 12 Pro",
    keywords: ["iphone12pro", "12pro", "ایفون ۱۲ پرو"],
  },
  {
    shortcode: "app-12pm",
    label: "iPhone 12 Pro Max",
    keywords: ["iphone12promax", "12promax", "12pm", "ایفون ۱۲ پرومکس"],
  },

  {
    shortcode: "app-11",
    label: "iPhone 11",
    keywords: ["iphone11", "ایفون ۱۱"],
  },
  {
    shortcode: "app-11p",
    label: "iPhone 11 Pro",
    keywords: ["iphone11pro", "11pro", "ایفون ۱۱ پرو"],
  },
  {
    shortcode: "app-11pm",
    label: "iPhone 11 Pro Max",
    keywords: ["iphone11promax", "11promax", "11pm", "ایفون ۱۱ پرومکس"],
  },

  {
    shortcode: "app-x",
    label: "iPhone X",
    keywords: ["iphonex", "iphone10", "ایفون ایکس", "ایفون ۱۰"],
  },
  {
    shortcode: "app-xs",
    label: "iPhone XS",
    keywords: ["iphonexs", "xs", "ایفون ایکس اس"],
  },
  {
    shortcode: "app-xr",
    label: "iPhone XR",
    keywords: ["iphonexr", "xr", "ایفون ایکس آر"],
  },
  {
    shortcode: "app-se2",
    label: "iPhone SE (2nd Gen)",
    keywords: ["iphonese2", "se2", "ایفون اس ای ۲"],
  },

  // ======================
  // SAMSUNG - S series
  // ======================
  {
    shortcode: "sam-s24",
    label: "Samsung S24",
    keywords: ["s24", "galaxys24", "سامسونگ s24"],
  },
  {
    shortcode: "sam-s24p",
    label: "Samsung S24+",
    keywords: ["s24plus", "s24+", "galaxys24plus"],
  },
  {
    shortcode: "sam-s24u",
    label: "Samsung S24 Ultra",
    keywords: ["s24ultra", "galaxys24ultra", "s24u"],
  },

  {
    shortcode: "sam-s23",
    label: "Samsung S23",
    keywords: ["s23", "galaxys23", "سامسونگ s23"],
  },
  {
    shortcode: "sam-s23p",
    label: "Samsung S23+",
    keywords: ["s23plus", "s23+", "galaxys23plus"],
  },
  {
    shortcode: "sam-s23u",
    label: "Samsung S23 Ultra",
    keywords: ["s23ultra", "galaxys23ultra", "s23u"],
  },

  {
    shortcode: "sam-s22",
    label: "Samsung S22",
    keywords: ["s22", "galaxys22"],
  },
  {
    shortcode: "sam-s22p",
    label: "Samsung S22+",
    keywords: ["s22plus", "s22+", "galaxys22plus"],
  },
  {
    shortcode: "sam-s22u",
    label: "Samsung S22 Ultra",
    keywords: ["s22ultra", "galaxys22ultra", "s22u"],
  },

  // ======================
  // SAMSUNG - A series
  // ======================
  {
    shortcode: "sam-a14",
    label: "Samsung A14",
    keywords: ["a14", "galaxya14", "سامسونگ a14"],
  },
  {
    shortcode: "sam-a24",
    label: "Samsung A24",
    keywords: ["a24", "galaxya24"],
  },
  {
    shortcode: "sam-a34",
    label: "Samsung A34",
    keywords: ["a34", "galaxya34"],
  },
  {
    shortcode: "sam-a54",
    label: "Samsung A54",
    keywords: ["a54", "galaxya54"],
  },
  {
    shortcode: "sam-a05s",
    label: "Samsung A05s",
    keywords: ["a05s", "galaxya05s", "a5s"],
  },

  // ======================
  // SAMSUNG - Note / Others
  // ======================
  {
    shortcode: "sam-note10",
    label: "Samsung Note 10",
    keywords: ["note10", "galaxynote10"],
  },
  {
    shortcode: "sam-note10p",
    label: "Samsung Note 10+",
    keywords: ["note10plus", "note10+", "galaxynote10plus"],
  },
  {
    shortcode: "sam-note20",
    label: "Samsung Note 20",
    keywords: ["note20", "galaxynote20"],
  },
  {
    shortcode: "sam-note20u",
    label: "Samsung Note 20 Ultra",
    keywords: ["note20ultra", "galaxynote20ultra"],
  },

  // ======================
  // XIAOMI (xia-*)
  // ======================
  {
    shortcode: "xia-13",
    label: "Xiaomi 13",
    keywords: ["xiaomi13", "mi13", "شیائومی ۱۳"],
  },
  {
    shortcode: "xia-13pro",
    label: "Xiaomi 13 Pro",
    keywords: ["xiaomi13pro", "13proxiaomi", "شیائومی ۱۳ پرو"],
  },
  {
    shortcode: "xia-13t",
    label: "Xiaomi 13T",
    keywords: ["xiaomi13t", "13t", "شیائومی ۱۳ تی"],
  },
  {
    shortcode: "xia-13tpro",
    label: "Xiaomi 13T Pro",
    keywords: ["xiaomi13tpro", "13tpro", "شیائومی ۱۳ تی پرو"],
  },

  {
    shortcode: "xia-12",
    label: "Xiaomi 12",
    keywords: ["xiaomi12", "mi12"],
  },
  {
    shortcode: "xia-12pro",
    label: "Xiaomi 12 Pro",
    keywords: ["xiaomi12pro", "mi12pro"],
  },
  {
    shortcode: "xia-12t",
    label: "Xiaomi 12T",
    keywords: ["xiaomi12t", "12t"],
  },
  {
    shortcode: "xia-12tpro",
    label: "Xiaomi 12T Pro",
    keywords: ["xiaomi12tpro", "12tpro"],
  },

  {
    shortcode: "xia-11",
    label: "Xiaomi 11",
    keywords: ["xiaomi11", "mi11"],
  },
  {
    shortcode: "xia-11lite",
    label: "Xiaomi 11 Lite",
    keywords: ["xiaomi11lite", "mi11lite"],
  },

  // ======================
  // REDMI (red-*)
  // ======================
  {
    shortcode: "red-note13",
    label: "Redmi Note 13",
    keywords: ["redminote13", "note13", "ردمی نوت ۱۳"],
  },
  {
    shortcode: "red-note13p",
    label: "Redmi Note 13 Pro",
    keywords: [
      "redminote13pro",
      "note13pro",
      "ردمی نوت ۱۳ پرو",
      "note13promax",
    ],
  },
  {
    shortcode: "red-note12",
    label: "Redmi Note 12",
    keywords: ["redminote12", "note12", "ردمی نوت ۱۲"],
  },
  {
    shortcode: "red-note12p",
    label: "Redmi Note 12 Pro",
    keywords: ["redminote12pro", "note12pro", "ردمی نوت ۱۲ پرو"],
  },
  {
    shortcode: "red-note11",
    label: "Redmi Note 11",
    keywords: ["redminote11", "note11", "ردمی نوت ۱۱"],
  },
  {
    shortcode: "red-note11p",
    label: "Redmi Note 11 Pro",
    keywords: ["redminote11pro", "note11pro", " ردمی نوت ۱۱ پرو"],
  },
  {
    shortcode: "red-note11s",
    label: "Redmi Note 11S",
    keywords: ["redminote11s", "note11s"],
  },
  {
    shortcode: "red-10c",
    label: "Redmi 10C",
    keywords: ["redmi10c", "10c"],
  },
  {
    shortcode: "red-10",
    label: "Redmi 10",
    keywords: ["redmi10"],
  },
  {
    shortcode: "red-9a",
    label: "Redmi 9A",
    keywords: ["redmi9a", "9a"],
  },
  {
    shortcode: "red-9c",
    label: "Redmi 9C",
    keywords: ["redmi9c", "9c"],
  },

  // ======================
  // POCO (poc-*)
  // ======================
  {
    shortcode: "poc-x6",
    label: "Poco X6",
    keywords: ["pocox6", "x6", "پوکـو x6"],
  },
  {
    shortcode: "poc-x6pro",
    label: "Poco X6 Pro",
    keywords: ["pocox6pro", "x6pro"],
  },
  {
    shortcode: "poc-x5",
    label: "Poco X5",
    keywords: ["pocox5", "x5"],
  },
  {
    shortcode: "poc-x5pro",
    label: "Poco X5 Pro",
    keywords: ["pocox5pro", "x5pro"],
  },
  {
    shortcode: "poc-f5",
    label: "Poco F5",
    keywords: ["pocof5", "f5"],
  },
  {
    shortcode: "poc-f5pro",
    label: "Poco F5 Pro",
    keywords: ["pocof5pro", "f5pro"],
  },
  {
    shortcode: "poc-m5",
    label: "Poco M5",
    keywords: ["pocom5", "m5"],
  },
  {
    shortcode: "poc-m4",
    label: "Poco M4",
    keywords: ["pocom4", "m4"],
  },
];

// -------------------------------
// Main suggestion function
// -------------------------------
export function suggestModelCodes(input, maxResults = 3) {
  if (!input) return [];
  const normInput = normalizeText(input);
  if (!normInput) return [];

  // If input already looks like a valid shortcode prefix
  const directMatches = MODEL_CATALOG.filter((m) =>
    m.shortcode.toLowerCase().startsWith(input.toLowerCase())
  );

  // Score by similarity on keywords + shortcode
  const scored = MODEL_CATALOG.map((m) => {
    let score = 0;

    // Strong boost if shortcode starts with raw input
    if (m.shortcode.toLowerCase().startsWith(input.toLowerCase())) {
      score += 2;
    }

    // Use normalized matching for keywords
    const kwMax = Math.max(
      similarity(normInput, m.shortcode),
      ...m.keywords.map((k) => similarity(normInput, k))
    );

    score += kwMax;

    return { model: m, score };
  });

  // Filter out very low scores
  const filtered = scored
    .filter((x) => x.score > 0.25)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.model.shortcode);

  const unique = Array.from(new Set(filtered));

  // If we have good guessed results, return them
  if (unique.length) {
    return unique.slice(0, maxResults);
  }

  // Fallback: if no fuzzy match, but direct prefix matches exist
  if (directMatches.length) {
    return directMatches.map((m) => m.shortcode).slice(0, maxResults);
  }

  // Nothing found
  return [];
}
