import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  accelerateUrl: process.env.PRISMA_ACCELERATE_URL,
  log: ["query", "info", "warn", "error"],
});
