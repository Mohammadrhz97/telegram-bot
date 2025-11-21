// src/bot/adminPanel.js
// Admin Panel (Orders + Reports with pagination)

import { prisma } from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import moment from "moment-jalaali";
moment.loadPersian({ dialect: "persian-modern", usePersianDigits: false });

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

// compute time range + label for reports
function getReportRange(range) {
  const now = new Date();
  let start, end, label;

  if (range === "daily") {
    label = "📅 گزارش امروز";
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (range === "weekly") {
    label = "📆 گزارش هفتگی";
    const day = now.getDay();
    const diff = (day + 6) % 7; // start: Monday-ish
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  } else {
    label = "🗓 گزارش ماهانه";
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return { label, start, end };
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

      // orders filtered (no pagination, full UI)
      if (data === "orders_paid") return sendOrdersByGroup(ctx, "paid");
      if (data === "orders_pending") return sendOrdersByGroup(ctx, "pending");
      if (data === "orders_cancelled")
        return sendOrdersByGroup(ctx, "cancelled");

      // reports — main buttons
      if (data === "report_daily") return sendReport(ctx, "daily");
      if (data === "report_weekly") return sendReport(ctx, "weekly");
      if (data === "report_monthly") return sendReport(ctx, "monthly");

      // reports — pagination
      if (data.startsWith("report_page_")) {
        // pattern: report_page_<range>_<page>
        const parts = data.split("_");
        const range = parts[2];
        const page = parseInt(parts[3] || "0", 10) || 0;
        await sendReportPage(ctx, range, page, true);
        return;
      }

      // reports — single order detail
      if (data.startsWith("report_detail_")) {
        const orderId = parseInt(data.replace("report_detail_", ""), 10);
        if (!isNaN(orderId)) {
          await sendReportOrderDetail(ctx, orderId);
        } else {
          await ctx.answerCbQuery("❌ شناسه سفارش نامعتبر است.");
        }
        return;
      }

      return next();
    } catch (err) {
      console.error("ADMIN_PANEL_ERR:", err);
      await ctx.answerCbQuery("❌ خطای سرور.");
    }
  });
}

