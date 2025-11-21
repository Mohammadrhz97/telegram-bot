// ==========================
// src/bot/userOrders.js
// User's personal order history with status icons
// ==========================
import { getUserOrders } from "./order.js";

// 🧩 Helper: status → emoji
function statusEmoji(status) {
  const map = {
    pending: "🔄 در حال بررسی",
    paid: "💳 پرداخت‌شده (در انتظار تأیید)",
    confirmed: "✅ پرداخت تأیید شد",
    shipped: "🚚 ارسال‌شده",
    delivered: "📦 تحویل‌شده",
    cancelled: "❌ لغوشده",
  };
  return map[status] || "🔘 نامشخص";
}

export function registerUserOrderHandlers(bot) {
  bot.command("myorders", async (ctx) => {
    const telegramId = ctx.from.id.toString();

    try {
      const orders = await getUserOrders(telegramId);
      if (!orders || orders.length === 0)
        return ctx.reply("📦 هنوز سفارشی ثبت نکرده‌اید.");

      let message = "🧾 سفارش‌های شما:\n\n";

      for (const o of orders) {
        const date = new Date(o.createdAt).toLocaleString("fa-IR");
        const emojiStatus = statusEmoji(o.status);

        message += `📦 سفارش #${o.id}\n`;
        message += `💰 مبلغ کل: ${o.totalPrice.toLocaleString()} تومان\n`;
        message += `📅 تاریخ: ${date}\n`;
        message += `📍 شهر: ${o.city}\n`;
        message += `☎️ شماره: ${o.phone}\n`;
        message += `🧾 وضعیت: ${emojiStatus}\n`;
        message += `━━━━━━━━━━━━━━━\n`;
      }

      await ctx.reply(message.trim());
    } catch (err) {
      console.error("MyOrders error:", err);
      await ctx.reply(
        "❌ خطا در دریافت سفارش‌ها. لطفاً بعداً دوباره تلاش کنید."
      );
    }
  });
}
