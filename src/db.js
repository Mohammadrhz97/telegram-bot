import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

export const prisma = new PrismaClient({
  accelerateUrl: process.env.PRISMA_ACCELERATE_URL,
}).$extends(withAccelerate());
