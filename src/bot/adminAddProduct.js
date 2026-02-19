// adminAddProducts.js
import { prisma } from "../db.js";
import { getImageEmbeddingFromTelegram } from "../ai/localEmbedding.js";
import { normalizeAnyModel } from "../ai/normalize.js";
import { suggestModelCodes, MODEL_CATALOG } from "../ai/suggestModel.js";
import { displayProductList } from "./products.js";
import M from "./messages.js";

const ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS?.split(",").map((id) =>
  id.trim(),
);

function isAdmin(ctx) {
  return ADMIN_IDS?.includes(ctx.from?.id?.toString());
}

// map shortcode => label
const MODEL_LABEL_BY_SHORTCODE = new Map(
  MODEL_CATALOG.map((e) => [e.shortcode.toLowerCase(), e.label]),
);

function getLabelForShortcode(shortcode = "") {
  return MODEL_LABEL_BY_SHORTCODE.get(shortcode.toLowerCase()) || null;
}

function collectSummaryContext(ctx) {
  return {
    chatId: ctx.chat?.id,
    messageId: ctx.callbackQuery?.message?.message_id,
    inlineMessageId: ctx.callbackQuery?.inline_message_id,
  };
}

/**
 * Builds the product summary text (caption) exactly as shown to the user,
 * including the availability status.
 */
function buildProductSummaryText(product) {
  const price =
    typeof product.price === "number"
      ? new Intl.NumberFormat("fa-IR").format(product.price)
      : (product.price ?? "");

  let text =
    `📱 مدل: ${product.model}\n` +
    `🏷 برند: ${product.brand || "-"}\n` +
    `🧱 جنس: ${product.material || "-"}\n` +
    `🎨 رنگ: ${product.color || "-"}\n` +
    `💰 قیمت: ${price} تومان`;

  const status = product.available ? "✅ موجود" : "🚫 ناموجود";

  text += `\n\nوضعیت: ${status}`;

  return text;
}

function buildProductKeyboard(product) {
  return {
    inline_keyboard: [
      [
        { text: "🏷 برند", callback_data: `product_edit_brand_${product.id}` },
        {
          text: "🧵 جنس",
          callback_data: `product_edit_material_${product.id}`,
        },
      ],
      [
        { text: "🎨 رنگ", callback_data: `product_edit_color_${product.id}` },
        { text: "💰 قیمت", callback_data: `product_edit_price_${product.id}` },
      ],
      [
        { text: "🖼 عکس", callback_data: `product_edit_photo_${product.id}` },
        {
          text: product.available ? "🚫 ناموجود" : "✅ موجود",
          callback_data: `product_toggle_${product.id}`,
        },
      ],
      [{ text: "🗑 حذف محصول", callback_data: `product_delete_${product.id}` }],
    ],
  };
}

// src/bot/adminAddProduct.js

async function refreshProductSummary(ctx, product, summaryContext = null) {
  const text = buildProductSummaryText(product);
  const reply_markup = buildProductKeyboard(product);

  if (!summaryContext) {
    // If no context is provided, send a new message (fallback)
    return ctx.reply(text, { reply_markup });
  }

  const { chatId, messageId, inlineMessageId } = summaryContext;

  try {
    // 1. Tries to edit the MESSAGE CAPTION (for messages that have a photo)
    await ctx.telegram.editMessageCaption(
      chatId,
      messageId,
      inlineMessageId,
      text, // The new caption text
      { reply_markup },
    );
  } catch (err) {
    // This catch block handles:
    // a) If the message was text-only (Telegram error: 'message can't be edited')
    // b) Other errors (like message too old)

    // 2. Fallback: If editing caption fails, try editing the MESSAGE TEXT (if it was a text-only message)
    try {
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        inlineMessageId,
        text,
        { reply_markup },
      );
    } catch (textEditErr) {
      console.error("REFRESH_SUMMARY_FAILED", textEditErr); // 3. Final Fallback: If both caption and text editing fail, send a new message.
      await ctx.reply(text, { reply_markup });
    }
  }
}

/**
 * Creates a validated "create" session and advances steps.
 */
function startCreateSession(ctx) {
  ctx.session = {
    mode: "create",
    step: "model",
    data: {},
  };
}

/**
 * Safely clears session (used on cancel/finish/error).
 */
function endSession(ctx) {
  ctx.session = null;
}

/**
 * Generic helper for starting an "edit" session for a product.
 */
async function startEditSession(ctx, productId, field) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    await ctx.answerCbQuery("محصول پیدا نشد.", { show_alert: true });
    return null;
  }

  ctx.session = {
    mode: "edit",
    step: "edit_text", // expecting text unless field is photo
    field,
    productId,
    summaryContext: collectSummaryContext(ctx),
    original: product,
  };

  return product;
}

