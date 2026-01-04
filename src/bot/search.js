// =====================================================
// src/bot/search.js
// AI-powered text search for phone cases
// Flow: User text/image → AI parse → Prisma query → Telegram response
// =====================================================

import { prisma } from "../db.js";
import { parseText } from "../ai/textParser.js";
import { normalizeAppleModel, normalizeSamsungModel } from "../ai/normalize.js";
import { getState, setState, getTemp, setTemp } from "../state/state.js";

// =====================================================
// Helper: Resolve image input
// - Accepts Telegram file_id OR public image URL
// - Rejects Telegram CDN URLs (cannot be resent)
// =====================================================
function resolveInputPhoto(imageUrl) {
  if (!imageUrl) return null;

  // Looks like Telegram file_id
  const looksLikeFileId =
    /^[A-Za-z0-9_-]{20,}$/.test(imageUrl) && !imageUrl.startsWith("http");

  if (looksLikeFileId) return imageUrl;

  // Validate image extension
  const lower = imageUrl.toLowerCase();
  const isImg =
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");

  // Accept public HTTP image URLs only
  if (imageUrl.startsWith("http") && isImg) {
    try {
      const u = new URL(imageUrl);
      const host = u.hostname.toLowerCase();

      // Telegram CDN images cannot be reused
      if (host.includes("api.telegram.org") || host.includes("t.me"))
        return null;
    } catch {}

    return { url: imageUrl };
  }

  return null;
}

// =====================================================
// Helper: Build product caption for Telegram message
// =====================================================
function buildCaption(p) {
  return (
    `📱 مدل: ${p.modelFull}\n` +
    `🏷 برند: ${p.brand || "-"}\n` +
    `🧱 جنس: ${p.material || "-"}\n` +
    `🎨 رنگ: ${p.color || "-"}\n` +
    `💰 قیمت: ${p.price.toLocaleString()} تومان`
  );
}

// =====================================================
// Helper: Build standardized short model code
// Examples:
// - app-13pm
// - sam-a54
// Used for database matching
// =====================================================
function buildStandardModelShort(modelRaw, text) {
  const raw = (modelRaw || "").toLowerCase();

  // Already normalized
  if (raw.startsWith("app-") || raw.startsWith("sam-")) {
    return raw;
  }

  const apple = normalizeAppleModel(modelRaw, text);
  const samsung = normalizeSamsungModel(modelRaw, text);

  const fullText = (String(modelRaw) + " " + String(text)).toLowerCase();
  let best = null;
  let prefix = null;

  // Only Apple detected
  if (apple && !samsung) {
    best = apple;
    prefix = "app";
  }

  // Only Samsung detected
  else if (!apple && samsung) {
    best = samsung;
    prefix = "sam";
  }

  // Both detected → disambiguate using text context
  else if (apple && samsung) {
    if (fullText.includes("iphone") || fullText.includes("ایفون")) {
      best = apple;
      prefix = "app";
    } else if (fullText.includes("سامسونگ") || fullText.includes("samsung")) {
      best = samsung;
      prefix = "sam";
    } else {
      // Default preference
      best = apple;
      prefix = "app";
    }
  }

  if (best && prefix) {
    return `${prefix}-${String(best.shortcode || "").toLowerCase()}`;
  }

  // Fallback to raw value if exists
  if (raw && raw !== "-") {
    return raw;
  }

  return "";
}

