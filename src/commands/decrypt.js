import { createReadStream, createWriteStream } from "fs";
import { createDecipheriv, scryptSync } from "crypto";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const allowedArgs = ["input", "output", "password"];
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HEADER_LENGTH = SALT_LENGTH + IV_LENGTH;

export const decrypt = async (rawArgs) => {
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

  const readFile = createReadStream(inputPath);

  let buffer = Buffer.alloc(0);

  for await (const chunk of readFile) {
    buffer = Buffer.concat([buffer, chunk]);
  }

  if (buffer.length < HEADER_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted file format");
  }

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, HEADER_LENGTH);
  const authTag = buffer.subarray(-AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(HEADER_LENGTH, -AUTH_TAG_LENGTH);

  const key = scryptSync(args.password, salt, 32);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted;

  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }

  const writeFile = createWriteStream(outputPath);
  writeFile.write(decrypted);
  writeFile.end();

  await new Promise((resolve, reject) => {
    writeFile.on("finish", resolve);
    writeFile.on("error", reject);
  });

  console.log(`File decrypted successfully: ${outputPath}`);
};
