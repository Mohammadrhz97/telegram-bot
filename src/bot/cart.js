/**
 * Add product to user's cart (با قابلیت ساخت یوزر در صورت نبودن)
 */
export async function addToCart(telegramId, productId, qty = 1) {
  // ۱. پیدا کردن یا ساختن یوزر
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }

  // ۲. حالا اضافه کردن محصول
  return await prisma.cartItem.create({
    data: {
      userId: user.id,
      productId,
      qty,
    },
  });
}

/**
 * Get all cart items for a user (بدون Error دادن اگر یوزر نبود)
 */
export async function getCart(telegramId) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

  // اگر یوزر نیست، یعنی سبدی هم ندارد
  if (!user) return [];

  return await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: { product: true },
  });
}
