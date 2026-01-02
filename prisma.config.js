const path = require("path");
const dotenv = require("dotenv");
const { defineConfig } = require("@prisma/config");

dotenv.config({ path: path.resolve(__dirname, ".env") });

module.exports = defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
