// src/bot/search.js
// AI text search engine → Prisma query → send results

import { prisma } from "../db.js";
import { parseText } from "../ai/textParser.js";
import { normalizeAppleModel, normalizeSamsungModel } from "../ai/normalize.js";
import { getState, setState, getTemp, setTemp } from "../state/state.js";

// -----------------------------------------
// Validate images / convert HTTP → Telegram photo
// -----------------------------------------
function resolveInputPhoto(imageUrl) {
  if (!imageUrl) return null;

  const looksLikeFileId =
    /^[A-Za-z0-9_-]{20,}$/.test(imageUrl) && !imageUrl.startsWith("http");
  if (looksLikeFileId) return imageUrl;

  const lower = imageUrl.toLowerCase();
  const isImg =
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");

  if (imageUrl.startsWith("http") && isImg) {
    try {
      const u = new URL(imageUrl);
      const host = u.hostname.toLowerCase();
      if (host.includes("api.telegram.org") || host.includes("t.me"))
        return null;
    } catch {}
    return { url: imageUrl };
  }

  return null;
}

// -----------------------------------------
// Build product caption
// -----------------------------------------
function buildCaption(p) {
  return (
    `📱 مدل: ${p.model}\n` +
    `🏷 برند: ${p.brand || "-"}\n` +
    `🧱 جنس: ${p.material || "-"}\n` +
    `🎨 رنگ: ${p.color || "-"}\n` +
    `💰 قیمت: ${p.price.toLocaleString()} تومان`
  );
}

// =====================================================
// registerSearchHandlers()
// =====================================================
export function registerSearchHandlers(bot) {
  // /start
  bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    setState(userId, "search", "await_query");

    await ctx.reply(
      "سلام رفیق! 👋\n" +
        "هرچی دنبالشی فقط بهم بگو — چه با متن چه با عکس! 🔍📸\n\n" +
        "مثلاً می‌تونی بگی:\n" +
        "• قاب آیفون ۱۳ مشکی سیلیکونی\n" +
        "• قاب سامسونگ S24 اولترا\n" +
        "• یه قاب فانتزی صورتی برای آیفون ۱۲\n\n" +
        "یا حتی یه عکس بفرست تا مشابهش رو برات پیدا کنم 🙂🤝"
    );
  });

  // TEXT handler
  bot.on("text", async (ctx, next) => {
    const userId = ctx.from.id.toString();
    const state = getState(userId);

    if (!state || state.flow !== "search") return next();

    const text = (ctx.message?.text || "").trim();
    if (text.startsWith("/")) return next();

    const tmp = getTemp(userId) || {};
    const ai = await parseText(text);

    // Friendly AI message
    if (ai.say) {
      try {
        await ctx.reply(ai.say);
      } catch {}
    }

    // Extract AI filters
    let modelCode = ai.payload.model || "-";
    let modelFull = ai.payload.modelFull || "-";
    const material = ai.payload.material !== "-" ? ai.payload.material : null;
    const color = ai.payload.color !== "-" ? ai.payload.color : null;
    const brand = ai.payload.brand !== "-" ? ai.payload.brand : null;

    // -----------------------------------
    // Case: set_model
    // -----------------------------------
    if (ai.action === "set_model") {
      const apple = normalizeAppleModel(modelCode, text);
      const samsung = normalizeSamsungModel(modelCode, text);
      const best = apple || samsung;

      if (best) {
        modelCode = (best.shortcode || modelCode).toLowerCase();
        modelFull = best.fullname || modelFull;
      }

      setTemp(userId, { lastModel: modelCode, lastModelFull: modelFull });
      return;
    }

    // -----------------------------------
    // Case: search_products
    // -----------------------------------
    if (ai.action === "search_products") {
      let model =
        modelCode !== "-" ? modelCode : tmp.lastModel?.toLowerCase() || "";

      // If user mentioned new model → normalize
      if (modelCode !== "-") {
        const apple = normalizeAppleModel(modelCode, text);
        const samsung = normalizeSamsungModel(modelCode, text);
        const best = apple || samsung;

        if (best) {
          model = String(best.shortcode).toLowerCase();
          modelFull = best.fullname;
        }
      }

      // User still never told model
      if (!model) {
        await ctx.reply("📱 لطفاً مدل گوشی‌ت رو هم بگو تا جستجو کنم.");
        return;
      }

      // Save fallback model
      setTemp(userId, {
        lastModel: model,
        lastModelFull: modelFull || tmp.lastModelFull,
      });

      // -----------------------------------
      // Smart flexible filtering
      // (model = contains, not exact)
      // -----------------------------------

      const where = {
        model: { contains: model, mode: "insensitive" }, // ← مهم‌ترین فیکس
      };

      if (material)
        where.material = { contains: material, mode: "insensitive" };

      if (color) where.color = { contains: color, mode: "insensitive" };

      if (brand) where.brand = { contains: brand, mode: "insensitive" };

      try {
        const products = await prisma.product.findMany({
          where,
          take: 5,
          orderBy: { createdAt: "desc" },
        });

        if (!products.length) {
          await ctx.reply("❌ محصولی با این مشخصات پیدا نشد.");
          return;
        }

        // send cards
        for (const p of products) {
          const caption = buildCaption(p);
          const photo = resolveInputPhoto(p.imageUrl);

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
            await ctx.replyWithPhoto(photo, { caption, reply_markup });
          } catch {
            await ctx.reply(caption, { reply_markup });
          }
        }
      } catch (err) {
        console.log("SEARCH_ERR:", err);
      }

      return;
    }

    return next();
  });
}
