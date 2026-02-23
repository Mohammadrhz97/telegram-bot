// ==========================
// src/bot/checkout.js
// Handles order checkout and payment proof upload
// ==========================

import { prisma } from "../db.js";
import { userCheckoutState } from "./state.js";
import { getCart } from "./cart.js";
import { createOrder } from "./order.js";

const ADMIN_IDS =
  process.env.TELEGRAM_ADMIN_IDS?.split(",").map((id) => id.trim()) || [];

export function registerCheckoutHandlers(bot) {
  // ----------------------------
  // Step 1️⃣ : Start checkout
  // ----------------------------
  bot.command("checkout", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    console.log("STEP 1");

    userCheckoutState.delete(telegramId);

    console.log("STEP 2 - before getCart");

    const cart = await getCart(telegramId);

    console.log("STEP 3 - cart:", cart);

    if (!cart || !cart.length) {
      console.log("STEP 4 - empty cart");
      return ctx.reply("🛒 سبد خریدت خالیه!");
    }

    console.log("STEP 5 - creating order");

    const order = await prisma.order.create({
      data: {
        telegramId,
        status: "awaiting_payment",
        totalPrice: cart.reduce((s, i) => s + i.price, 0),
      },
    });

    console.log("STEP 6 - order created");

    await ctx.reply("OK REACHED END");
  });

  // ----------------------------
  // Step 2️⃣ : Collect info
  // ----------------------------
  bot.on("text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) {
      return next();
    }
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
            for (const adminId of ADMIN_IDS) {
              await ctx.telegram.sendMessage(adminId, msg);
            }
          },
        );

        await ctx.reply(
          `✅ سفارش ثبت شد!\n\n📦 شماره سفارش: ${
            order.id
          }\n💰 مبلغ کل: ${order.totalPrice.toLocaleString()} تومان`,
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

    if (!state || state.step !== "awaiting_payment") return next();

    const fileId = ctx.message.photo.pop().file_id;
    const fileUrl = await ctx.telegram.getFileLink(fileId);

    await prisma.order.update({
      where: { id: state.orderId },
      data: {
        paymentUrl: fileUrl.href,
        status: "awaiting_admin_confirmation",
      },
    });

    userCheckoutState.set(telegramId, {
      step: "awaiting_admin_confirmation",
      orderId: state.orderId,
    });

    await ctx.reply(
      "✅ فیش پرداخت دریافت شد.\n" +
        "⏳ منتظر تأیید ادمین هستیم. به‌محض تأیید بهت خبر می‌دم.",
    );
    for (const adminId of ADMIN_IDS) {
      await ctx.telegram.sendPhoto(adminId, fileId, {
        caption: `🧾 فیش پرداخت سفارش #${state.orderId}`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ تأیید پرداخت",
                callback_data: `confirm_${state.orderId}`,
              },
              {
                text: "❌ رد پرداخت",
                callback_data: `reject_${state.orderId}`,
              },
            ],
          ],
        },
      });
    }
  });
}