/**
 * Top-level registration function — call from your bot init.
 */
export function registerAdminAddProductHandlers(bot) {
  // ---------- ADD PRODUCT ENTRY ----------
  bot.command("addproduct", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply(M.NOT_ADMIN_ADD);
    startCreateSession(ctx);
    return ctx.replyWithMarkdown(M.ADDPRODUCT_INTRO);
  });

  // ---------- TEXT HANDLER FOR CREATE + EDIT ----------
  bot.on("text", async (ctx, next) => {
    // Only handle text if in admin session (add/edit)
    if (!ctx.session || !isAdmin(ctx) || !ctx.session.mode) {
      return next();
    }

    const input = String(ctx.message.text || "").trim();
    if (!input) return ctx.reply(M.EMPTY_INPUT);

    const s = ctx.session;

    // cancel
    if (["/cancel", "cancel", "لغو", "laqv"].includes(input.toLowerCase())) {
      endSession(ctx);
      return ctx.reply(M.CANCELLED);
    }

    // --- EDIT FLOW ---
    if (s.mode === "edit") {
      return await handleEditFlowText(ctx, input);
    }

    // --- CREATE FLOW ---
    if (s.mode !== "create") return; // Model step

    if (s.step === "model") {
      const suggestions = suggestModelCodes(input.toLowerCase() || "");
      const helpText = "📱✨ *در حال بررسی مدل...*\n";
      if (suggestions && suggestions.length) {
        const buttons = suggestions.map((shortcode) => {
          const fullName = getLabelForShortcode(shortcode) ?? shortcode;
          return [
            {
              text: fullName,
              callback_data: `select_model_${shortcode}`, // Callback data MUST remain the shortcode
            },
          ];
        });
        // show suggestions inline

        return ctx.reply(helpText + "\n🔍 شاید منظورت یکی از این‌ها باشد:", {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: buttons,
          },
        });
      }

      // fallback normalize
      const best = normalizeAnyModel(input, input);
      if (!best) {
        return ctx.reply(
          helpText +
            "\n❗ *مدل معتبر نبود.*\nلطفاً دقیق‌تر بنویس یا از پیشنهادها استفاده کن.",
          { parse_mode: "Markdown" },
        );
      }

      s.data.model = best.shortcode;
      s.data.modelFull = best.fullname;
      s.step = "brand";
      return ctx.reply("🏷 برند قاب را وارد کنید:");
    }

    // brand
    if (s.step === "brand") {
      if (!input) return ctx.reply("❗ برند نمی‌تواند خالی باشد.");
      s.data.brand = input;
      s.step = "material";
      return ctx.reply("🧱 جنس قاب را وارد کنید:");
    }

    // material
    if (s.step === "material") {
      if (!input) return ctx.reply("❗ جنس نمی‌تواند خالی باشد.");
      s.data.material = input;
      s.step = "color";
      return ctx.reply("🎨 رنگ قاب را وارد کنید:");
    }

    // color
    if (s.step === "color") {
      if (!input) return ctx.reply("❗ رنگ نمی‌تواند خالی باشد.");
      s.data.color = input;
      s.step = "price";
      return ctx.reply("💰 قیمت را وارد کنید (فقط عدد):");
    }

    // price
    if (s.step === "price") {
      const price = parseInt(input.replace(/[^\d]/g, ""), 10);
      if (Number.isNaN(price))
        return ctx.reply("❗ قیمت باید عدد باشد. مثال: 1250000");
      s.data.price = price;
      s.step = "photo";
      return ctx.reply("🖼 لطفاً عکس قاب را ارسال کنید:");
    }

    // if text on photo step
    if (s.step === "photo") {
      return ctx.reply("❗ لطفاً عکس بفرستید یا /cancel برای انصراف.");
    }
  });

  // ---------- MODEL SUGGESTION CALLBACK ----------

  bot.action(/select_model_(.+)/, async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.answerCbQuery(M.NOT_ADMIN_ACTION_CB, { show_alert: true });
    }
    if (!ctx.session || ctx.session.mode !== "create") {
      return ctx.answerCbQuery(M.SESSION_INACTIVE_CB);
    }
    if (ctx.session.step !== "model") {
      return ctx.answerCbQuery(M.MODEL_STEP_INACTIVE_CB);
    }
    const selected = ctx.match[1];
    if (!selected) return ctx.answerCbQuery("مقدار نامعتبر است.");

    ctx.session.data = ctx.session.data || {};
    ctx.session.data.model = selected;
    ctx.session.data.modelFull = getLabelForShortcode(selected) ?? selected;
    ctx.session.step = "brand";

    const selectedFullName = ctx.session.data.modelFull;

    try {
      await ctx.editMessageText(
        `✅ مدل انتخاب شد: **${selectedFullName}**\n\nلطفاً نام برند قاب را ارسال کنید.`, // ⬅️ استفاده از نام کامل
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      // if edit fails, just reply
      await ctx.reply(
        `✅ مدل انتخاب شد: **${selectedFullName}**\n\nلطفاً نام برند قاب را ارسال کنید.`, // ⬅️ استفاده از نام کامل
        { parse_mode: "Markdown" },
      );
    }
    await ctx.answerCbQuery("مدل ذخیره شد.");
  });

  // ---------- PHOTO (CREATE or EDIT PHOTO) ----------
  bot.on("photo", async (ctx, next) => {
    // ensure admin
    if (!isAdmin(ctx)) return next(); // silently ignore
    if (!ctx.session) return next();

    // choose last (best) size
    const file = Array.isArray(ctx.message.photo)
      ? ctx.message.photo.pop()
      : null;
    if (!file) return ctx.reply("❗ عکس نامعتبر است.");

    // if we're in create flow
    if (ctx.session.mode === "create" && ctx.session.step === "photo") {
      // guard
      if (!ctx.session.data || typeof ctx.session.data !== "object") {
        console.error("ctx.session.data invalid:", ctx.session.data);
        endSession(ctx);
        return ctx.reply("⚠️ اطلاعات ناقص شد. از اول /addproduct را اجرا کن.");
      }

      try {
        const embedding = await getImageEmbeddingFromTelegram(
          file.file_id,
          ctx,
        );
        if (!embedding) {
          return ctx.reply("❌ خطا در ساخت embedding. لطفاً دوباره تلاش کن.");
        }

        const createData = {
          model: ctx.session.data.model,
          modelFull: ctx.session.data.modelFull,
          brand: ctx.session.data.brand,
          material: ctx.session.data.material,
          color: ctx.session.data.color,
          price: ctx.session.data.price,
          imageUrl: file.file_id,
          embedding,
        };

        const product = await prisma.product.create({ data: createData });

        endSession(ctx);
        await ctx.reply("✅ محصول با موفقیت ثبت شد!");
        await displayProductList(ctx, [product]);
        return;
      } catch (err) {
        console.error("ADD_PRODUCT_ERR:", err);
        return ctx.reply("❌ خطا در ذخیره محصول.");
      }
    }

    // EDIT PHOTO flow (session.mode === 'edit' and session.field === 'photo')
    if (ctx.session.mode === "edit" && ctx.session.field === "photo") {
      const productId = ctx.session.productId;
      try {
        const embedding = await getImageEmbeddingFromTelegram(
          file.file_id,
          ctx,
        );
        if (!embedding) {
          return ctx.reply("❌ خطا در ساخت embedding. لطفاً دوباره تلاش کن.");
        }

        const updated = await prisma.product.update({
          where: { id: productId },
          data: {
            imageUrl: file.file_id,
            embedding,
          },
        });

        const summaryContext = ctx.session.summaryContext;
        endSession(ctx);
        await ctx.reply("✅ عکس محصول به‌روزرسانی شد.");
        await refreshProductSummary(ctx, updated, summaryContext);
        return;
      } catch (err) {
        console.error("EDIT_PHOTO_ERR:", err);
        return ctx.reply("❌ خطا در به‌روزرسانی عکس.");
      }
    }

    // otherwise: ignore or instruct
    return ctx.reply(
      "❗ عکس ثبت نشد — ابتدا /addproduct را اجرا کن یا فرایند ویرایش را شروع کن.",
    );
  });

  // ---------- CALLBACKS: edit fields, toggle, delete ----------
  // edit field callbacks like product_edit_model_<id>
  bot.action(/product_edit_(.+)_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx))
      return ctx.answerCbQuery(M.NOT_ADMIN_ACTION_CB, { show_alert: true });
    const field = ctx.match[1];
    const id = Number(ctx.match[2]);
    if (!id) return ctx.answerCbQuery("ID نامعتبر.");

    const product = await startEditSession(ctx, id, field);
    if (!product) return;

    // if photo edit, expect a photo
    if (field === "photo") {
      ctx.session.field = "photo";
      ctx.session.step = "edit_photo";
      await ctx.answerCbQuery("برای ویرایش عکس، لطفاً عکس جدید را ارسال کنید.");
      return;
    }

    // set to expect text
    ctx.session.step = "edit_text";

    // prefill prompt with current value
    const currentValue =
      product[field] ?? (field === "model" ? product.model : "");
    await ctx.answerCbQuery("ارسال مقدار جدید...", { show_alert: false });
    await ctx.reply(
      `✏️ در حال ویرایش فیلد "${field}"\nمقدار کنونی: ${currentValue}\n\n${
        M.EDIT_PROMPTS[field] || "مقدار جدید را ارسال کنید:"
      }`,
    );
  });

  // toggle availability
  bot.action(/product_toggle_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx))
      return ctx.answerCbQuery(M.NOT_ADMIN_ACTION_CB, { show_alert: true });
    const id = Number(ctx.match[1]);
    if (!id) return ctx.answerCbQuery("ID نامعتبر.");
    try {
      const p = await prisma.product.findUnique({ where: { id } });
      if (!p) return ctx.answerCbQuery("محصول پیدا نشد.", { show_alert: true });

      const updated = await prisma.product.update({
        where: { id },
        data: { available: !p.available },
      });

      await refreshProductSummary(ctx, updated, collectSummaryContext(ctx));
      return ctx.answerCbQuery("وضعیت محصول به‌روزرسانی شد.");
    } catch (err) {
      console.error("TOGGLE_ERR", err);
      return ctx.answerCbQuery("خطا در تغییر وضعیت.", { show_alert: true });
    }
  });

  // delete product
  bot.action(/product_delete_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx))
      return ctx.answerCbQuery(M.NOT_ADMIN_ACTION_CB, { show_alert: true });
    const id = Number(ctx.match[1]);
    if (!id) return ctx.answerCbQuery("ID نامعتبر.");
    try {
      await prisma.product.delete({ where: { id } });
      await ctx.answerCbQuery("محصول حذف شد.");
      // try removing the inline message text if possible
      try {
        const sc = collectSummaryContext(ctx);
        if (sc.inlineMessageId) {
          await ctx.telegram.deleteMessage(
            undefined,
            undefined,
            sc.inlineMessageId,
          );
        } else if (sc.chatId && sc.messageId) {
          await ctx.telegram.deleteMessage(sc.chatId, sc.messageId);
        }
      } catch (err) {
        // ignore
      }
    } catch (err) {
      console.error("DELETE_ERR", err);
      return ctx.answerCbQuery("خطا در حذف محصول.", { show_alert: true });
    }
  });
}