// =======================
//  Orders grouped with BEAUTIFUL UI (admin_orders)
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

    // FULL PRODUCT DETAILS
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
// Generate + send sales reports (Daily / Weekly / Monthly)
// =========================
// =========================
// Generate + send XLSX reports
// =========================
import ExcelJS from "exceljs";

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
    include: {
      user: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

  // Summary
  await ctx.reply(
    `${label}\n\n📊 تعداد سفارش‌ها: ${
      orders.length
    }\n💰 مجموع فروش: ${totalRevenue.toLocaleString()} تومان`
  );

  if (!orders.length)
    return ctx.reply("هیچ سفارشی برای ساخت گزارش وجود ندارد.");

  // =============================
  // Show orders in Telegram
  // =============================
  for (const o of orders) {
    let text =
      `🆔 *ID سفارش:* ${o.id}\n` +
      `👤 *نام مشتری:* ${o.user?.fullName || "-"}\n` +
      `🪪 *آیدی تلگرام:* ${o.user?.telegramId || "-"}\n` +
      `💵 *قیمت کل:* ${o.totalPrice.toLocaleString()} تومان\n` +
      `📅 *تاریخ:* ${new Date(o.createdAt).toLocaleString("fa-IR")}\n` +
      `📦 *جزییات محصولات:*\n`;

    for (const item of o.items) {
      const p = item.product;
      text += `• (${p.id}) ${p.model} - ${p.color || "-"} × ${item.qty}\n`;
    }

    text += `\n━━━━━━━━━━━━━━`;

    await ctx.replyWithMarkdown(text);
  }

  // =============================
  // Build XLSX file
  // =============================

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Orders Report");

  // Columns
  sheet.columns = [
    { header: "Order ID", key: "order_id", width: 10 },
    { header: "Telegram ID", key: "telegram_id", width: 15 },
    { header: "Full Name", key: "full_name", width: 20 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Total Price", key: "total_price", width: 15 },
    { header: "Status", key: "status", width: 12 },
    { header: "Created At", key: "created_at", width: 22 },
    { header: "Items", key: "items", width: 50 },
  ];

  // Add rows
  for (const o of orders) {
    const itemsText = o.items
      .map(
        (i) =>
          `(${i.product.id}) ${i.product.model} - ${i.product.color} x${i.qty}`
      )
      .join(" | ");

    sheet.addRow({
      order_id: o.id,
      telegram_id: o.user?.telegramId || "",
      full_name: o.user?.fullName || "",
      phone: o.phone || o.user?.phone || "",
      total_price: o.totalPrice,
      status: o.status,
      created_at: moment(o.createdAt).format("jYYYY/jMM/jDD HH:mm"),
      items: itemsText,
    });
  }

  // File path
  const persianDate = moment().format("jYYYY-jMM-jDD");
  const fileName = `${range}-report-${persianDate}.xlsx`;
  const filePath = path.join(reportsDir, fileName);

  // Save file
  await workbook.xlsx.writeFile(filePath);

  await ctx.replyWithDocument({ source: filePath, filename: fileName });
}

// =========================
// Paginated report view
// =========================
async function sendReportPage(ctx, range, page) {
  const { label, start, end } = getReportRange(range);
  const paidStatuses = ["paid", "confirmed", "shipped", "delivered"];

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      status: { in: paidStatuses },
    },
    include: {
      user: true,
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!orders.length) return;

  const pageSize = 10;
  const totalPages = Math.ceil(orders.length / pageSize);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, orders.length);

  let text = `📄 ${label}\nصفحه ${currentPage + 1} از ${totalPages}\n\n`;

  for (let i = startIndex; i < endIndex; i++) {
    const o = orders[i];
    const fullName = o.user?.fullName || "-";
    const telegramId = o.user?.telegramId || "-";
    const dateStr = new Date(o.createdAt).toLocaleDateString("fa-IR");

    text +=
      `🆔 سفارش: #${o.id}\n` +
      `👤 مشتری: ${fullName}\n` +
      `🪪 آیدی تلگرام: ${telegramId}\n` +
      `💵 مبلغ: ${o.totalPrice.toLocaleString()} تومان\n` +
      `📅 تاریخ: ${dateStr}\n` +
      `📦 محصولات:\n`;

    for (const item of o.items || []) {
      const p = item.product || {};
      text += `• #${p.id} | ${p.model} | ${p.material} | ${p.color} × ${item.qty}\n`;
    }

    text += `━━━━━━━━━━━━━━\n`;
  }

  const keyboard = [];

  const row = [];
  if (currentPage > 0)
    row.push({
      text: "◀ قبلی",
      callback_data: `report_page_${range}_${currentPage - 1}`,
    });

  row.push({
    text: `صفحه ${currentPage + 1} از ${totalPages}`,
    callback_data: "noop",
  });

  if (currentPage < totalPages - 1)
    row.push({
      text: "بعدی ▶",
      callback_data: `report_page_${range}_${currentPage + 1}`,
    });

  keyboard.push(row);

  keyboard.push([
    { text: "⬅ بازگشت به گزارش‌ها", callback_data: "admin_reports" },
  ]);

  await ctx.reply(text, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

// show full detailed order (from report_detail_x)
async function sendReportOrderDetail(ctx, orderId) {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      items: { include: { product: true } },
    },
  });

  if (!o) {
    await ctx.answerCbQuery("❌ سفارش پیدا نشد.");
    return;
  }

  const fullName = o.user?.fullName || "-";
  const telegramId = o.user?.telegramId || "-";
  const phone = o.phone || o.user?.phone || "-";
  const city = o.city || "-";
  const addr = o.address || "-";

  let text =
    `🧾 *جزئیات کامل سفارش #${o.id}*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 *مشخصات مشتری*\n` +
    `• نام: ${fullName}\n` +
    `• آیدی تلگرام: ${telegramId}\n` +
    `• شماره تماس: ${phone}\n` +
    `• شهر: ${city}\n` +
    `• آدرس:\n  ${addr}\n\n` +
    `📦 *اقلام سفارش*\n`;

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
      `🔢 *قیمت:* ${item.price.toLocaleString()} تومان\n`;
  }

  text +=
    `\n💳 *مبلغ نهایی:* ${o.totalPrice.toLocaleString()} تومان\n` +
    `📌 *وضعیت:* ${statusLabel(o.status)}\n` +
    `📅 *تاریخ:* ${new Date(o.createdAt).toLocaleString("fa-IR")}\n` +
    `━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(text);
  await ctx.answerCbQuery();
}
