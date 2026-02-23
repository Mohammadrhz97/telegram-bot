import { prisma } from "../db.js";

/**
 * Internal Helper: Finds a user by Telegram ID or creates a new one
 * This prevents the bot from crashing when a new user interacts with the cart.
 */
async function getOrCreateUser(telegramId) {
  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId } });
  }
  return user;
}

/**
 * Add product to user's cart
 */
export async function addToCart(telegramId, productId, qty = 1) {
  const user = await getOrCreateUser(telegramId);

  return await prisma.cartItem.create({
    data: {
      userId: user.id,
      productId,
      qty,
    },
  });
}

/**
 * Get all cart items for a user
 */
export async function getCart(telegramId) {
  const user = await prisma.user.findUnique({
    where: { telegramId },
  });

  // If user doesn't exist, they have no cart items
  if (!user) return [];

  return await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: { product: true },
  });
}

/**
 * Clear user cart (Deletes all items for the user)
 */
export async function clearCart(telegramId) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return;
  await prisma.cartItem.deleteMany({ where: { userId: user.id } });
}

/**
 * Increment/decrement a cart item quantity
 */
export async function updateCartItemQty(telegramId, cartItemId, delta) {
  const user = await getOrCreateUser(telegramId);

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, userId: user.id },
    include: { product: true },
  });
  if (!item) return null;

  const newQty = (item.qty || 0) + delta;
  if (newQty <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return null;
  }

  return await prisma.cartItem.update({
    where: { id: item.id },
    data: { qty: newQty },
    include: { product: true },
  });
}

/**
 * Delete a specific cart item
 */
export async function deleteCartItem(telegramId, cartItemId) {
  const user = await getOrCreateUser(telegramId);

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, userId: user.id },
  });
  if (!item) return false;

  await prisma.cartItem.delete({ where: { id: item.id } });
  return true;
}
