// src/bot/products.js
// Clean product listing with safe image handling and add-to-cart button

import { prisma } from "../db.js";

function resolveInputPhoto(imageUrl) {
  if (!imageUrl) return null;
  // If we stored Telegram file_id in imageUrl, use it directly
  const looksLikeFileId = /^[A-Za-z0-9_-]{20,}$/.test(imageUrl) && !imageUrl.startsWith("http");
  if (looksLikeFileId) return imageUrl;

  // Accept only direct image URLs (jpg/jpeg/png). Avoid svg/HTML pages to prevent Telegram 400.
  const lower = imageUrl.toLowerCase();
  const isDirectImage = lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
  if (imageUrl.startsWith("http") && isDirectImage) {
    try {
      const u = new URL(imageUrl);
      const host = u.hostname.toLowerCase();
      if (host.includes("api.telegram.org") || host.includes("t.me")) return null;
    } catch {}
    return { url: imageUrl };
  }
  return null;
}

export function registerProductsHandlers(bot) {
  bot.command("products", async (ctx) => {
    try {
      const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });

      if (!products.length) {
        return ctx.reply("فعلاً کالایی موجود نیست.");
      }

      for (const p of products) {
        const caption =
          `📱 مدل: ${p.model}\n` +
          `🏷 برند: ${p.brand || "-"}\n` +
          `🧱 جنس: ${p.material || "-"}\n` +
          `🎨 رنگ: ${p.color || "-"}\n` +
          `💰 قیمت: ${p.price.toLocaleString()} تومان`;

        const inputPhoto = resolveInputPhoto(p.imageUrl);

        const reply_markup = {
          inline_keyboard: [
            [
              { text: "➕ افزودن به سبد", callback_data: `addcart_${p.id}` },
            ],
          ],
        };

        try {
          if (!inputPhoto) throw new Error("no-photo");
          await ctx.replyWithPhoto(inputPhoto, { caption, reply_markup });
        } catch (e) {
          console.error("Photo sending failed, sending text only:", e);
          await ctx.reply(caption, { reply_markup });
        }
      }
    } catch (err) {
      console.error("Error in /products:", err);
      await ctx.reply("خطایی رخ داد در نمایش محصولات.");
    }
  });
}
