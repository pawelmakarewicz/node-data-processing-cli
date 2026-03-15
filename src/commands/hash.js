import { createHash } from "crypto";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";

const allowedArgs = ["input", "algorithm", "save"];
const booleanArgs = ["save"];
const supportedAlgorithms = ["sha256", "md5", "sha512"];

const DEFAULT_ALGORITHM = "sha256";

export const hash = async (rawArgs) => {
  const args = argParser({ args: rawArgs, allowedArgs, booleanArgs });

  if (!args.input) {
    throw new Error("--input argument is required");
  }

  const algorithm = args.algorithm || DEFAULT_ALGORITHM;

  if (!supportedAlgorithms.includes(algorithm)) {
    throw new Error(`Unsupported algorithm: ${algorithm}. Supported values: ${supportedAlgorithms.join(", ")}`);
  }

  const currentPath = pathResolver.get();
  const inputPath = require("path").resolve(currentPath, args.input);

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const hash = createHash(algorithm);
  const stream = createReadStream(inputPath);

  await new Promise((resolve, reject) => {
    stream.pipe(hash).on("finish", resolve).on("error", reject);
  });

  const digest = hash.digest("hex");

  const output = `${algorithm}: ${digest}`;

  if (args.save) {
    const inputFilename = require("path").basename(inputPath);
    const savePath = require("path").join(require("path").dirname(inputPath), `${inputFilename}.${algorithm}`);

    await fs.writeFile(savePath, digest);
    console.log(`Hash saved to: ${savePath}`);
  } else {
    console.log(output);
  }
};
