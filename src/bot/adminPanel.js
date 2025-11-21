// src/bot/adminPanel.js
// Admin Panel (Orders + Reports)

import { prisma } from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// reports directory
const reportsDir = path.resolve(__dirname, "../../reports");
try {
  fs.mkdirSync(reportsDir, { recursive: true });
} catch {}

// admin id from .env
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID || "";

// =========================
// Inline Menus
// =========================
function adminMainMenu() {
  return {
    inline_keyboard: [
      [{ text: "🧾 سفارش‌ها", callback_data: "admin_orders" }],
      [{ text: "📈 گزارش فروش", callback_data: "admin_reports" }],
    ],
  };
}

function ordersMenu() {
  return {
    inline_keyboard: [
      [
        { text: "🟢 پرداخت‌شده", callback_data: "orders_paid" },
        { text: "🔴 لغوشده / رد شده", callback_data: "orders_cancelled" },
      ],
      [
        { text: "⬅ بازگشت", callback_data: "admin_back" },
        { text: "🟡 در انتظار", callback_data: "orders_pending" },
      ],
    ],
  };
}

function reportsMenu() {
  return {
    inline_keyboard: [
      [{ text: "📅 گزارش امروز + CSV", callback_data: "report_daily" }],
      [{ text: "📆 گزارش هفتگی + CSV", callback_data: "report_weekly" }],
      [{ text: "🗓 گزارش ماهانه + CSV", callback_data: "report_monthly" }],
      [{ text: "⬅ بازگشت", callback_data: "admin_back" }],
    ],
  };
}

// =========================
// Helpers
// =========================

// readable status label
function statusLabel(status) {
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

// check admin access
function isAdmin(ctx) {
  return ctx.from && ctx.from.id.toString() === ADMIN_ID;
}

// =========================
// Register all admin handlers
// =========================
export function registerAdminPanel(bot) {
  // Admin command
  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx)) return ctx.reply("⛔ شما ادمین نیستید.");

    await ctx.reply(
      "👑 خوش آمدید!\n\nدر این بخش می‌توانید سفارش‌ها، پرداخت‌ها و گزارش‌های فروش را مدیریت کنید.",
      { reply_markup: adminMainMenu() }
    );
  });

  // Callback handler
  bot.on("callback_query", async (ctx, next) => {
    const data = ctx.callbackQuery?.data || "";

    // ignore if not admin panel related
    if (
      !data.startsWith("admin_") &&
      !data.startsWith("orders_") &&
      !data.startsWith("report_")
    ) {
      return next();
    }

    // admin check
    if (!isAdmin(ctx)) {
      await ctx.answerCbQuery("⛔ دسترسی فقط برای ادمین.");
      return;
    }

    try {
      // back button
      if (data === "admin_back") {
        await ctx.editMessageText(
          "👑 منوی اصلی مدیریت\nیک گزینه را انتخاب کنید:",
          {
            reply_markup: adminMainMenu(),
          }
        );
        return;
      }

      // orders menu
      if (data === "admin_orders") {
        await ctx.editMessageText(
          "🧾 مدیریت سفارش‌ها\nدر این بخش می‌توانید تمام سفارش‌ها را مشاهده، بررسی و وضعیت پرداخت را مدیریت کنید.",
          { reply_markup: ordersMenu() }
        );
        return;
      }

      // reports menu
      if (data === "admin_reports") {
        await ctx.editMessageText(
          "📈 گزارش‌های فروش\nدر این بخش می‌توانید گزارش‌های روزانه، هفتگی و ماهانه را مشاهده کرده و فایل CSV خروجی بگیرید.",
          { reply_markup: reportsMenu() }
        );
        return;
      }

      // orders filtered
      if (data === "orders_paid") return sendOrdersByGroup(ctx, "paid");
      if (data === "orders_pending") return sendOrdersByGroup(ctx, "pending");
      if (data === "orders_cancelled")
        return sendOrdersByGroup(ctx, "cancelled");

      // reports
      if (data === "report_daily") return sendReport(ctx, "daily");
      if (data === "report_weekly") return sendReport(ctx, "weekly");
      if (data === "report_monthly") return sendReport(ctx, "monthly");

      return next();
    } catch (err) {
      console.error("ADMIN_PANEL_ERR:", err);
      await ctx.answerCbQuery("❌ خطای سرور.");
    }
  });
}

