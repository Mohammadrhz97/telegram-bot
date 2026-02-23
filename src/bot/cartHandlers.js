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

/**
 * Helper: Create or update the pinned cart summary message
 * - Updates existing summary if it exists
 * - Sends a new message if no reference is found or if editing fails
 */
async function updateSummary(telegramId, ctx) {
  // Fetch cart (returns empty array if user doesn't exist yet)
  const cart = await getCart(telegramId);

  // Calculate total price using helper
  const total = getCartTotal(cart);
  const hasItems = cart.length > 0;

  // Prepare text and keyboard based on cart status
  const { text, reply_markup } = renderSummary(total, hasItems);

  // Attempt to edit the previous summary message
  const ref = summaryByUser.get(telegramId);
  if (ref) {
    try {
      await ctx.telegram.editMessageText(
        ref.chatId,
        ref.messageId,
        undefined,
        text,
        reply_markup ? { reply_markup } : undefined,
      );
      return;
    } catch (err) {
      // Message might be deleted or too old to edit
    }
  }

  // Send a new summary if editing failed or no reference exists
  try {
    const msg = await ctx.reply(
      text,
      reply_markup ? { reply_markup } : undefined,
    );

    // Save message reference for future updates
    if (msg?.message_id) {
      summaryByUser.set(telegramId, {
        chatId: ctx.chat.id,
        messageId: msg.message_id,
      });
    }
  } catch (err) {
    console.error("Failed to send summary message:", err);
  }
}

/**
 * Register all cart-related interaction handlers
 */
export function registerCartHandlers(bot) {
  /**
   * Inline Keyboard Callback Handler
   * Processes all interactions starting with 'addcart_', 'cartinc_', etc.
   */
  bot.on("callback_query", async (ctx, next) => {
    try {
      const data = ctx.callbackQuery.data || "";
      const telegramId = ctx.from.id.toString();

      // Check if the callback belongs to the cart module
      const isCartAction =
        data.startsWith("addcart_") ||
        data.startsWith("cartinc_") ||
        data.startsWith("cartdec_") ||
        data.startsWith("cartdel_") ||
        data === "cartclear" ||
        data === "noop";

      if (!isCartAction) return next();

      // --- Action: Add product to cart ---
      if (data.startsWith("addcart_")) {
        const productId = parseInt(data.split("_")[1], 10);
        // addToCart now automatically handles user creation if missing
        await addToCart(telegramId, productId);

        try {
          await ctx.answerCbQuery("✅ به سبد اضافه شد");
        } catch {}

        await ctx.reply("✅ آیتم به سبد خریدت اضافه شد!");
        return;
      }

      // --- Action: No-op (Used for static UI buttons) ---
      if (data === "noop") {
        try {
          await ctx.answerCbQuery();
        } catch {}
        return;
      }

      // --- Action: Increase / Decrease quantity ---
      if (data.startsWith("cartinc_") || data.startsWith("cartdec_")) {
        const id = parseInt(data.split("_")[1], 10);
        const delta = data.startsWith("cartinc_") ? +1 : -1;

        const updated = await updateCartItemQty(telegramId, id, delta);

        if (updated) {
          // Refresh existing item card with new qty
          await ctx.editMessageCaption(renderItemCaption(updated), {
            reply_markup: renderItemKeyboard(updated),
          });
        } else {
          // Delete message if item was removed (qty became 0)
          try {
            await ctx.deleteMessage();
          } catch {}
        }

        // Update the main summary message
        await updateSummary(telegramId, ctx);
      }

      // --- Action: Delete specific item ---
      else if (data.startsWith("cartdel_")) {
        const id = parseInt(data.split("_")[1], 10);
        await deleteCartItem(telegramId, id);

        try {
          await ctx.deleteMessage();
        } catch {}

        await updateSummary(telegramId, ctx);
      }

      // --- Action: Clear entire cart ---
      else if (data === "cartclear") {
        await clearCart(telegramId);
        await updateSummary(telegramId, ctx);
      }

      // Final toast to show updated cart total to the user
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
      console.error("Cart callback error:", err);
      await ctx.reply("❌ مشکلی در پردازش سبد خرید پیش آمد.");
    }
  });

  /**
   * Command: /cart
   * Displays all items in the user's cart followed by a summary
   */
  bot.command("cart", async (ctx) => {
    try {
      const telegramId = ctx.from.id.toString();
      const cart = await getCart(telegramId);

      if (!cart.length) {
        return ctx.reply("🛒 سبد خریدت خالیه.");
      }

      // Render a message for each individual cart item
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

      // Render the final summary block
      const total = getCartTotal(cart);
      const { text, reply_markup } = renderSummary(total, true);

      const msg = await ctx.reply(
        text,
        reply_markup ? { reply_markup } : undefined,
      );

      // Store message reference for later updates
      if (msg?.message_id) {
        summaryByUser.set(telegramId, {
          chatId: ctx.chat.id,
          messageId: msg.message_id,
        });
      }
    } catch (err) {
      console.error("Cart command error:", err);
      await ctx.reply("❌ خطایی در نمایش سبد خرید رخ داد.");
    }
  });
}
