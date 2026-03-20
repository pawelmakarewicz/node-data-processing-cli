import { Transform } from "stream";
import { createReadStream, createWriteStream } from "fs";
import { promises as fs } from "fs";
import { pipeline } from "stream/promises";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const argDefinitions = {
  input: { required: true },
  output: { required: true }
};

const createCsvToJsonTransform = () => {
  let isFirstLine = true;
  let isFirstObject = true;
  let headers = [];
  let remainder = "";

  return new Transform({
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
          this.push("[");
          continue;
        }

        const values = line.split(",").map(v => v.trim());
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = values[index]?.trim() || "";
        });

        this.push(isFirstObject ? "\n  " : ",\n  ");
        this.push(JSON.stringify(obj));
        isFirstObject = false;
      }

      callback();
    },

    flush(callback) {
      if (remainder.trim()) {
        if (isFirstLine) {
          this.push("[]");
        } else {
          const values = remainder.split(",");
          const obj = {};
          headers.forEach((header, index) => {
            obj[header.trim()] = values[index]?.trim() || "";
          });

          this.push(isFirstObject ? "\n  " : ",\n  ");
          this.push(JSON.stringify(obj));
        }
      }

      this.push("\n]\n");
      callback();
    },
  });
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

  try {
    await pipeline(
      createReadStream(inputPath),
      createCsvToJsonTransform(),
      createWriteStream(outputPath)
    );
  } catch (error) {
    throw new Error(`Failed to convert CSV to JSON: ${error.message}`);
  }

  console.log(`CSV successfully converted to JSON: ${outputPath}`);
};