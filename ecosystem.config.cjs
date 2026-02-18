module.exports = {
  apps: [
    {
      name: "prisma-studio",
      script: "./start-studio.js",
      interpreter: "node",
      autorestart: true,
      watch: false,
    },
  ],
};
