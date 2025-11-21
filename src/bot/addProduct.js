// src/bot/addProduct.js
// Add product: model → brand → material → color → price → photo → local embedding

import { prisma } from "../db.js";
import {
  getState,
  setState,
  getTemp,
  setTemp,
  clearState,
  clearTemp,
} from "../state/state.js";
import { getImageEmbeddingFromTelegram } from "../ai/localEmbedding.js";

// 🟢 Timeout removed — we use a simple direct call
async function getEmbeddingWithTimeout(fileId, ctx) {
  try {
    console.log("⏳ Waiting for embedding (NO TIMEOUT)...");

    const result = await getImageEmbeddingFromTelegram(fileId, ctx);

    console.log("✔ Embedding returned:", result?.length || 0, "dimensions");

    return Array.isArray(result) ? result : null;
  } catch (err) {
    console.log("LOCAL_EMBEDDING_FAIL:", err);
    return null;
  }
}

export function registerAddProductHandlers(bot) {
  // Start add-product flow
  bot.command("addproduct", async (ctx) => {
    const uid = ctx.from.id.toString();

    setState(uid, "addproduct", "ask_model");
    clearTemp(uid);

    await ctx.reply("🧩 مدل گوشی/محصول را وارد کنید:");
  });

  // Step-by-step text questions
  bot.on("text", async (ctx, next) => {
    const uid = ctx.from.id.toString();
    const state = getState(uid);
    if (!state || state.flow !== "addproduct") return next();

    const text = (ctx.message?.text || "").trim();
    const temp = getTemp(uid) || {};

    if (state.step === "ask_model") {
      setTemp(uid, { ...temp, model: text });
      setState(uid, "addproduct", "ask_brand");
      return await ctx.reply("🏷 برند را وارد کنید (مثلاً Apple / Samsung):");
    }

    if (state.step === "ask_brand") {
      setTemp(uid, { ...temp, brand: text });
      setState(uid, "addproduct", "ask_material");
      return await ctx.reply(
        "🧱 جنس قاب را وارد کنید (مثلاً سیلیکونی، چرمی، فانتزی…):"
      );
    }

    if (state.step === "ask_material") {
      setTemp(uid, { ...temp, material: text });
      setState(uid, "addproduct", "ask_color");
      return await ctx.reply("🎨 رنگ را وارد کنید:");
    }

    if (state.step === "ask_color") {
      setTemp(uid, { ...temp, color: text });
      setState(uid, "addproduct", "ask_price");
      return await ctx.reply("💰 قیمت را به صورت عددی وارد کنید (تومان):");
    }

    if (state.step === "ask_price") {
      const price = parseInt(text);
      if (isNaN(price)) {
        return await ctx.reply("❗ قیمت باید فقط عدد باشد. دوباره بفرست:");
      }

      setTemp(uid, { ...temp, price });
      setState(uid, "addproduct", "ask_photo");
      return await ctx.reply("📸 حالا لطفاً عکس محصول را ارسال کنید:");
    }

    return next();
  });

  // Photo step: compute local embedding and save
  bot.on("photo", async (ctx, next) => {
    const uid = ctx.from.id.toString();
    const state = getState(uid);
    if (!state || state.flow !== "addproduct" || state.step !== "ask_photo") {
      return next();
    }

    const temp = getTemp(uid) || {};

    try {
      // Highest quality photo (last item)
      const photoSizes = ctx.message.photo || [];
      if (!photoSizes.length) throw new Error("No photo in message");

      const fileId = photoSizes[photoSizes.length - 1].file_id;

      // Get direct Telegram file URL (for imageUrl)
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const imageUrl = fileLink.href;

      // Local embedding via CLIP (NO TIMEOUT)
      const vector = await getEmbeddingWithTimeout(fileId, ctx);

      const embeddingArray = Array.isArray(vector) ? vector : [];

      // Save product
      const product = await prisma.product.create({
        data: {
          model: temp.model,
          brand: temp.brand,
          material: temp.material,
          color: temp.color,
          price: temp.price,
          imageUrl, // real URL
          telegramFileId: fileId, // raw Telegram file_id
          embedding: embeddingArray,
        },
      });

      clearState(uid);
      clearTemp(uid);

      console.log("📦 NEW PRODUCT ADDED");
      console.log("ID:", product.id);
      console.log("FILE_ID:", fileId);
      console.log("IMAGE_URL:", imageUrl);
      console.log("EMBEDDING_LENGTH:", embeddingArray.length);

      await ctx.reply("✅ محصول با موفقیت اضافه شد و ایمبدینگ آن ذخیره شد. 🎉");
    } catch (err) {
      console.log("addProduct error:", err);
      await ctx.reply("❌ خطا در افزودن محصول. لطفاً دوباره تلاش کنید.");
    }
  });
}
