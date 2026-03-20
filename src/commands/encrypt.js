import { createReadStream, createWriteStream, promises as fs } from "fs";
import { createCipheriv, scryptSync, randomBytes } from "crypto";
import { pipeline } from "stream/promises";
import { Transform } from "stream";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const argDefinitions = {
  input: { required: true },
  output: { required: true },
  password: { required: true }
};

const SALT_LENGTH = 16;
const IV_LENGTH = 12;

export const encrypt = async (rawArgs) => {
  const args = argParser({ args: rawArgs, argDefinitions });

  const currentPath = pathResolver.get();
  const inputPath = path.resolve(currentPath, args.input);
  const outputPath = path.resolve(currentPath, args.output);

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = scryptSync(args.password, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const appendAuthTag = new Transform({
    transform(chunk, encoding, callback) {
      callback(null, chunk);
    },
    flush(callback) {
      callback(null, cipher.getAuthTag());
    }
  });

  const writeStream = createWriteStream(outputPath);
  writeStream.write(salt);
  writeStream.write(iv);

  await pipeline(
    createReadStream(inputPath),
    cipher,
    appendAuthTag,
    writeStream
  );

  console.log(`File encrypted successfully: ${outputPath}`);
};