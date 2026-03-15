import { createReadStream, createWriteStream, promises as fs } from "fs";
import { createCipheriv, scryptSync, randomBytes } from "crypto";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const allowedArgs = ["input", "output", "password"];
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HEADER_LENGTH = SALT_LENGTH + IV_LENGTH;

export const encrypt = async (rawArgs) => {
  const args = argParser({ args: rawArgs, allowedArgs });

  if (!args.input) {
    throw new Error("--input argument is required");
  }

  if (!args.output) {
    throw new Error("--output argument is required");
  }

  if (!args.password) {
    throw new Error("--password argument is required");
  }

  const currentPath = pathResolver.get();
  const inputPath = path.resolve(currentPath, args.input);
  const outputPath = path.resolve(currentPath, args.output);

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const readFile = createReadStream(inputPath);

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const key = scryptSync(args.password, salt, 32);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const writeFile = createWriteStream(outputPath);

  writeFile.write(salt);
  writeFile.write(iv);

  for await (const chunk of readFile) {
    const encrypted = cipher.update(chunk);
    if (encrypted) {
      writeFile.write(encrypted);
    }
  }

  const final = cipher.final();
  if (final) {
    writeFile.write(final);
  }

  const authTag = cipher.getAuthTag();
  writeFile.write(authTag);
  writeFile.end();

  await new Promise((resolve, reject) => {
    writeFile.on("finish", resolve);
    writeFile.on("error", reject);
  });

  console.log(`File encrypted successfully: ${outputPath}`);
};
