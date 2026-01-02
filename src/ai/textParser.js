// src/ai/textParser.js
import "dotenv/config";

const MATERIALS = ["ضد ضربه", "شفاف", "سیلیکونی", "فانتزی", "چرمی", "مات"];
const COLORS = [
  "مشکی",
  "سفید",
  "قرمز",
  "آبی",
  "زرد",
  "سبز",
  "بنفش",
  "صورتی",
  "سرمه‌ای",
];

function safeDefault() {
  return {
    action: "noop",
    payload: {
      model: "-",
      modelFull: "-",
      material: "-",
      color: "-",
      brand: "-",
    },
    say: "",
  };
}

function buildPrompt(userText, history = []) {
  const system = `
You are an AI JSON API for a Telegram phone-case shop bot.
User writes in Persian / Finglish.

Your job:
- Understand what phone model and what type of case the user wants.
- Extract clean filters in JSON ONLY (no extra text).

Return JSON:
{
  "action": "set_model" | "search_products" | "noop",
  "payload": {
    "model": "-",      // short model text like "13pm", "s24u", "note11", "a54" or a short phrase like "iphone 13 pro max"
    "modelFull": "-",  // optional, more human-readable model name
    "material": "-",   // one of: [ضد ضربه, شفاف, سیلیکونی, فانتزی, چرمی, مات] or "-"
    "color": "-",      // one of: [مشکی, سفید, قرمز, آبی, زرد, سبز, بنفش, صورتی, سرمه‌ای] or "-"
    "brand": "-"       // brand of CASE (not phone): like "Nike", "Baseus", etc. usually "-" unless clearly a case brand
  },
  "say": "یک جمله دوستانه کوتاه برای کاربر"
}

Normalization rules (very important):
- Do NOT repeat user text. Map to the fixed MATERIALS and COLORS lists.
- Examples for MATERIAL:
  - "ژله ای", "نرم", "سیلیکون", "soft" → "سیلیکونی"
  - "ضد شوک", "هارد کیس", "محکم", "مردونه خشن" → "ضد ضربه"
  - "ساده شفاف", "کریستالی", "شفاف ژله ای" → "شفاف"
  - "طرح دار", "گل گلی", "رنگی رنگی", "کارتونی", "دخترونه خفن" → "فانتزی"
  - "چرم", "چرمی", "کیف چرمی", "محافظ کلاسیک" → "چرمی"
  - "مات", "simple", "smoked" → "مات"
- Examples for COLOR:
  - "dark", "manly", "مردونه", "تیره" → "مشکی"
  - "girl", "دخترونه", "صورتی کم رنگ" → "صورتی"
  - "آبی نفتی", "سرمه ای" → "سرمه‌ای"
  - If unsure → "-"

Action rules:
- If user mainly gives phone model (e.g. "آیفون ۱۳ پرومکس", "s24 ultra", "redmi note 11"):
  → action = "set_model"
- If user asks for a style while model is already known from previous messages:
  → action = "search_products"
- If user gives both model + style in one sentence:
  → action = "search_products"
- If nothing useful detected:
  → action = "noop"

Always answer in Persian for the "say" field (friendly, short).
  `;

  return [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: String(userText || "").slice(0, 1000) },
  ];
}

async function callOpenRouter(messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";

  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  const data = await r.json().catch(() => ({}));
  return data?.choices?.[0]?.message?.content || "";
}

function extractJson(s) {
  if (!s) return null;
  const m = String(s).match(/\{[\s\S]*\}/);
  if (!m) return null;

  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export async function parseText(userText, history = []) {
  try {
    const content = await callOpenRouter(buildPrompt(userText, history));

    console.log("🟦 RAW AI RESPONSE:", content);

    const obj = extractJson(content);

    console.log("🟩 PARSED JSON OBJECT:", obj);

    if (!obj) return safeDefault();

    const payload = obj.payload || {};

    const result = {
      action: obj.action || "noop",
      payload: {
        model: payload.model || "-",
        modelFull: payload.modelFull || "-",
        material: MATERIALS.includes(payload.material) ? payload.material : "-",
        color: COLORS.includes(payload.color) ? payload.color : "-",
        brand: payload.brand || "-",
      },
      say: typeof obj.say === "string" ? obj.say : "",
    };

    console.log("🟨 FINAL PAYLOAD:", result.payload);

    return result;
  } catch (err) {
    console.error("❌ parseText ERROR:", err);
    return safeDefault();
  }
}
