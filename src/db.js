import { PrismaClient } from "@prisma/client";
import { config } from "../prisma.config";

export const prisma = new PrismaClient(config.client);
