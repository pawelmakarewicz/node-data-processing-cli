import { createHash } from "crypto";
import { createReadStream, promises as fs } from "fs";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const allowedArgs = ["input", "hash", "algorithm"];
const supportedAlgorithms = ["sha256", "md5", "sha512"];

const DEFAULT_ALGORITHM = "sha256";

export const hashCompare = async (rawArgs) => {
  const args = argParser({ args: rawArgs, allowedArgs });

  if (!args.input) {
    throw new Error("--input argument is required");
  }

  if (!args.hash) {
    throw new Error("--hash argument is required");
  }

  const algorithm = args.algorithm || DEFAULT_ALGORITHM;

  if (!supportedAlgorithms.includes(algorithm)) {
    throw new Error(
      `Unsupported algorithm: ${algorithm}. Supported values: ${supportedAlgorithms.join(
        ", "
      )}`
    );
  }

  const currentPath = pathResolver.get();
  const inputPath = path.resolve(currentPath, args.input);
  const hashPath = path.resolve(currentPath, args.hash);

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  try {
    await fs.access(hashPath);
  } catch {
    throw new Error(`Hash file does not exist: ${hashPath}`);
  }

  const hash = createHash(algorithm);
  const stream = createReadStream(inputPath);

  await new Promise((resolve, reject) => {
    stream.pipe(hash).on("finish", resolve).on("error", reject);
  });

  const digest = hash.digest("hex").toLowerCase();

  const expectedHash = await fs.readFile(hashPath, "utf-8");
  const expectedHashTrimmed = expectedHash.trim().toLowerCase();

  if (digest === expectedHashTrimmed) {
    console.log("OK");
  } else {
    console.log("MISMATCH");
  }
};
