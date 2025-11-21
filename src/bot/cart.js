// src/bot/cart.js
import { prisma } from "../db.js";

/**
 * Add product to user's cart
 */
export async function addToCart(telegramId, productId, qty = 1) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) throw new Error("User not found");

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
    include: { orders: true },
  });

  if (!user) return [];

  return await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: { product: true },
  });
}

/**
 * Clear user cart (after order is placed)
 */
export async function clearCart(telegramId) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return;
  await prisma.cartItem.deleteMany({ where: { userId: user.id } });
}

/**
 * Increment/decrement a cart item quantity by item id for the given telegram user.
 * If the resulting quantity <= 0, the item is removed.
 * Returns the updated CartItem (with product) or null if deleted/not found.
 */
export async function updateCartItemQty(telegramId, cartItemId, delta) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return null;

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

  const updated = await prisma.cartItem.update({
    where: { id: item.id },
    data: { qty: newQty },
    include: { product: true },
  });
  return updated;
}

/**
 * Delete a cart item by id for the given telegram user.
 * Returns true if deleted, false otherwise.
 */
export async function deleteCartItem(telegramId, cartItemId) {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) return false;

  const item = await prisma.cartItem.findFirst({
    where: { id: cartItemId, userId: user.id },
  });
  if (!item) return false;

  await prisma.cartItem.delete({ where: { id: item.id } });
  return true;
}
