import { prisma } from "../db.js";
import { userCheckoutState } from "./state.js";
import { getCart, clearCart } from "./cart.js";

const ADMIN_IDS =
  process.env.TELEGRAM_ADMIN_IDS?.split(",").map((id) => id.trim()) || [];

async function getOrCreateUser(telegramId) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }
  return user;
}

export function registerCheckoutHandlers(bot) {
  bot.command("checkout", async (ctx) => {
    const telegramId = ctx.from.id.toString();

    userCheckoutState.delete(telegramId);

    const cart = await getCart(telegramId);
    if (!cart || !cart.length) {
      return ctx.reply("🛒 Your cart is empty.");
    }

    userCheckoutState.set(telegramId, {
      step: "city",
      tempData: {},
    });

    await ctx.reply("🏙 Please enter your city:");
  });

  bot.on("text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return next();

    const telegramId = ctx.from.id.toString();
    const state = userCheckoutState.get(telegramId);
    if (!state) return next();

    try {
      if (state.step === "city") {
        state.tempData.city = ctx.message.text;
        state.step = "address";
        return ctx.reply("📦 Please enter your exact address:");
      }

      if (state.step === "address") {
        state.tempData.address = ctx.message.text;
        state.step = "phone";
        return ctx.reply("📞 Please enter your phone number:");
      }

      if (state.step === "phone") {
        state.tempData.phone = ctx.message.text;
        await ctx.reply("⏳ Processing your order...");

        const user = await getOrCreateUser(telegramId);
        const cart = await getCart(telegramId);

        const total = cart.reduce((sum, item) => {
          return sum + (item.product?.price || 0) * item.qty;
        }, 0);

        const order = await prisma.order.create({
          data: {
            userId: user.id,
            totalPrice: total,
            status: "awaiting_payment",
            address: `${state.tempData.city} - ${state.tempData.address}`,
            phone: state.tempData.phone,
            items: {
              create: cart.map((item) => ({
                productId: item.productId,
                qty: item.qty,
                price: item.product?.price || 0,
              })),
            },
          },
        });

        await clearCart(telegramId);

        await ctx.reply(
          `✅ Order registered!\n\n📦 Order ID: ${order.id}\n💰 Total Amount: ${total.toLocaleString()}`,
        );

        userCheckoutState.set(telegramId, {
          step: "awaiting_payment",
          orderId: order.id,
        });

        await ctx.reply("💳 Please upload your payment receipt:");

        const adminMsg = `🆕 New Order #${order.id}\n👤 User: ${telegramId}\n📞 Phone: ${state.tempData.phone}\n💰 Total: ${total.toLocaleString()}`;
        for (const adminId of ADMIN_IDS) {
          try {
            await ctx.telegram.sendMessage(adminId, adminMsg);
          } catch {}
        }
      }
    } catch (err) {
      console.error("Checkout process error:", err);
      await ctx.reply("❌ Error registering the order.");
      userCheckoutState.delete(telegramId);
    }
  });

  bot.on("photo", async (ctx, next) => {
    const telegramId = ctx.from.id.toString();
    const state = userCheckoutState.get(telegramId);

    if (!state || state.step !== "awaiting_payment") return next();

    try {
      const fileId = ctx.message.photo.pop().file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      await prisma.order.update({
        where: { id: state.orderId },
        data: {
          paymentUrl: fileLink.href,
          status: "awaiting_admin_confirmation",
        },
      });

      userCheckoutState.set(telegramId, {
        step: "completed",
        orderId: state.orderId,
      });

      await ctx.reply(
        "✅ Payment receipt received.\n" + "⏳ Waiting for admin confirmation.",
      );

      for (const adminId of ADMIN_IDS) {
        try {
          await ctx.telegram.sendPhoto(adminId, fileId, {
            caption: `🧾 Receipt for order #${state.orderId}`,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Confirm",
                    callback_data: `confirm_${state.orderId}`,
                  },
                  {
                    text: "❌ Reject",
                    callback_data: `reject_${state.orderId}`,
                  },
                ],
              ],
            },
          });
        } catch {}
      }
    } catch (err) {
      console.error("Payment photo upload error:", err);
      await ctx.reply("❌ Error uploading receipt.");
    }
  });
}
