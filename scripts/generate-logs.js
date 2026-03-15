import { createWriteStream } from "fs";
import { parseArgs } from "util";

const args = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: "string" },
    lines: { type: "string" },
  },
});

const output = args.values.output || "logs.txt";
const lines = parseInt(args.values.lines || "500000", 10);

const levels = ["INFO", "WARN", "ERROR"];
const services = ["user-service", "order-service", "payment-service", "auth-service"];
const methods = ["GET", "POST", "PUT", "DELETE"];
const paths = [
  "/api/users",
  "/api/orders",
  "/api/payments",
  "/api/auth/login",
  "/api/auth/register",
  "/api/products",
  "/api/cart",
  "/api/checkout",
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate() {
  const now = new Date();
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const randomTime = past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(randomTime).toISOString();
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const fileStream = createWriteStream(output);

for (let i = 0; i < lines; i++) {
  const timestamp = randomDate();
  const level = randomItem(levels);
  const service = randomItem(services);
  const statusCode = level === "ERROR" ? randomInt(400, 599) : randomInt(200, 399);
  const responseTime = randomInt(10, 500);
  const method = randomItem(methods);
  const path = randomItem(paths);

  fileStream.write(
    `${timestamp} ${level} ${service} ${statusCode} ${responseTime} ${method} ${path}\n`
  );

  if (i % 10000 === 0) {
    process.stdout.write(`\rGenerated ${i} lines...`);
  }
}

fileStream.end();

fileStream.on("finish", () => {
  console.log(`\nGenerated ${lines} log lines to ${output}`);
});
