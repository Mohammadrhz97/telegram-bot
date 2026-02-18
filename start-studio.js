import { exec } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const command = `npx prisma studio --port 5555 --hostname 127.0.0.1`;

const child = exec(command, { cwd: process.cwd(), env: process.env });

child.stdout.on("data", (data) => console.log(data.toString()));
child.stderr.on("data", (data) => console.error(data.toString()));

child.on("exit", (code) =>
  console.log(`Prisma Studio exited with code ${code}`),
);
