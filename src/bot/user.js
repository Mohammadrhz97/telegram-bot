// src/bot/user.js
// Clean user persistence — no messages, no conflicts

import { prisma } from "../db.js";

export function registerUserHandlers(bot) {
  // /start just upserts user — reply is handled in search.js
  bot.start(async (ctx, next) => {
    const { id, first_name, last_name, username } = ctx.from;
    const telegramId = id.toString();
    const fullName =
      [first_name, last_name].filter(Boolean).join(" ") || username || "";

    try {
      await prisma.user.upsert({
        where: { telegramId },
        update: { fullName },
        create: { telegramId, fullName },
      });
    } catch (err) {
      console.error("User upsert error:", err);
    }

    return next();
  });
}
