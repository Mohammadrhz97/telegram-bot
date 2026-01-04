// ==========================
// src/bot/admin.js
// Admin panel: view & confirm orders
// ==========================

import { prisma } from "../db.js";

export function registerAdminHandlers(bot) {
  // ----------------------------
  // 📦 List orders
  // ----------------------------
  bot.command("orders", async (ctx) => {
    if (ctx.from.id.toString() !== process.env.TELEGRAM_ADMIN_ID) {
      return ctx.reply("⛔ دسترسی غیرمجاز");
    }

    const orders = await prisma.order.findMany({
      include: {
        user: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!orders.length) {
      return ctx.reply("🕊 سفارشی وجود ندارد.");
    }

    for (const o of orders) {
      let text = `📦 سفارش #${o.id}\n`;
      text += `👤 ${o.user?.fullName || "-"}\n`;
      text += `📞 ${o.phone || "-"} | 🏙️ ${o.city || "-"}\n`;
      text += `🏠 ${o.address || "-"}\n\n`;
      text += `💰 ${o.totalPrice.toLocaleString()} تومان\n`;
      text += `📍 وضعیت: ${statusEmoji(o.status)}`;

      const keyboard = [];

      if (o.paymentUrl && o.status === "paid") {
        keyboard.push([
          { text: "🖼 مشاهده فیش", callback_data: `showproof_${o.id}` },
        ]);
        keyboard.push([
          { text: "✅ تأیید پرداخت", callback_data: `confirm_${o.id}` },
          { text: "❌ رد پرداخت", callback_data: `reject_${o.id}` },
        ]);
      }

      await ctx.reply(text, {
        reply_markup: keyboard.length
          ? { inline_keyboard: keyboard }
          : undefined,
      });
    }
  });

  // ----------------------------
  // 🖼 Show payment proof
  // ----------------------------
  bot.action(/^showproof_(\d+)$/, async (ctx) => {
    if (ctx.from.id.toString() !== process.env.TELEGRAM_ADMIN_ID) {
      return ctx.answerCbQuery("⛔");
    }

    const orderId = Number(ctx.match[1]);
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order?.paymentUrl) {
      return ctx.answerCbQuery("❌ فیش پیدا نشد");
    }

    await ctx.replyWithPhoto(order.paymentUrl, {
      caption: `🧾 فیش پرداخت سفارش #${orderId}`,
    });

    await ctx.answerCbQuery();
  });

  // ----------------------------
  // ✅ Confirm payment
  // ----------------------------
  bot.action(/^confirm_(\d+)$/, async (ctx) => {
    if (ctx.from.id.toString() !== process.env.TELEGRAM_ADMIN_ID) {
      return ctx.answerCbQuery("⛔ دسترسی غیرمجاز");
    }

    const orderId = Number(ctx.match[1]);

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: "paid" },
      include: { user: true },
    });

    const telegramId = order.user?.telegramId;
    if (!telegramId) {
      await ctx.answerCbQuery("⚠️ کاربر پیدا نشد");
      return;
    }

    userCheckoutState.set(telegramId, {
      step: "city",
      orderId,
      tempData: {},
    });

    await ctx.answerCbQuery("تأیید شد ✅");
    await ctx.reply(`✅ پرداخت سفارش #${orderId} تأیید شد.`);

    await ctx.telegram.sendMessage(
      telegramId,
      "✅ پرداخت شما تأیید شد 🎉\n\n" +
        "برای تکمیل سفارش، لطفاً اطلاعات ارسال را وارد کنیم.\n" +
        "🏙️ نام شهر خود را بنویسید:"
    );
  });

  // ----------------------------
  // ❌ Reject payment
  // ----------------------------
  bot.action(/^reject_(\d+)$/, async (ctx) => {
    if (ctx.from.id.toString() !== process.env.TELEGRAM_ADMIN_ID) {
      return ctx.answerCbQuery("⛔");
    }

    const orderId = Number(ctx.match[1]);

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: "rejected" },
      include: { user: true },
    });

    await ctx.answerCbQuery("رد شد ❌");
    await ctx.reply(`🚫 پرداخت سفارش #${orderId} رد شد.`);

    if (order.user?.telegramId) {
      await ctx.telegram.sendMessage(
        order.user.telegramId,
        `🚫 پرداخت سفارش شما (#${orderId}) رد شد. لطفاً فیش جدید ارسال کنید.`
      );
    }
  });
}

function statusEmoji(status) {
  return (
    {
      paid: "💳 پرداخت شده",
      confirmed: "✅ تأیید شده",
      rejected: "❌ رد شده",
    }[status] || "⏳ در انتظار"
  );
}
