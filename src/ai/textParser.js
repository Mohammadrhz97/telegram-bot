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
  "सरمه‌ای",
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
User writes in Persian/Finglish.
Extract structured filters ONLY.

Return JSON:
{
  "action": "set_model" | "search_products" | "noop",
  "payload": {
    "model": "-",
    "modelFull": "-",
    "material": "-",
    "color": "-",
    "brand": "-"
  },
  "say": "الان برات می‌گردم…"
}

Rules:
- No repetition.
- Respond in Persian.
- Normalize ("siliconi"→"سیلیکونی").
- If unknown → "-".
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
    const obj = extractJson(content);

    if (!obj) return safeDefault();

    const payload = obj.payload || {};

    return {
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
  } catch {
    return safeDefault();
  }
}
