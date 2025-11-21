// src/bot/adminAddProduct.js
import { prisma } from "../db.js";
import {
  getImageEmbedding,
  downloadTelegramPhotoToBase64,
} from "../ai/clarifai.js";

export function registerAdminAddProductHandlers(bot) {
  bot.command("addproduct", async (ctx) => {
    const id = ctx.from.id.toString();
    if (id !== process.env.TELEGRAM_ADMIN_ID)
      return ctx.reply("⛔ فقط ادمین می‌تواند محصول اضافه کند.");

    ctx.session = { step: "model", data: {} };
    return ctx.reply("📱 مدل گوشی را وارد کنید:");
  });

  bot.on("text", async (ctx) => {
    if (!ctx.session) return;

    const t = ctx.message.text;
    const s = ctx.session;

    if (s.step === "model") {
      s.data.model = t;
      s.step = "brand";
      return ctx.reply("🏷 برند:");
    }

    if (s.step === "brand") {
      s.data.brand = t;
      s.step = "material";
      return ctx.reply("🧱 جنس:");
    }

    if (s.step === "material") {
      s.data.material = t;
      s.step = "color";
      return ctx.reply("🎨 رنگ:");
    }

    if (s.step === "color") {
      s.data.color = t;
      s.step = "price";
      return ctx.reply("💰 قیمت:");
    }

    if (s.step === "price") {
      s.data.price = parseInt(t);
      s.step = "photo";
      return ctx.reply("🖼 لطفاً عکس قاب را ارسال کنید:");
    }

    if (s.step === "photo") {
      return ctx.reply("❗ لطفاً عکس بفرست.");
    }
  });

  bot.on("photo", async (ctx) => {
    if (!ctx.session || ctx.session.step !== "photo") return;

    const file = ctx.message.photo.pop();
    const link = await ctx.telegram.getFileLink(file.file_id);

    const base64 = await downloadTelegramPhotoToBase64(link.href);
    if (!base64) return ctx.reply("❌ خطا در پردازش تصویر.");

    const embedding = await getImageEmbedding(base64);
    if (!embedding) return ctx.reply("❌ خطا: embedding ساخته نشد.");

    // Save product
    const created = await prisma.product.create({
      data: {
        ...ctx.session.data,
        imageUrl: file.file_id, // تلگرام CDN
        embedding,
      },
    });

    ctx.session = null;
    return ctx.reply("✅ محصول با موفقیت ثبت شد!");
  });
}
