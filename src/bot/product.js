// ==========================
// src/bot/product.js
// Database service for products (CRUD operations)
// ==========================

import { prisma } from "../db.js";

/**
 * 🧩 Get all products (for /products command)
 */
export async function getAllProducts() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });
    return products;
  } catch (err) {
    console.error("❌ getAllProducts error:", err);
    return [];
  }
}

/**
 * 🔍 Get a product by its ID
 */
export async function getProductById(id) {
  try {
    const product = await prisma.product.findUnique({
      where: { id },
    });
    return product;
  } catch (err) {
    console.error("❌ getProductById error:", err);
    return null;
  }
}

/**
 * ➕ Add a new product (for admin panel, future feature)
 */
export async function addProduct(data) {
  try {
    const product = await prisma.product.create({ data });
    return product;
  } catch (err) {
    console.error("❌ addProduct error:", err);
    throw err;
  }
}

/**
 * 🗑 Delete a product (for admin panel, future feature)
 */
export async function deleteProduct(id) {
  try {
    await prisma.product.delete({ where: { id } });
    return true;
  } catch (err) {
    console.error("❌ deleteProduct error:", err);
    return false;
  }
}
