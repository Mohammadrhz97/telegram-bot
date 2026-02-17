// src/index.js
import "./db.js";
import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";

// ===== Register Bot Modules =====
import { registerUserHandlers } from "./bot/user.js";
import { registerAdminAddProductHandlers } from "./bot/adminAddProduct.js"; // ← FIXED
import { registerSearchHandlers } from "./bot/search.js";
import { registerPhotoSearchHandlers } from "./bot/photoSearch.js";
import { registerProductsHandlers } from "./bot/products.js";
import { registerCartHandlers } from "./bot/cartHandlers.js";
import { registerCheckoutHandlers } from "./bot/checkout.js";
import { registerAdminHandlers } from "./bot/admin.js";
import { registerAdminPanel } from "./bot/adminPanel.js";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const sessionStore = new Map();
bot.use(async (ctx, next) => {
  const key =
    ctx.from?.id?.toString() ||
    ctx.chat?.id?.toString() ||
    ctx.message?.chat?.id?.toString();

  if (!key) return next();

  ctx.session = sessionStore.get(key) || null;

  await next();

  if (ctx.session === null || typeof ctx.session === "undefined") {
    sessionStore.delete(key);
  } else {
    sessionStore.set(key, ctx.session);
  }
});

// ===============================
// ✅ CORRECT ORDER — FIXED FOR 2025
// ===============================

// 1) Admin Add Product & Admin Panel (High Priority)
registerAdminHandlers(bot);
registerAdminAddProductHandlers(bot);
registerAdminPanel(bot);

// 2) Checkout System
// باید قبل از جستجوی متنی باشد تا موقع آدرس گرفتن، ربات سرچ نکند
registerCheckoutHandlers(bot);

// 3) Cart Handlers
// مدیریت سبد خرید
registerCartHandlers(bot);

// 4) Basic user commands (/start, /help)
registerUserHandlers(bot);

// 5) Product Listing & Brand Filters
registerProductsHandlers(bot);

// 6) AI Photo Search
// جستجوی عکس (باید بعد از مراحل مدیریت و خرید باشد)
registerPhotoSearchHandlers(bot);

// 7) AI Text Search (Lowest Priority)
// چون این هندلر به همه متن‌ها واکنش نشان می‌دهد، باید آخرین لایه باشد
registerSearchHandlers(bot);

bot.launch();
console.log("🚀 Bot is running...");
