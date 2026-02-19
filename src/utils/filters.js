// Mapping user-friendly material names to canonical material list
const MATERIAL_ALIASES = {
  محکم: ["ضد ضربه", "هارد کیس"],
  "ضد ضربه": ["ضد ضربه", "هارد کیس"],
  چرمی: ["چرمی", "Leather"],
  دخترونه: ["فانتزی", "سیلیکونی"],
  مردونه: ["چرمی", "ضد ضربه", "هارد کیس"],
  ساده: ["شفاف", "سیلیکونی"],
  لاکچری: ["چرمی", "فانتزی", "Metal"],
  فانتزی: ["فانتزی"],
  "ژله ای": ["ژله ای", "سیلیکونی"],
};

// Predefined style mapping for quick filtering by style
const STYLE_MAP = {
  مردونه: {
    materials: ["چرمی", "ضد ضربه"],
    colors: ["مشکی", "طوسی", "قهوه‌ای"],
  },
  زنونه: {
    materials: ["فانتزی", "سیلیکونی"],
    colors: ["صورتی", "قرمز", "طلایی"],
  },
  دخترونه: {
    materials: ["فانتزی", "سیلیکونی"],
    colors: ["صورتی", "بنفش", "طلایی"],
  },
  پسرونه: {
    materials: ["ضد ضربه", "چرمی"],
    colors: ["مشکی", "سبز تیره", "سرمه‌ای"],
  },
  مینیمال: {
    materials: ["سیلیکونی", "شفاف"],
    colors: ["سفید", "طوسی", "مشکی"],
  },
  لاکچری: { materials: ["چرمی"], colors: ["طلایی", "نقره‌ای", "مشکی"] },
};

// Color grouping / aliasing for easier matching
const COLOR_ALIASES = {
  دخترونه: ["صورتی", "بنفش", "طلایی", "قرمز", "نقره‌ای روشن"],
  مردونه: ["مشکی", "سرمه‌ای", "طوسی", "سبز تیره", "قهوه‌ای"],
  خنثی: ["سفید", "شفاف", "نقره‌ای"],
  لاکچری: ["طلایی", "نقره‌ای", "رزگلد"],
};

// Brands we care about for filtering
const KNOWN_BRANDS = ["Nike", "Gucci", "Adidas", "Supreme", "Apple", "Samsung"];

// Flatten all unique material names from aliases
export const ALL_MATERIALS = [
  ...new Set(
    Object.keys(MATERIAL_ALIASES).concat(...Object.values(MATERIAL_ALIASES)),
  ),
];

// Flatten all unique colors from aliases
export const ALL_COLORS = [
  ...new Set(
    Object.keys(COLOR_ALIASES).concat(...Object.values(COLOR_ALIASES)),
  ),
];

/**
 * Expand parsed filters based on user input and state.
 * Merges material/color aliases, styles, brands, and price hints.
 */
export function expandFilters(parsed, userText = "", dState = {}) {
  const materials = [];
  const colors = [];
  let brand = parsed.brand || "-";
  let priceRange = null;

  // Use last selected model if none provided
  if ((!parsed.model || parsed.model === "-") && dState.lastModel) {
    parsed.model = dState.lastModel;
  }

  // Infer material/color from gender keywords if not explicitly provided
  if (/زنونه|دخترونه/.test(userText)) {
    if (!parsed.material || parsed.material === "-")
      parsed.material = "دخترونه";
    if (!parsed.color || parsed.color === "-") parsed.color = "دخترونه";
  }
  if (/مردونه|پسرونه/.test(userText)) {
    if (!parsed.material || parsed.material === "-") parsed.material = "مردونه";
    if (!parsed.color || parsed.color === "-") parsed.color = "مردونه";
  }

  // Expand material aliases
  if (parsed.material && parsed.material !== "-") {
    if (MATERIAL_ALIASES[parsed.material]) {
      materials.push(...MATERIAL_ALIASES[parsed.material]);
    } else {
      materials.push(parsed.material);
    }
  }

  // Catch all materials mentioned in user text
  for (const key of Object.keys(MATERIAL_ALIASES)) {
    if (userText.includes(key)) {
      materials.push(...MATERIAL_ALIASES[key]);
    }
  }

  // Map styles to materials and colors
  for (const [key, map] of Object.entries(STYLE_MAP)) {
    if (userText.includes(key)) {
      if (map.materials) materials.push(...map.materials);
      if (map.colors) colors.push(...map.colors);
    }
  }

  // Expand color aliases
  if (parsed.color && parsed.color !== "-") {
    if (COLOR_ALIASES[parsed.color]) {
      colors.push(...COLOR_ALIASES[parsed.color]);
    } else {
      colors.push(parsed.color);
    }
  }

  // Catch all colors mentioned in user text
  for (const key of Object.keys(COLOR_ALIASES)) {
    if (userText.includes(key)) {
      colors.push(...COLOR_ALIASES[key]);
    }
  }

  // Detect brand if not already set
  if (!brand || brand === "-") {
    for (const b of KNOWN_BRANDS) {
      if (userText.toLowerCase().includes(b.toLowerCase())) {
        brand = b;
        break;
      }
    }
  }

  // Extract price numbers from user text
  const priceNums = userText.match(/\d+/g)?.map((n) => parseInt(n, 10)) || [];

  // Infer price range based on text hints
  if (/زیر\s*\d+/.test(userText)) {
    priceRange = { max: priceNums[0] };
  } else if (/بالای\s*\d+/.test(userText)) {
    priceRange = { min: priceNums[0] };
  } else if (/بین\s*\d+.*\d+/.test(userText) && priceNums.length >= 2) {
    priceRange = { min: Math.min(...priceNums), max: Math.max(...priceNums) };
  } else if (/حدود\s*\d+/.test(userText)) {
    const p = priceNums[0];
    priceRange = { min: p - 50_000, max: p + 50_000 };
  }

  return {
    model: parsed.model || "-",
    materials,
    colors,
    brand,
    priceRange,
  };
}
