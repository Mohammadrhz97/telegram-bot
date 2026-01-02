// src/bot/cartHandlers.js
import {
  getCart,
  addToCart,
  updateCartItemQty,
  deleteCartItem,
  clearCart,
} from "./cart.js"; // فایل دیتابیسی خودت
import { summaryByUser } from "./state.js";
import {
  getCartTotal,
  renderSummary,
  renderItemCaption,
  renderItemKeyboard,
} from "./helpers.js";

/** send/edit the pinned summary below the items */
async function updateSummary(telegramId, ctx) {
  const cart = await getCart(telegramId);
  const total = getCartTotal(cart);
  const hasItems = cart.length > 0;
  const { text, reply_markup } = renderSummary(total, hasItems);
  const ref = summaryByUser.get(telegramId);
  if (ref) {
    try {
      await ctx.telegram.editMessageText(
        ref.chatId,
        ref.messageId,
        undefined,
        text,
        reply_markup ? { reply_markup } : undefined
      );
      return;
    } catch {}
  }
  try {
    const msg = await ctx.reply(
      text,
      reply_markup ? { reply_markup } : undefined
    );
    if (msg?.message_id)
      summaryByUser.set(telegramId, {
        chatId: ctx.chat.id,
        messageId: msg.message_id,
      });
  } catch {}
}

export function registerCartHandlers(bot) {
  // Inline button callbacks (+/-/remove/add/clear)
  bot.on("callback_query", async (ctx, next) => {
    try {
      const data = ctx.callbackQuery.data || "";
      const telegramId = ctx.from.id.toString();
      const isCartAction =
        data.startsWith("addcart_") ||
        data.startsWith("cartinc_") ||
        data.startsWith("cartdec_") ||
        data.startsWith("cartdel_") ||
        data === "cartclear" ||
        data === "noop";

      if (!isCartAction) {
        return next();
      }

      if (data.startsWith("addcart_")) {
        const productId = parseInt(data.split("_")[1], 10);
        await addToCart(telegramId, productId);
        try {
          await ctx.answerCbQuery("✅ به سبد اضافه شد");
        } catch {}
        await ctx.reply("✅ آیتم به سبد خریدت اضافه شد!");
        return;
      }
      if (data === "noop") {
        try {
          await ctx.answerCbQuery();
        } catch {}
        return;
      }

      if (data.startsWith("cartinc_") || data.startsWith("cartdec_")) {
        const id = parseInt(data.split("_")[1], 10);
        const delta = data.startsWith("cartinc_") ? +1 : -1;
        const updated = await updateCartItemQty(telegramId, id, delta);
        if (updated) {
          await ctx.editMessageCaption(renderItemCaption(updated), {
            reply_markup: renderItemKeyboard(updated),
          });
        } else {
          try {
            await ctx.deleteMessage();
          } catch {}
        }
        await updateSummary(telegramId, ctx);
      } else if (data.startsWith("cartdel_")) {
        const id = parseInt(data.split("_")[1], 10);
        await deleteCartItem(telegramId, id);
        try {
          await ctx.deleteMessage();
        } catch {}
        await updateSummary(telegramId, ctx);
      } else if (data === "cartclear") {
        await clearCart(telegramId);
        await updateSummary(telegramId, ctx);
      } else {
        // Not a cart-related callback; let other handlers process it (e.g., admin)
        return next();
      }

      // show toast with new total
      try {
        const cartNow = await getCart(telegramId);
        const total = getCartTotal(cartNow);
        await ctx.answerCbQuery(`💰 جمع کل: ${total.toLocaleString()} تومان`);
      } catch {
        try {
          await ctx.answerCbQuery();
        } catch {}
      }
    } catch (err) {
      console.error("Callback error:", err);
      await ctx.reply("❌ خطایی رخ داد.");
    }
  });

  // /cart — show items as cards + summary
  bot.command("cart", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const cart = await getCart(telegramId);
    if (!cart.length) return ctx.reply("🛒 سبد خریدت خالیه.");

    for (const item of cart) {
      const caption = renderItemCaption(item);
      const reply_markup = renderItemKeyboard(item);
      const photo =
        item.product?.imageUrl || "https://via.placeholder.com/600x400";
      try {
        await ctx.replyWithPhoto(photo, { caption, reply_markup });
      } catch {
        await ctx.reply(caption, { reply_markup });
      }
    }

    const total = getCartTotal(cart);
    const { text, reply_markup } = renderSummary(total, true);
    const msg = await ctx.reply(
      text,
      reply_markup ? { reply_markup } : undefined
    );
    if (msg?.message_id)
      summaryByUser.set(telegramId, {
        chatId: ctx.chat.id,
        messageId: msg.message_id,
      });
  });
}
