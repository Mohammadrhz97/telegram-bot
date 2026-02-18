module.exports = {
  apps: [
    {
      name: "prisma-studio",
      script: "npx",
      args: "prisma studio --port 5555 --hostname 127.0.0.1",
      env: {
        DATABASE_URL:
          "postgresql://telegram_bot:2016301112@localhost:5432/telegram_bot",
      },
    },
  ],
};