// =====================================================
// Main: Register search-related bot handlers
// =====================================================
export function registerSearchHandlers(bot) {
  // ---------------------------------------------------
  // /start → initialize search flow
  // ---------------------------------------------------
  bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();

    // Set conversation state
    setState(userId, "search", "await_query");

    await ctx.reply(
      "سلام عزیزم! 👋\n" +
        "این ربات با هوش مصنوعی کمکت می‌کنه سریع‌ترین قاب مناسب گوشیت رو پیدا کنی.\n\n" +
        "✅ فقط کافیه مدل گوشی‌ت رو بگی و سلیقه‌ات رو توصیف کنی، مثلاً:\n" +
        "• «قاب محکم مردونه برای آیفون ۱۳ پرومکس مشکی»\n" +
        "• «یه قاب دخترونه گل‌گلی برای سامسونگ A54»\n\n" +
        "می‌تونی حتی عکس یه قاب رو بفرستی تا مشابهش رو برات پیدا کنم 🔍📸"
    );
  });

  // ---------------------------------------------------
  // TEXT handler (AI-driven)
  // ---------------------------------------------------
  bot.on("text", async (ctx, next) => {
    const userId = ctx.from.id.toString();
    const state = getState(userId);

    // Ignore messages outside search flow
    if (!state || state.flow !== "search") return next();

    const text = (ctx.message?.text || "").trim();

    // Ignore commands
    if (text.startsWith("/")) return next();

    const tmp = getTemp(userId) || {};

    // Parse user message using AI
    const ai = await parseText(text);

    // Optional friendly AI response
    if (ai.say) {
      try {
        await ctx.reply(ai.say);
      } catch {}
    }

    // Extract structured AI payload
    let modelRaw = ai.payload.model || "-";
    let modelFull = ai.payload.modelFull || "-";
    const material = ai.payload.material !== "-" ? ai.payload.material : null;
    const color = ai.payload.color !== "-" ? ai.payload.color : null;
    const brand = ai.payload.brand !== "-" ? ai.payload.brand : null;

    // -------------------------------------------------
    // Action: set_model
    // User only specifies phone model
    // -------------------------------------------------
    if (ai.action === "set_model") {
      const modelShort = buildStandardModelShort(modelRaw, text);

      if (!modelShort) {
        await ctx.reply(
          "📱 نتونستم مدل گوشیت رو دقیق بفهمم، یک بار دیگه واضح‌تر بگو."
        );
        return;
      }

      // Persist model for future messages
      setTemp(userId, {
        lastModel: modelShort,
        lastModelFull: modelFull,
        waitingForPreference: true,
      });

      await ctx.reply(
        `✅ مدل گوشیت ثبت شد: ${modelFull || modelShort}\n\n` +
          "حالا بگو 👇\n" +
          "🎨 چه رنگی دوست داری؟\n" +
          "🧱 چه جنسی؟ (مثلاً سیلیکونی، چرمی، ضدضربه)\n" +
          "✨ یا چه سبکی؟ (اسپرت، دخترونه، ساده، لاکچری)"
      );
      return;
    }

    // -------------------------------------------------
    // Action: search_products
    // -------------------------------------------------
    if (ai.action === "search_products") {
      let modelShort = "";

      // Prefer current message model
      if (modelRaw && modelRaw !== "-") {
        modelShort = buildStandardModelShort(modelRaw, text);
      }

      // Fallback to previous model
      else if (tmp.lastModel) {
        modelShort = tmp.lastModel.toLowerCase();
      }

      if (!modelShort) {
        await ctx.reply("📱 اول مدل گوشی‌ت رو بگو، بعد می‌گردم بین قاب‌ها.");
        return;
      }

      // Save model context
      setTemp(userId, {
        lastModel: modelShort,
        lastModelFull: modelFull || tmp.lastModelFull,
      });

      // Build Prisma filters
      const where = {
        model: { contains: modelShort, mode: "insensitive" },
      };

      if (material)
        where.material = { contains: material, mode: "insensitive" };
      if (color) where.color = { contains: color, mode: "insensitive" };
      if (brand) where.brand = { contains: brand, mode: "insensitive" };

      try {
        // Query products
        const products = await prisma.product.findMany({
          where,
          take: 5,
          orderBy: { createdAt: "desc" },
        });

        if (!products.length) {
          await ctx.reply(
            "❌ محصولی با این مشخصات پیدا نشد. می‌تونی جنس یا رنگ دیگه‌ای رو هم امتحان کنی."
          );
          return;
        }

        await ctx.reply(
          "✅ این چندتا قاب نزدیک‌ترین گزینه‌ها به سلیقه‌ی تو هستن:"
        );

        // Send products
        for (const p of products) {
          const caption = buildCaption(p);
          const photo = resolveInputPhoto(p.imageUrl || p.telegramFileId);

          const reply_markup = {
            inline_keyboard: [
              [
                {
                  text: "➕ افزودن به سبد",
                  callback_data: `addcart_${p.id}`,
                },
              ],
            ],
          };

          try {
            if (!photo) throw "invalid_photo";
            await ctx.replyWithPhoto(photo, {
              caption,
              reply_markup,
            });
          } catch {
            // Fallback: text-only message
            await ctx.reply(caption, { reply_markup });
          }
        }
      } catch (err) {
        console.log("SEARCH_ERR:", err);
        await ctx.reply(
          "❌ در جستجو خطایی رخ داد، چند لحظه بعد دوباره امتحان کن."
        );
      }

      return;
    }

    return next();
  });
}
