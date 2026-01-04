// src/bot/products.js
// Handles product listing, filtering by brand based on modelFull, and display with add-to-cart buttons.

import { prisma } from "../db.js";

//  Importing admin functions for product management access
import { isAdmin, buildProductKeyboard } from "./adminAddProduct.js";

// Helper mapping to transform selected brand into keywords for modelFull search
const BRAND_MODEL_KEYWORDS = {
  // Keywords for searching in the 'modelFull' field (case-insensitive via Prisma)
  Apple: ["iPhone", "apple", "آیفون"],
  Samsung: ["Samsung", "Galaxy", "سامسونگ"],
  Xiaomi: ["Xiaomi", "Redmi", "Mi", "Poco", "شیائومی", "ردمی", "پوکو"],
  // 'All' is handled by skipping the where clause.
};

/**
 * Safely resolves the product image URL for Telegraf's replyWithPhoto method.
 * Handles Telegram file_id, direct external image URLs, or returns null if invalid.
 * @param {string | null | undefined} imageUrl The URL/file_id stored in the database.
 * @returns {string | {url: string} | null} File ID, URL object, or null if invalid.
 */
function resolveInputPhoto(imageUrl) {
  if (!imageUrl) return null; // Check for null input
  const looksLikeFileId =
    /^[A-Za-z0-9_-]{20,}$/.test(imageUrl) && !imageUrl.startsWith("http");
  if (looksLikeFileId) return imageUrl; // Return Telegram File ID

  const lower = imageUrl.toLowerCase();
  const isDirectImage =
    lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");

  if (imageUrl.startsWith("http") && isDirectImage) {
    try {
      // Prevent using Telegram's own file URLs as external URLs
      const u = new URL(imageUrl);
      const host = u.hostname.toLowerCase();
      if (host.includes("api.telegram.org") || host.includes("t.me"))
        return null;
    } catch {}
    return { url: imageUrl }; // Return object format for external URLs
  }
  return null; // Invalid input
}

/**
 * NEW: Helper function to display a list of products (or a single product array).
 * This function iterates and sends messages for each product.
 * @param {import("telegraf").Context} ctx
 * @param {Product[]} products Array of Product objects to display.
 */
async function displayProductList(ctx, products) {
  const userIsAdmin = isAdmin(ctx);

  if (!products || !products.length) {
    return ctx.reply("No products to display.");
  }

  for (const p of products) {
    // Construct the product caption using Persian descriptions
    const statusText = p.available ? "✅ موجود" : "🚫 ناموجود";

    const caption =
      `📱 مدل: ${p.modelFull}\n` +
      `🏷 برند: ${p.brand || "-"}\n` +
      `🧱 جنس: ${p.material || "-"}\n` +
      `🎨 رنگ: ${p.color || "-"}\n` +
      `💰 قیمت: ${p.price.toLocaleString()} تومان`;

    const adminFooter = userIsAdmin ? `\n\nوضعیت: ${statusText}` : "";
    const finalCaption = caption + adminFooter;

    const inputPhoto = resolveInputPhoto(p.imageUrl);

    let reply_markup;
    if (userIsAdmin) {
      reply_markup = buildProductKeyboard(p);
    } else {
      reply_markup = {
        inline_keyboard: [
          [{ text: "➕ افزودن به سبد", callback_data: `addcart_${p.id}` }],
        ],
      };
    }

    try {
      if (!inputPhoto) throw new Error("no-photo");
      await ctx.replyWithPhoto(inputPhoto, {
        caption: finalCaption, // Using finalCaption (includes status/admin info)
        reply_markup,
      });
    } catch (e) {
      console.error("Photo sending failed, sending text only:", e);
      await ctx.reply(finalCaption, { reply_markup });
    }
  }
}

// ⬅️ Export the new display function
export { displayProductList };

/**
 * Helper function to fetch and display products to the user, with optional brand filtering.
 * It uses BRAND_MODEL_KEYWORDS to search based on the modelFull field.
 * @param {import("telegraf").Context} ctx
 * @param {string | null} brand The brand name to filter by, or null for all products.
 */
async function showProducts(ctx, brand = null) {
  const userIsAdmin = isAdmin(ctx); // Determine if the current user is an admin

  let whereClause = {};

  // ⬅️ NEW LOGIC: Construct WHERE clause based on modelFull and keywords
  if (brand && BRAND_MODEL_KEYWORDS[brand]) {
    const keywords = BRAND_MODEL_KEYWORDS[brand];

    // Use OR logic to check if modelFull contains ANY of the brand's keywords
    whereClause = {
      OR: keywords.map((keyword) => ({
        modelFull: {
          contains: keyword,
          mode: "insensitive", // Case-insensitive search
        },
      })),
    };
  }
  // If brand is null ('All'), whereClause remains {} and fetches all products.

  try {
    // Fetch products from the database, applying the modelFull-based filter.
    const products = await prisma.product.findMany({
      where: whereClause, // Applying the dynamic where clause
      orderBy: { createdAt: "desc" },
    });

    if (!products.length) {
      // Persian reply for no products found
      const reply = brand
        ? `فعلاً کالایی از برند **${brand}** موجود نیست.`
        : "فعلاً کالایی موجود نیست.";
      return ctx.replyWithMarkdown(reply);
    }

    // Loop through the fetched products and send messages using the dedicated function
    await displayProductList(ctx, products);
  } catch (err) {
    console.error("Error in showProducts:", err);
    await ctx.reply("خطایی در نمایش محصولات رخ داد."); // Persian error message
  }
}

export function registerProductsHandlers(bot) {
  // 1. Handler for the /products command: Asks the user to select a brand filter.
  bot.command("products", async (ctx) => {
    // Define the list of popular brands (or fetch them dynamically from DB)
    const brandOptions = [
      "Apple",
      "Samsung",
      "Xiaomi",
      "All", // Option to view all products
    ];

    // Map brand names to inline keyboard buttons
    const inlineKeyboard = brandOptions.map((brand) => {
      // Format callback_data as 'filter_BrandName'
      const data = brand === "All" ? "filter_all" : `filter_${brand}`;
      return { text: brand, callback_data: data };
    });

    const reply_markup = {
      inline_keyboard: [inlineKeyboard], // Display buttons in a single row
    };

    // Persian prompt to select the brand
    return ctx.reply(
      "لطفاً برند موبایل مورد نظر برای نمایش قاب‌ها را انتخاب کنید:",
      {
        reply_markup,
      }
    );
  });

  // 2. Handler for brand selection (Callback Query Action)
  // Matches any action starting with 'filter_' followed by letters (e.g., filter_Apple)
  bot.action(/filter_(apple|samsung|xiaomi|all)/i, async (ctx, next) => {
    try {
      const selectedBrand = ctx.match[1];
      const brand =
        selectedBrand.toLowerCase() === "all" ? null : selectedBrand;

      // Logic for editing markup
      try {
        await ctx.editMessageReplyMarkup({});
      } catch (e) {}

      const searchMessage =
        brand === null
          ? `🔍 در حال جستجوی **همه محصولات**...`
          : `🔍 در حال جستجوی محصولات برند **${selectedBrand}**...`;

      await ctx.reply(searchMessage, { parse_mode: "Markdown" });
      await showProducts(ctx, brand);

      return ctx.answerCbQuery();
    } catch (err) {
      console.error("Filter error:", err);
      return next();
    }
  });

  bot.on("callback_query", (ctx, next) => {
    return next();
  });
}
