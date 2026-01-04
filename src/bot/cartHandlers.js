// =====================================================
// src/bot/cartHandlers.js
// Handles cart interactions:
// - Add / remove items
// - Increase / decrease quantity
// - Clear cart
// - Render cart items & live summary
// =====================================================

import {
  getCart,
  addToCart,
  updateCartItemQty,
  deleteCartItem,
  clearCart,
} from "./cart.js";

import { summaryByUser } from "./state.js";

import {
  getCartTotal,
  renderSummary,
  renderItemCaption,
  renderItemKeyboard,
} from "./helpers.js";

// =====================================================
// Helper: Create or update the pinned cart summary
// - Edits existing summary message if possible
// - Otherwise sends a new summary message
// - Stores reference per user for future updates
// =====================================================
async function updateSummary(telegramId, ctx) {
  // Fetch current cart
  const cart = await getCart(telegramId);

  // Calculate total price
  const total = getCartTotal(cart);
  const hasItems = cart.length > 0;

  // Render summary text + keyboard
  const { text, reply_markup } = renderSummary(total, hasItems);

  // Try to edit previously stored summary message
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
    } catch {
      // message might be deleted or not editable
    }
  }

  // Otherwise send a new summary message
  try {
    const msg = await ctx.reply(
      text,
      reply_markup ? { reply_markup } : undefined
    );

    // Save reference for future edits
    if (msg?.message_id) {
      summaryByUser.set(telegramId, {
        chatId: ctx.chat.id,
        messageId: msg.message_id,
      });
    }
  } catch {
    // Ignore send errors
  }
}

// =====================================================
// Register all cart-related handlers
// =====================================================
export function registerCartHandlers(bot) {
  // ---------------------------------------------------
  // Inline keyboard callbacks
  // Handles:
  //  - addcart_{productId}
  //  - cartinc_{cartItemId}
  //  - cartdec_{cartItemId}
  //  - cartdel_{cartItemId}
  //  - cartclear
  // ---------------------------------------------------
  bot.on("callback_query", async (ctx, next) => {
    try {
      const data = ctx.callbackQuery.data || "";
      const telegramId = ctx.from.id.toString();

      // Detect whether this callback is cart-related
      const isCartAction =
        data.startsWith("addcart_") ||
        data.startsWith("cartinc_") ||
        data.startsWith("cartdec_") ||
        data.startsWith("cartdel_") ||
        data === "cartclear" ||
        data === "noop";

      // Let other handlers (e.g. admin) process non-cart callbacks
      if (!isCartAction) return next();

      // ----------------------------
      // Add product to cart
      // ----------------------------
      if (data.startsWith("addcart_")) {
        const productId = parseInt(data.split("_")[1], 10);
        await addToCart(telegramId, productId);

        try {
          await ctx.answerCbQuery("✅ به سبد اضافه شد");
        } catch {}

        await ctx.reply("✅ آیتم به سبد خریدت اضافه شد!");
        return;
      }

      // ----------------------------
      // No-op button (UX placeholder)
      // ----------------------------
      if (data === "noop") {
        try {
          await ctx.answerCbQuery();
        } catch {}
        return;
      }

      // ----------------------------
      // Increase / decrease quantity
      // ----------------------------
      if (data.startsWith("cartinc_") || data.startsWith("cartdec_")) {
        const id = parseInt(data.split("_")[1], 10);
        const delta = data.startsWith("cartinc_") ? +1 : -1;

        // Update quantity
        const updated = await updateCartItemQty(telegramId, id, delta);

        if (updated) {
          // Update item message caption + keyboard
          await ctx.editMessageCaption(renderItemCaption(updated), {
            reply_markup: renderItemKeyboard(updated),
          });
        } else {
          // Item removed (qty <= 0)
          try {
            await ctx.deleteMessage();
          } catch {}
        }

        // Update summary message
        await updateSummary(telegramId, ctx);
      }

      // ----------------------------
      // Remove item from cart
      // ----------------------------
      else if (data.startsWith("cartdel_")) {
        const id = parseInt(data.split("_")[1], 10);
        await deleteCartItem(telegramId, id);

        try {
          await ctx.deleteMessage();
        } catch {}

        await updateSummary(telegramId, ctx);
      }

      // ----------------------------
      // Clear entire cart
      // ----------------------------
      else if (data === "cartclear") {
        await clearCart(telegramId);
        await updateSummary(telegramId, ctx);
      }

      // ----------------------------
      // Toast: show updated total
      // ----------------------------
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

  // ---------------------------------------------------
  // /cart command
  // Renders:
  // - Each cart item as a product card
  // - Final summary message (editable)
  // ---------------------------------------------------
  bot.command("cart", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const cart = await getCart(telegramId);

    if (!cart.length) {
      return ctx.reply("🛒 سبد خریدت خالیه.");
    }

    // Render each item
    for (const item of cart) {
      const caption = renderItemCaption(item);
      const reply_markup = renderItemKeyboard(item);

      // Fallback image if missing
      const photo =
        item.product?.imageUrl || "https://via.placeholder.com/600x400";

      try {
        await ctx.replyWithPhoto(photo, { caption, reply_markup });
      } catch {
        await ctx.reply(caption, { reply_markup });
      }
    }

    // Render summary at the end
    const total = getCartTotal(cart);
    const { text, reply_markup } = renderSummary(total, true);

    const msg = await ctx.reply(
      text,
      reply_markup ? { reply_markup } : undefined
    );

    // Save summary reference
    if (msg?.message_id) {
      summaryByUser.set(telegramId, {
        chatId: ctx.chat.id,
        messageId: msg.message_id,
      });
    }
  });
}
