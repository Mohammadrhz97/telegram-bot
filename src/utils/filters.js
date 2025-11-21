/**
 * هوشمندسازی فیلتر جستجوی محصول بر اساس متن کاربر
 * - تشخیص جنس قاب (material)
 * - رنگ (color)
 * - استایل (style)
 * - برند (brand)
 * - محدوده قیمت (price)
 */

// ========== هوشمند سازی فیلترها برای نیاز مشتری ==========

// مترادف‌ها برای جنس
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
// استایل‌ها که ترکیب رنگ + جنس هستن
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

// مترادف‌ها برای رنگ
const COLOR_ALIASES = {
  دخترونه: ["صورتی", "بنفش", "طلایی", "قرمز", "نقره‌ای روشن"],
  مردونه: ["مشکی", "سرمه‌ای", "طوسی", "سبز تیره", "قهوه‌ای"],
  خنثی: ["سفید", "شفاف", "نقره‌ای"],
  لاکچری: ["طلایی", "نقره‌ای", "رزگلد"],
};

// برندها → برای سرچ مستقیم
const KNOWN_BRANDS = ["Nike", "Gucci", "Adidas", "Supreme", "Apple", "Samsung"];

/**

 * ورودی: متن کاربر + JSON اولیه AI
 * خروجی: فیلترهای توسعه یافته برای دیتابیس
 */
// از تمام مقادیر داخل MATERIAL_ALIASES و COLOR_ALIASES یه لیست کامل بسازیم
export const ALL_MATERIALS = [
  ...new Set(
    Object.keys(MATERIAL_ALIASES).concat(...Object.values(MATERIAL_ALIASES))
  ),
];

export const ALL_COLORS = [
  ...new Set(
    Object.keys(COLOR_ALIASES).concat(...Object.values(COLOR_ALIASES))
  ),
];

export function expandFilters(parsed, userText = "", dState = {}) {
  const materials = [];
  const colors = [];
  let brand = parsed.brand || "-";
  let priceRange = null;

  // 👇 اگر مدل توی parsed خالیه ولی قبلاً ذخیره شده، از dState بخون
  if ((!parsed.model || parsed.model === "-") && dState.lastModel) {
    parsed.model = dState.lastModel;
  }

  // ===== پشتیبانی از زنونه / مردونه / دخترونه / پسرونه =====
  if (/زنونه|دخترونه/.test(userText)) {
    if (!parsed.material || parsed.material === "-")
      parsed.material = "دخترونه";
    if (!parsed.color || parsed.color === "-") parsed.color = "دخترونه";
  }
  if (/مردونه|پسرونه/.test(userText)) {
    if (!parsed.material || parsed.material === "-") parsed.material = "مردونه";
    if (!parsed.color || parsed.color === "-") parsed.color = "مردونه";
  }

  // ===== جنس
  if (parsed.material && parsed.material !== "-") {
    if (MATERIAL_ALIASES[parsed.material]) {
      materials.push(...MATERIAL_ALIASES[parsed.material]);
    } else {
      materials.push(parsed.material);
    }
  }

  // 🔹 بررسی مستقیم متن کاربر برای جنس
  for (const key of Object.keys(MATERIAL_ALIASES)) {
    if (userText.includes(key)) {
      materials.push(...MATERIAL_ALIASES[key]);
    }
  }
  // استایل
  for (const [key, map] of Object.entries(STYLE_MAP)) {
    if (userText.includes(key)) {
      if (map.materials) materials.push(...map.materials);
      if (map.colors) colors.push(...map.colors);
    }
  }

  // ===== رنگ
  if (parsed.color && parsed.color !== "-") {
    if (COLOR_ALIASES[parsed.color]) {
      colors.push(...COLOR_ALIASES[parsed.color]);
    } else {
      colors.push(parsed.color);
    }
  }

  // 🔹 بررسی مستقیم متن کاربر برای رنگ
  for (const key of Object.keys(COLOR_ALIASES)) {
    if (userText.includes(key)) {
      colors.push(...COLOR_ALIASES[key]);
    }
  }

  // ===== برند
  if (!brand || brand === "-") {
    for (const b of KNOWN_BRANDS) {
      if (userText.toLowerCase().includes(b.toLowerCase())) {
        brand = b;
        break;
      }
    }
  }

  // ===== بازه قیمتی
  const priceNums = userText.match(/\d+/g)?.map((n) => parseInt(n, 10)) || [];

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
