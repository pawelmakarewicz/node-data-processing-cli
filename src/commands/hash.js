import { createHash } from "crypto";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const argDefinitions = {
  input: { required: true },
  algorithm: { default: "sha256" },
  save: { type: "boolean", default: false }
};
const supportedAlgorithms = ["sha256", "md5", "sha512"];

export const hash = async (rawArgs) => {
  const args = argParser({ args: rawArgs, argDefinitions });

  const algorithm = args.algorithm;

  if (!supportedAlgorithms.includes(algorithm)) {
    throw new Error(`Unsupported algorithm: ${algorithm}. Supported values: ${supportedAlgorithms.join(", ")}`);
  }

  const currentPath = pathResolver.get();
  const inputPath = path.resolve(currentPath, args.input);

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const hasher = createHash(algorithm);
  const stream = createReadStream(inputPath);

  await new Promise((resolve, reject) => {
    stream.pipe(hasher).on("finish", resolve).on("error", reject);
  });

  const digest = hasher.digest("hex");

  const output = `${algorithm}: ${digest}`;

  if (args.save) {
    const inputFilename = path.basename(inputPath);
    const savePath = path.join(path.dirname(inputPath), `${inputFilename}.${algorithm}`);

    await fs.writeFile(savePath, digest);
    console.log(`Hash saved to: ${savePath}`);
  } else {
    console.log(output);
  }
};
