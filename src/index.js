// src/index.js
import dotenv from "dotenv";
dotenv.config();

import { Telegraf } from "telegraf";

// Register handler modules
import { registerUserHandlers } from "./bot/user.js";
import { registerAddProductHandlers } from "./bot/addProduct.js";
import { registerSearchHandlers } from "./bot/search.js";
import { registerPhotoSearchHandlers } from "./bot/photoSearch.js";
import { registerProductsHandlers } from "./bot/products.js";
import { registerCartHandlers } from "./bot/cartHandlers.js";
import { registerCheckoutHandlers } from "./bot/checkout.js";
import { registerAdminHandlers } from "./bot/admin.js";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// ===== ORDER MATTERS — DO NOT CHANGE =====

// 1) Basic user commands (must be first)
registerUserHandlers(bot);

// 2) Admin Add Product (has its own text/photo flow)
registerAddProductHandlers(bot);

// 3) AI TEXT search (must come BEFORE photo search)
registerSearchHandlers(bot);

// 4) AI PHOTO search (only runs when lastModel is known)
registerPhotoSearchHandlers(bot);

// 5) Product listing
registerProductsHandlers(bot);

// 6) Cart handlers
registerCartHandlers(bot);

// 7) Checkout flow
registerCheckoutHandlers(bot);

// 8) Admin order approval
registerAdminHandlers(bot);

// ===== END =====

bot.launch();
console.log("🚀 Bot is running (modular + AI text + AI photo search)...");
