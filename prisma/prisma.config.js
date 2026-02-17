import { PrismaClient } from "@prisma/client";

export default {
  client: {
    adapter: {
      url: process.env.DATABASE_URL,
    },
    log: ["query", "info", "warn", "error"],
  },
};
