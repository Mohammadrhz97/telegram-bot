// prisma/seed.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🗑️ Deleting all products...");

  const result = await prisma.product.deleteMany({});

  console.log(`✔️ Deleted ${result.count} products.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error deleting products:", err);
    process.exit(1);
  });