// =======================
//  Orders grouped with BEAUTIFUL UI
// =======================
async function sendOrdersByGroup(ctx, group) {
  let title = "";
  let whereStatus;

  if (group === "paid") {
    title = "🟢 سفارش‌های پرداخت‌شده";
    whereStatus = { in: ["paid", "confirmed", "shipped", "delivered"] };
  } else if (group === "pending") {
    title = "🟡 سفارش‌های در انتظار پرداخت";
    whereStatus = "pending";
  } else {
    title = "🔴 سفارش‌های لغوشده / رد شده";
    whereStatus = { in: ["cancelled", "rejected"] };
  }

  const where =
    typeof whereStatus === "string"
      ? { status: whereStatus }
      : { status: whereStatus };

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  if (!orders.length) {
    await ctx.reply(`${title}\n\nهیچ سفارشی در این دسته وجود ندارد.`);
    return;
  }

  await ctx.reply(`${title}\n\nتعداد: ${orders.length}`);

  for (const o of orders) {
    const fullName = o.user?.fullName || "-";
    const telegramId = o.user?.telegramId || "-";
    const phone = o.phone || o.user?.phone || "-";
    const city = o.city || "-";
    const addr = o.address || "-";

    let text =
      `🧾 *سفارش #${o.id}*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `👤 *مشخصات مشتری*\n` +
      `• نام: ${fullName}\n` +
      `• آیدی تلگرام: ${telegramId}\n` +
      `• شماره تماس: ${phone}\n` +
      `• شهر: ${city}\n` +
      `• آدرس:\n  ${addr}\n\n` +
      `📦 *اقلام سفارش*\n`;

    // 🔥 FULL PRODUCT DETAILS
    for (const item of o.items || []) {
      const p = item.product || {};

      text +=
        `\n━━━━━━━━━━━━━━\n` +
        `🆔 *محصول #${p.id || "-"}*\n` +
        `📱 *مدل:* ${p.model || "-"}\n` +
        `🏷 *برند:* ${p.brand || "-"}\n` +
        `🧱 *جنس:* ${p.material || "-"}\n` +
        `🎨 *رنگ:* ${p.color || "-"}\n` +
        `🔢 *تعداد:* ${item.qty}\n` +
        `🔢 *قیمت:* ${item.price.toLocaleString()} تومان\n` +
        `━━━━━━━━━━━━━━\n`;
    }

    text +=
      `\n💳 *مبلغ نهایی*\n` +
      `• ${o.totalPrice.toLocaleString()} تومان\n\n` +
      `📌 *وضعیت:*  ${statusLabel(o.status)}\n` +
      `📅 *تاریخ:*  ${new Date(o.createdAt).toLocaleString("fa-IR")}\n` +
      `━━━━━━━━━━━━━━━━━━`;

    await ctx.replyWithMarkdown(text);
  }
}

// =========================
// Generate + send CSV reports
// =========================
async function sendReport(ctx, range) {
  const now = new Date();
  let start;
  let label;

  if (range === "daily") {
    label = "📅 گزارش امروز";
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "weekly") {
    label = "📆 گزارش هفتگی";
    const day = now.getDay();
    const diff = (day + 6) % 7;
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  } else {
    label = "🗓 گزارش ماهانه";
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const end =
    range === "daily"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      : range === "weekly"
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const paidStatuses = ["paid", "confirmed", "shipped", "delivered"];

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      status: { in: paidStatuses },
    },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  await ctx.reply(
    `${label}\n\n📊 تعداد: ${
      orders.length
    }\n💰 مجموع فروش: ${totalRevenue.toLocaleString()} تومان`
  );

  if (!orders.length)
    return ctx.reply("هیچ سفارشی برای ساخت فایل گزارش وجود ندارد.");

  const fileName = `${range}-report-${now.toISOString().slice(0, 10)}.csv`;
  const filePath = path.join(reportsDir, fileName);

  const header =
    "order_id,user_telegram_id,full_name,phone,total_price,status,created_at\n";

  const lines = orders.map((o) => {
    const fullName = (o.user?.fullName || "").replace(/,/g, " ");
    const phone = (o.phone || o.user?.phone || "").replace(/,/g, " ");
    return [
      o.id,
      `"${o.user?.telegramId || ""}"`,
      `"${fullName}"`,
      `"${phone}"`,
      o.totalPrice,
      o.status,
      o.createdAt.toISOString(),
    ].join(",");
  });

  fs.writeFileSync(filePath, header + lines.join("\n"), "utf8");

  await ctx.replyWithDocument({ source: filePath, filename: fileName });
}