/**
 * Handles text input while in edit session.
 */
async function handleEditFlowText(ctx, input) {
  const s = ctx.session;
  if (!s || s.mode !== "edit") return false;
  if (!isAdmin(ctx)) return ctx.reply(M.NOT_ADMIN_ACTION);

  const productId = s.productId;
  const field = s.field;

  // validate product exists
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    endSession(ctx);
    return ctx.reply("❗ محصول موردنظر وجود ندارد.");
  }

  if (s.step !== "edit_text") {
    return ctx.reply(
      "❗ در این مرحله متن قابل دریافت نیست. اگر قصد لغو دارید /cancel را بزنید.",
    );
  }

  // Field-specific handling
  const updateData = {};
  switch (field) {
    case "price": {
      const price = parseInt(input.replace(/[^\d]/g, ""), 10);
      if (Number.isNaN(price))
        return ctx.reply("❗ قیمت باید فقط عدد باشد. مثال: 1250000");
      updateData.price = price;
      break;
    }
    case "model": {
      const normalized = normalizeAnyModel(input, input);
      if (!normalized)
        return ctx.reply(
          "❗ مدل قابل شناسایی نیست. لطفاً دقیق‌تر بنویس یا از پیشنهادها استفاده کن.",
        );
      updateData.model = normalized.shortcode;
      // only set modelFull if it was empty previously (to avoid overwriting custom names)
      if (!product.modelFull || product.modelFull === product.model) {
        updateData.modelFull = normalized.fullname;
      }
      break;
    }
    case "modelfull":
      if (!input) return ctx.reply("❗ نام کامل نمی‌تواند خالی باشد.");
      updateData.modelFull = input;
      break;
    case "brand":
    case "material":
    case "color":
      if (!input) return ctx.reply(`❗ مقدار ${field} نمی‌تواند خالی باشد.`);
      updateData[field] = input;
      break;
    default:
      endSession(ctx);
      return ctx.reply("❗ فیلد نامعتبر.");
  }

  try {
    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });
    endSession(ctx);
    await ctx.reply("✔️ محصول به‌روزرسانی شد.");
    await displayProductList(ctx, [updated]);
    return true;
  } catch (err) {
    console.error("EDIT_SAVE_ERR", err);
    endSession(ctx);
    return ctx.reply("❌ خطا در ذخیره تغییرات.");
  }
}

export {
  isAdmin,
  endSession,
  refreshProductSummary,
  buildProductKeyboard,
  buildProductSummaryText,
};
