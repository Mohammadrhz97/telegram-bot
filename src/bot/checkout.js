// ==========================
// src/bot/checkout.js
// Handles order checkout and payment proof upload
// ==========================

import { prisma } from "../db.js";
import { userCheckoutState } from "./state.js";
import { getCart, clearCart } from "./cart.js";

const ADMIN_IDS =
  process.env.TELEGRAM_ADMIN_IDS?.split(",").map((id) => id.trim()) || [];

/**
 * Internal Helper: Ensures user exists in DB
 */
async function getOrCreateUser(telegramId) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }
  return user;
}

export function registerCheckoutHandlers(bot) {
  // ----------------------------
  // Step 1: Initiate Checkout
  // ----------------------------
  bot.command("checkout", async (ctx) => {
    const telegramId = ctx.from.id.toString();

    // Reset any previous checkout state
    userCheckoutState.delete(telegramId);

    // Check if cart has items
    const cart = await getCart(telegramId);
    if (!cart || !cart.length) {
      return ctx.reply("🛒 سبد خریدت خالیه!");
    }

    // Initialize state machine to collect info
    userCheckoutState.set(telegramId, {
      step: "city",
      tempData: {},
    });

    await ctx.reply("🏙 لطفاً نام شهر خود را وارد کنید:");
  });

  // ----------------------------
  // Step 2: Collect User Info (Text Handler)
  // ----------------------------
  bot.on("text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return next();

    const telegramId = ctx.from.id.toString();
    const state = userCheckoutState.get(telegramId);
    if (!state) return next();

    try {
      // Collect City
      if (state.step === "city") {
        state.tempData.city = ctx.message.text;
        state.step = "address";
        return ctx.reply("📦 آدرس دقیق خود را بنویسید:");
      }

      // Collect Address
      if (state.step === "address") {
        state.tempData.address = ctx.message.text;
        state.step = "phone";
        return ctx.reply("📞 شماره تماس خود را وارد کنید:");
      }

      // Collect Phone & Create Order
      if (state.step === "phone") {
        state.tempData.phone = ctx.message.text;
        await ctx.reply("⏳ در حال ثبت نهایی سفارش...");

        const user = await getOrCreateUser(telegramId);
        const cart = await getCart(telegramId);

        // Calculate total price correctly (price is inside the product object)
        const total = cart.reduce((sum, item) => {
          return sum + (item.product?.price || 0) * item.qty;
        }, 0);

        // Create the order and its items in one transaction
        const order = await prisma.order.create({
          data: {
            userId: user.id,
            totalPrice: total,
            status: "awaiting_payment",
            address: `${state.tempData.city} - ${state.tempData.address}`,
            phone: state.tempData.phone,
            items: {
              create: cart.map((item) => ({
                productId: item.productId,
                qty: item.qty,
                price: item.product?.price || 0,
              })),
            },
          },
        });

        // Clear the cart after order is successfully recorded
        await clearCart(telegramId);

        await ctx.reply(
          `✅ سفارش ثبت شد!\n\n📦 شماره سفارش: ${order.id}\n💰 مبلغ کل: ${total.toLocaleString()} تومان`,
        );

        // Update state to wait for payment proof
        userCheckoutState.set(telegramId, {
          step: "awaiting_payment", // Changed to match the photo handler
          orderId: order.id,
        });

        await ctx.reply("💳 لطفاً تصویر فیش پرداخت خود را ارسال کنید:");

        // Notify Admins about new order
        const adminMsg = `🆕 سفارش جدید #${order.id}\n👤 یوزر: ${telegramId}\n📞 تلفن: ${state.tempData.phone}\n💰 مبلغ: ${total.toLocaleString()}`;
        for (const adminId of ADMIN_IDS) {
          try {
            await ctx.telegram.sendMessage(adminId, adminMsg);
          } catch {}
        }
      }
    } catch (err) {
      console.error("Checkout process error:", err);
      await ctx.reply("❌ خطا هنگام ثبت سفارش.");
      userCheckoutState.delete(telegramId);
    }
  });

  // ----------------------------
  // Step 3: Receive Payment Photo
  // ----------------------------
  bot.on("photo", async (ctx, next) => {
    const telegramId = ctx.from.id.toString();
    const state = userCheckoutState.get(telegramId);

    // Ensure user is in the correct step
    if (!state || state.step !== "awaiting_payment") return next();

    try {
      const fileId = ctx.message.photo.pop().file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      await prisma.order.update({
        where: { id: state.orderId },
        data: {
          paymentUrl: fileLink.href,
          status: "awaiting_admin_confirmation",
        },
      });

      userCheckoutState.set(telegramId, {
        step: "completed",
        orderId: state.orderId,
      });

      await ctx.reply(
        "✅ فیش پرداخت دریافت شد.\n" +
          "⏳ منتظر تأیید ادمین هستیم. به‌محض تأیید بهت خبر می‌دم.",
      );

      // Send payment proof to admins for confirmation
      for (const adminId of ADMIN_IDS) {
        try {
          await ctx.telegram.sendPhoto(adminId, fileId, {
            caption: `🧾 فیش پرداخت سفارش #${state.orderId}`,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ تأیید",
                    callback_data: `confirm_${state.orderId}`,
                  },
                  { text: "❌ رد", callback_data: `reject_${state.orderId}` },
                ],
              ],
            },
          });
        } catch {}
      }
    } catch (err) {
      console.error("Payment photo upload error:", err);
      await ctx.reply("❌ خطا در آپلود فیش پرداخت.");
    }
  });
}
