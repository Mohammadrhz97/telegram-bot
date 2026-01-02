// ==========================
// src/bot/checkout.js
// Handles order checkout and payment proof upload
// ==========================

import { prisma } from "../db.js";
import { userCheckoutState } from "./state.js";
import { getCart } from "./cart.js";
import { createOrder } from "./order.js";

export function registerCheckoutHandlers(bot) {
  // ----------------------------
  // Step 1️⃣ : Start checkout
  // ----------------------------
  bot.command("checkout", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const cart = await getCart(telegramId);

    if (!cart || !cart.length) {
      return ctx.reply("🛒 سبد خریدت خالیه!");
    }

    userCheckoutState.set(telegramId, { step: "city", tempData: {} });
    await ctx.reply("🏙️ لطفاً نام شهر خود را بنویسید:");
  });

  // ----------------------------
  // Step 2️⃣ : Collect info
  // ----------------------------
  bot.on("text", async (ctx, next) => {
    const telegramId = ctx.from.id.toString();
    const state = userCheckoutState.get(telegramId);
    if (!state) return next();

    try {
      if (state.step === "city") {
        state.tempData.city = ctx.message.text;
        state.step = "address";
        return ctx.reply("📦 آدرس دقیق خود را بنویسید:");
      }

      if (state.step === "address") {
        state.tempData.address = ctx.message.text;
        state.step = "phone";
        return ctx.reply("📞 شماره تماس خود را وارد کنید:");
      }

      if (state.step === "phone") {
        state.tempData.phone = ctx.message.text;
        await ctx.reply("⏳ در حال ثبت سفارش...");

        const order = await createOrder(
          telegramId,
          state.tempData,
          async (msg) => {
            if (process.env.TELEGRAM_ADMIN_ID) {
              await ctx.telegram.sendMessage(
                process.env.TELEGRAM_ADMIN_ID,
                msg
              );
            }
          }
        );

        await ctx.reply(
          `✅ سفارش ثبت شد!\n\n📦 شماره سفارش: ${
            order.id
          }\n💰 مبلغ کل: ${order.totalPrice.toLocaleString()} تومان`
        );

        userCheckoutState.set(telegramId, {
          step: "payment",
          orderId: order.id,
        });

        await ctx.reply("💳 لطفاً تصویر فیش پرداخت خود را ارسال کنید:");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      await ctx.reply("❌ خطا هنگام ثبت سفارش.");
      userCheckoutState.delete(telegramId);
    }
  });

  // ----------------------------
  // Step 3️⃣ : Receive payment photo
  // ----------------------------
  bot.on("photo", async (ctx, next) => {
    const telegramId = ctx.from.id.toString();
    const state = userCheckoutState.get(telegramId);
    if (!state || state.step !== "payment") return next();

    try {
      const orderId = state.orderId;
      const fileId = ctx.message.photo.pop().file_id;
      const fileUrl = await ctx.telegram.getFileLink(fileId);

      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentUrl: fileUrl.href,
          status: "paid",
        },
      });

      userCheckoutState.delete(telegramId);

      await ctx.reply("✅ فیش پرداخت ثبت شد و در انتظار بررسی ادمین است.");

      if (process.env.TELEGRAM_ADMIN_ID) {
        await ctx.telegram.sendPhoto(process.env.TELEGRAM_ADMIN_ID, fileId, {
          caption: `🧾 فیش پرداخت سفارش #${orderId}\n👤 ${ctx.from.first_name}`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ تأیید پرداخت",
                  callback_data: `confirm_${orderId}`,
                },
                { text: "❌ رد پرداخت", callback_data: `reject_${orderId}` },
              ],
            ],
          },
        });
      }
    } catch (err) {
      console.error("Payment upload error:", err);
      await ctx.reply("❌ خطا در ثبت فیش پرداخت.");
    }
  });
}
