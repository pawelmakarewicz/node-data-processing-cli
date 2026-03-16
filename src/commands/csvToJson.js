import { createReadStream, createWriteStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import { Transform } from "stream";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const argDefinitions = {
  input: { required: true },
  output: { required: true }
};

export const csvToJson = async (rawArgs) => {
  const args = argParser({ args: rawArgs, argDefinitions });

  const currentPath = pathResolver.get();
  const inputPath = path.resolve(currentPath, args.input);
  const outputPath = path.resolve(currentPath, args.output);

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const readFile = createReadStream(inputPath);
  const writeFile = createWriteStream(outputPath);

  let isFirstLine = true;
  let headers = [];
  let buffer = [];
  let remainder = "";

  const csvToJsonTransform = new Transform({
    objectMode: false,
    transform(chunk, encoding, callback) {
      const data = remainder + chunk.toString();
      const lines = data.split("\n");
      remainder = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        if (isFirstLine) {
          headers = line.split(",");
          isFirstLine = false;
          continue;
        }

        const values = line.split(",");
        const obj = {};

        headers.forEach((header, index) => {
          obj[header.trim()] = values[index]?.trim() || "";
        });

        buffer.push(JSON.stringify(obj));
      }

      callback();
    },
    flush(callback) {
      if (remainder.trim()) {
        if (isFirstLine) {
          headers = remainder.split(",");
        } else {
          const values = remainder.split(",");
          const obj = {};
          headers.forEach((header, index) => {
            obj[header.trim()] = values[index]?.trim() || "";
          });
          buffer.push(JSON.stringify(obj));
        }
      }

      if (buffer.length > 0) {
        const jsonArray = "[" + buffer.join(",") + "]\n";
        this.push(jsonArray);
      }
      callback();
    },
  });

  try {
    await pipeline(readFile, csvToJsonTransform, writeFile);
  } catch (error) {
    throw new Error(`Failed to convert CSV to JSON: ${error.message}`);
  }

  console.log(`CSV successfully converted to JSON: ${outputPath}`);
};
