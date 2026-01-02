// src/bot/photoSearch.js
// Global Image Search — NO phone model needed

import { prisma } from "../db.js";
import { getImageEmbeddingFromTelegram } from "../ai/localEmbedding.js";
import { userCheckoutState } from "./state.js";

// --------------------------------------
// 🔹 Cosine similarity (safe)
// --------------------------------------
function cosineSim(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return -1;
  if (a.length !== b.length) return -1;

  let dot = 0,
    na = 0,
    nb = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }

  if (na === 0 || nb === 0) return -1;

  return dot / Math.sqrt(na * nb);
}

// --------------------------------------
// 🔹 Build product caption
// --------------------------------------
function buildCaption(p, score) {
  return (
    `📱 مدل: ${p.model}\n` +
    `🏷 برند: ${p.brand || "-"}\n` +
    `🧱 جنس: ${p.material || "-"}\n` +
    `🎨 رنگ: ${p.color || "-"}\n` +
    `💰 قیمت: ${p.price.toLocaleString()} تومان` +
    `\n🔍 شباهت: ${(score * 100).toFixed(1)}٪`
  );
}

// --------------------------------------
// 🔹 Normalize photo input
// --------------------------------------
function resolveInputPhoto(imageUrl) {
  if (!imageUrl) return null;
  if (!imageUrl.startsWith("http")) return imageUrl; // Telegram file_id
  return { url: imageUrl };
}

// --------------------------------------
// 🔥 Main handler — GLOBAL IMAGE SEARCH
// --------------------------------------
export function registerPhotoSearchHandlers(bot) {
  bot.on("photo", async (ctx, next) => {
    try {
      // 1) Get the highest quality photo
      const telegramId = ctx.from.id.toString();
      const photos = ctx.message.photo || [];
      if (!photos.length) throw new Error("no-photo");
      if (ctx.session && typeof ctx.session === "object" && ctx.session.mode) {
        return next();
      }

      if (userCheckoutState.has(telegramId)) {
        return next();
      }

      const fileId = photos[photos.length - 1].file_id;

      // 2) Build embedding
      const emb = await getImageEmbeddingFromTelegram(fileId, ctx);

      if (!emb || emb.length !== 768) {
        await ctx.reply("❌ نتونستم از این عکس ایمبدینگ بسازم.");
        return;
      }

      // 3) Fetch ALL products that have embeddings
      const products = await prisma.product.findMany({
        where: {
          NOT: [{ embedding: { equals: [] } }],
        },
        take: 500, // search among last 500
        orderBy: { createdAt: "desc" },
      });

      if (!products.length) {
        await ctx.reply("❌ هیچ محصولی با ایمبدینگ در دیتابیس وجود ندارد.");
        return;
      }

      // 4) Keep only same dimensional embeddings
      const validProducts = products.filter(
        (p) => Array.isArray(p.embedding) && p.embedding.length === 768
      );

      if (!validProducts.length) {
        await ctx.reply("❌ هیچ محصول معتبری برای مقایسه پیدا نشد.");
        return;
      }

      // 5) Compute similarity and rank
      const ranked = validProducts
        .map((p) => ({
          p,
          score: cosineSim(emb, p.embedding),
        }))
        .filter((x) => x.score >= 0.5)
        .slice(0, 10);

      if (!ranked.length) {
        await ctx.reply("❌ هیچ قاب مشابهی پیدا نکردم.");
        return;
      }

      await ctx.reply("🔎 بهترین نتایج پیدا شده:");

      // 6) Send results
      for (const item of ranked) {
        const p = item.p;
        const caption = buildCaption(p, item.score);

        const photoInput = resolveInputPhoto(p.imageUrl || p.telegramFileId);

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
          await ctx.replyWithPhoto(photoInput, { caption, reply_markup });
        } catch {
          await ctx.reply(caption, { reply_markup });
        }
      }
      next();
    } catch (err) {
      console.log("PHOTO_SEARCH_ERR:", err);
      await ctx.reply("❌ خطا در جستجوی تصویری. دوباره امتحان کن.");
    }
  });
}
