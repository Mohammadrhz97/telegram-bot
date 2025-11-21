// src/index.js
import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";

// ===== Register Bot Modules =====
import { registerUserHandlers } from "./bot/user.js";
import { registerAddProductHandlers } from "./bot/addProduct.js";
import { registerSearchHandlers } from "./bot/search.js";
import { registerPhotoSearchHandlers } from "./bot/photoSearch.js";
import { registerProductsHandlers } from "./bot/products.js";
import { registerCartHandlers } from "./bot/cartHandlers.js";
import { registerCheckoutHandlers } from "./bot/checkout.js";

// ⭐ NEW: Admin Panel (UI + Buttons + Reports)
import { registerAdminPanel } from "./bot/adminPanel.js";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ===============================
// ⚠️ ORDER IS IMPORTANT — DO NOT CHANGE
// ===============================

// 1) Basic user commands
registerUserHandlers(bot);

// 2) Admin add-product flow
registerAddProductHandlers(bot);

// 3) AI text search
registerSearchHandlers(bot);

// 4) AI photo search (needs lastModel)
registerPhotoSearchHandlers(bot);

// 5) Product listing
registerProductsHandlers(bot);

// 6) Cart handlers
registerCartHandlers(bot);

// 7) Checkout system
registerCheckoutHandlers(bot);

// 8) Admin Panel (menu + orders + reports)
registerAdminPanel(bot);

// ===============================

bot.launch();
console.log("🚀 Bot is running (AI text + AI image + Admin Panel)...");
