// prisma/seed.js
// Populate the database with demo products, users, and orders for /admin tests.

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const productSeeds = [
  {
    model: "iphone-14",
    brand: "Apple",
    material: "سیلیکونی",
    color: "مشکی",
    price: 690000,
    imageUrl: "https://placehold.co/600x400?text=iPhone+14",
  },
  {
    model: "iphone-13",
    brand: "Apple",
    material: "چرم مصنوعی",
    color: "قهوه‌ای",
    price: 520000,
    imageUrl: "https://placehold.co/600x400?text=iPhone+13",
  },
  {
    model: "s24-ultra",
    brand: "Samsung",
    material: "سیلیکونی",
    color: "سبز",
    price: 640000,
    imageUrl: "https://placehold.co/600x400?text=Galaxy+S24U",
  },
  {
    model: "a54",
    brand: "Samsung",
    material: "تکه‌دوزی",
    color: "بنفش",
    price: 410000,
    imageUrl: "https://placehold.co/600x400?text=Galaxy+A54",
  },
];

const userSeeds = [
  {
    telegramId: "9001",
    fullName: "علی رضایی",
    phone: "09120000001",
    city: "تهران",
    address: "تهران، خیابان ولیعصر، کوچه یاس ۱۲",
  },
  {
    telegramId: "9002",
    fullName: "مریم احمدی",
    phone: "09120000002",
    city: "اصفهان",
    address: "اصفهان، خیابان چهارباغ، پلاک ۴۲",
  },
  {
    telegramId: "9003",
    fullName: "حسین فرهادی",
    phone: "09120000003",
    city: "مشهد",
    address: "مشهد، بلوار سجاد، کوچه بهار ۵",
  },
];

const orderSeeds = [
  {
    userTelegramId: "9001",
    status: "pending",
    paymentUrl: "https://placehold.co/600x400?text=Receipt+101",
    items: [
      { model: "iphone-14", qty: 1 },
      { model: "s24-ultra", qty: 1 },
    ],
  },
  {
    userTelegramId: "9002",
    status: "confirmed",
    paymentUrl: "https://placehold.co/600x400?text=Receipt+102",
    items: [
      { model: "iphone-13", qty: 2 },
      { model: "a54", qty: 1 },
    ],
  },
  {
    userTelegramId: "9003",
    status: "shipped",
    paymentUrl: null,
    items: [{ model: "s24-ultra", qty: 2 }],
  },
];

async function clearExistingData() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

async function seed() {
  await clearExistingData();

  const createdProducts = [];
  for (const data of productSeeds) {
    const product = await prisma.product.create({
      data: { ...data, embedding: [], telegramFileId: null },
    });
    createdProducts.push(product);
  }
  const productMap = Object.fromEntries(createdProducts.map((p) => [p.model, p]));

  const createdUsers = [];
  for (const data of userSeeds) {
    const user = await prisma.user.create({ data });
    createdUsers.push(user);
  }
  const userMap = Object.fromEntries(createdUsers.map((u) => [u.telegramId, u]));

  for (const orderSeed of orderSeeds) {
    const user = userMap[orderSeed.userTelegramId];
    if (!user) continue;

    const itemPayloads = orderSeed.items
      .map(({ model, qty }) => {
        const product = productMap[model];
        if (!product) return null;
        return {
          productId: product.id,
          qty,
          price: product.price,
        };
      })
      .filter(Boolean);

    if (!itemPayloads.length) continue;

    const totalPrice = itemPayloads.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    await prisma.order.create({
      data: {
        userId: user.id,
        totalPrice,
        status: orderSeed.status,
        paymentUrl: orderSeed.paymentUrl,
        address: user.address,
        city: user.city,
        phone: user.phone,
        items: {
          create: itemPayloads,
        },
      },
    });
  }
}

seed()
  .then(() => {
    console.log("✅ Seed data inserted successfully.");
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
