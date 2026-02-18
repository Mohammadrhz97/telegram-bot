module.exports = {
  apps: [
    {
      name: "prisma-studio",
      script: "./start-studio.js",
      interpreter: "node", // ← important
      interpreter_args: "--loader ts-node/esm", // only if you need ESM/TypeScript support
      autorestart: true,
      watch: false,
    },
  ],
};
