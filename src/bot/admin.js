// ==========================
// src/bot/admin.js
// Admin panel: view & confirm orders
// ==========================
import { prisma } from "../db.js";

export function registerAdminHandlers(bot) {
  // 🔍 Admin command to list orders
  bot.command("orders", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    if (telegramId !== process.env.TELEGRAM_ADMIN_ID) {
      return ctx.reply("⛔ فقط مدیر می‌تواند سفارش‌ها را مشاهده کند.");
    }

    try {
      const orders = await prisma.order.findMany({
        include: {
          user: true,
          items: { include: { product: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!orders.length) return ctx.reply("🕊 هنوز سفارشی ثبت نشده است.");

      for (const o of orders) {
        let text = `📦 سفارش #${o.id}\n`;
        text += `👤 ${o.user?.fullName || "-"}\n`;
        text += `🏙️ ${o.city || "-"} | 📞 ${o.phone || "-"}\n`;
        text += `🏠 ${o.address || "-"}\n\n`;
        text += `🧾 محصولات:\n`;
        o.items.forEach((i) => {
          text += `- ${i.product.model} (${i.product.color || ""}) × ${
            i.qty
          }\n`;
        });
        text += `\n💰 جمع کل: ${o.totalPrice.toLocaleString()} تومان\n`;
        text += `📅 ${new Date(o.createdAt).toLocaleString("fa-IR")}\n`;
        text += `📍 وضعیت: ${statusEmoji(o.status)}\n`;

        const keyboard = { inline_keyboard: [] };
        if (o.paymentUrl) {
          keyboard.inline_keyboard.push([
            {
              text: "🖼 مشاهده فیش پرداخت",
              callback_data: `showproof_${o.id}`,
            },
          ]);
          keyboard.inline_keyboard.push([
            {
              text: "✅ تأیید پرداخت",
              callback_data: `confirm_${o.id}`,
            },
            {
              text: "❌ رد پرداخت",
              callback_data: `reject_${o.id}`,
            },
          ]);
        }

        await ctx.reply(text, {
          reply_markup: keyboard.inline_keyboard.length ? keyboard : undefined,
        });
      }
    } catch (err) {
      console.error("Admin orders error:", err);
      await ctx.reply("❌ خطا در دریافت سفارش‌ها.");
    }
  });

  // 🧾 Handle button clicks (callback queries)
  bot.on("callback_query", async (ctx) => {
    const telegramId = ctx.from.id.toString();
    if (telegramId !== process.env.TELEGRAM_ADMIN_ID) {
      await ctx.answerCbQuery("⛔ شما ادمین نیستید.");
      return;
    }

    const data = ctx.callbackQuery.data;

    try {
      // 🖼 Show payment proof
      if (data.startsWith("showproof_")) {
        const orderId = parseInt(data.split("_")[1]);
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order?.paymentUrl)
          return ctx.answerCbQuery("❌ فیشی برای این سفارش وجود ندارد.");
        await ctx.replyWithPhoto(order.paymentUrl, {
          caption: `🧾 فیش پرداخت سفارش #${orderId}`,
        });
        return ctx.answerCbQuery();
      }

      // ✅ Confirm payment
      if (data.startsWith("confirm_")) {
        const orderId = parseInt(data.split("_")[1]);
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: "confirmed" },
          include: { user: true },
        });

        await ctx.answerCbQuery("✅ پرداخت تأیید شد!");
        await ctx.reply(`✅ سفارش #${orderId} تأیید شد و آماده ارسال است.`);

        if (order.user?.telegramId) {
          await ctx.telegram.sendMessage(
            order.user.telegramId,
            `✅ پرداخت سفارش شما (#${orderId}) تأیید شد و به‌زودی ارسال می‌شود.`
          );
        }
      }

      // ❌ Reject payment
      if (data.startsWith("reject_")) {
        const orderId = parseInt(data.split("_")[1]);
        const order = await prisma.order.update({
          where: { id: orderId },
          data: { status: "rejected" },
          include: { user: true },
        });

        await ctx.answerCbQuery("🚫 پرداخت رد شد!");
        await ctx.reply(`🚫 سفارش #${orderId} رد شد.`);

        if (order.user?.telegramId) {
          await ctx.telegram.sendMessage(
            order.user.telegramId,
            `🚫 پرداخت سفارش شما (#${orderId}) توسط ادمین رد شد. لطفاً جهت بررسی دوباره اقدام کنید.`
          );
        }
      }
    } catch (err) {
      console.error("Admin callback error:", err);
      await ctx.answerCbQuery("❌ خطا در انجام عملیات.");
    }
  });
}

// 🧩 Helper function: Convert status → readable text
function statusEmoji(status) {
  const map = {
    pending: "⏳ در انتظار پرداخت",
    paid: "💳 پرداخت‌شده",
    confirmed: "✅ تأییدشده",
    shipped: "🚚 ارسال‌شده",
    delivered: "📦 تحویل‌شده",
    rejected: "❌ ردشده",
    cancelled: "🚫 لغوشده",
  };
  return map[status] || "🔘 نامشخص";
}
