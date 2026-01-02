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
    `📱 مدل: ${p.modelFull}\n` +
    `🏷 برند: ${p.brand || "-"}\n` +
    `🧱 جنس: ${p.material || "-"}\n` +
    `🎨 رنگ: ${p.color || "-"}\n` +
    `💰 قیمت: ${p.price.toLocaleString()} تومان`
  );
}

// -----------------------------------------
// Helper: build standardized short code
// app-13pm / sam-s24u / sam-a54 / ...
// -----------------------------------------
function buildStandardModelShort(modelRaw, text) {
  const raw = (modelRaw || "").toLowerCase();

  // اگر خودش قبلاً استاندارد بوده، همونو برگردون
  if (raw.startsWith("app-") || raw.startsWith("sam-")) {
    return raw;
  }

  const apple = normalizeAppleModel(modelRaw, text);
  const samsung = normalizeSamsungModel(modelRaw, text);

  // اگر هر دو match شدن، براساس وجود کلمه‌ی آیفون/سامسونگ تصمیم بگیر
  const fullText = (String(modelRaw) + " " + String(text)).toLowerCase();
  let best = null;
  let prefix = null;

  if (apple && !samsung) {
    best = apple;
    prefix = "app";
  } else if (!apple && samsung) {
    best = samsung;
    prefix = "sam";
  } else if (apple && samsung) {
    if (fullText.includes("iphone") || fullText.includes("ایفون")) {
      best = apple;
      prefix = "app";
    } else if (fullText.includes("سامسونگ") || fullText.includes("samsung")) {
      best = samsung;
      prefix = "sam";
    } else {
      // پیش‌فرض: اپل
      best = apple;
      prefix = "app";
    }
  }

  if (best && prefix) {
    return `${prefix}-${String(best.shortcode || "").toLowerCase()}`;
  }

  // اگر نشد تشخیص بدیم ولی خود modelRaw یه چیز فشرده بود، می‌تونیم از همون استفاده کنیم
  if (raw && raw !== "-") {
    return raw;
  }

  return "";
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
      "سلام عزیزم! 👋\n" +
        "این ربات با هوش مصنوعی کمکت می‌کنه سریع‌ترین قاب مناسب گوشیت رو پیدا کنی.\n\n" +
        "✅ فقط کافیه مدل گوشی‌ت رو بگی و سلیقه‌ات رو توصیف کنی، مثلاً:\n" +
        "• «قاب محکم مردونه برای آیفون ۱۳ پرومکس مشکی»\n" +
        "• «یه قاب دخترونه گل‌گلی برای سامسونگ A54»\n\n" +
        "می‌تونی حتی عکس یه قاب رو بفرستی تا مشابهش رو برات پیدا کنم 🔍📸"
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

    // Friendly AI message (کوتاه)
    if (ai.say) {
      try {
        await ctx.reply(ai.say);
      } catch {}
    }

    // Extract AI filters
    let modelRaw = ai.payload.model || "-";
    let modelFull = ai.payload.modelFull || "-";
    const material = ai.payload.material !== "-" ? ai.payload.material : null;
    const color = ai.payload.color !== "-" ? ai.payload.color : null;
    const brand = ai.payload.brand !== "-" ? ai.payload.brand : null;

    // -----------------------------------
    // Case: set_model  → فقط مدل کاربر رو ذخیره کن
    // -----------------------------------
    if (ai.action === "set_model") {
      const modelShort = buildStandardModelShort(modelRaw, text);

      if (!modelShort) {
        await ctx.reply(
          "📱 نتونستم مدل گوشیت رو دقیق بفهمم، یک بار دیگه واضح‌تر بگو."
        );
        return;
      }

      setTemp(userId, {
        lastModel: modelShort,
        lastModelFull: modelFull,
      });

      await ctx.reply(`✅ مدل گوشیت ثبت شد: ${modelFull || modelShort}`);
      return;
    }

    // -----------------------------------
    // Case: search_products
    // -----------------------------------
    if (ai.action === "search_products") {
      // مرحله ۱: مدل را مشخص کن (الزامی)
      let modelShort = "";
      if (modelRaw && modelRaw !== "-") {
        modelShort = buildStandardModelShort(modelRaw, text);
      } else if (tmp.lastModel) {
        modelShort = tmp.lastModel.toLowerCase();
      }

      if (!modelShort) {
        await ctx.reply("📱 اول مدل گوشی‌ت رو بگو، بعد می‌گردم بین قاب‌ها.");
        return;
      }

      // ذخیره‌ی مدل برای پیام‌های بعدی
      setTemp(userId, {
        lastModel: modelShort,
        lastModelFull: modelFull || tmp.lastModelFull,
      });

      // فیلترهای Prisma
      const where = {
        model: { contains: modelShort, mode: "insensitive" },
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
          await ctx.reply(
            "❌ محصولی با این مشخصات پیدا نشد. می‌تونی جنس یا رنگ دیگه‌ای رو هم امتحان کنی."
          );
          return;
        }

        await ctx.reply(
          "✅ این چندتا قاب نزدیک‌ترین گزینه‌ها به سلیقه‌ی تو هستن:"
        );

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
            await ctx.replyWithPhoto(photo, { caption, reply_markup });
          } catch {
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
