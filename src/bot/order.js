import { prisma } from "../db.js";
import { getCart, clearCart } from "./cart.js";

export async function createOrder(telegramId, userInfo, notifyAdmin) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) throw new Error("User not found");

  const cart = await getCart(telegramId);
  if (!cart || cart.length === 0) throw new Error("Cart is empty");

  const totalPrice = cart.reduce(
    (sum, item) => sum + item.product.price * item.qty,
    0
  );

  // سفارش جدید + آیتم‌ها
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      totalPrice,
      address: userInfo.address,
      city: userInfo.city,
      phone: userInfo.phone,
      items: {
        create: cart.map((item) => ({
          productId: item.product.id,
          qty: item.qty,
          price: item.product.price,
        })),
      },
    },
    include: {
      items: { include: { product: true } }, // تا جزئیات محصول رو هم برگردونه
      user: true,
    },
  });

  await clearCart(telegramId);

  // 📣 اگر notifyAdmin داده شده باشه، پیام بفرست براش
  if (notifyAdmin) {
    let message = `📦 سفارش جدید ثبت شد!\n\n`;
    message += `👤 مشتری: ${order.user.fullName || "-"}\n`;
    message += `🏙️ شهر: ${order.city || "-"}\n`;
    message += `📞 تماس: ${order.phone || "-"}\n`;
    message += `🏠 آدرس: ${order.address || "-"}\n\n`;

    message += `🧾 محصولات:\n`;
    order.items.forEach((it) => {
      message += `- ${it.product.brand || ""} ${it.product.model} (${
        it.product.color || ""
      }) × ${it.qty}\n`;
    });

    message += `\n💰 مبلغ کل: ${order.totalPrice.toLocaleString()} تومان`;

    await notifyAdmin(message);
  }

  return order;
}

// List all orders for a user (by telegramId)
export async function getUserOrders(telegramId) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return [];
  return prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}
