import { Transform } from "stream";
import { createReadStream, createWriteStream, promises as fs } from "fs";
import { pipeline } from "stream/promises";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const argDefinitions = {
  input: { required: true },
  output: { required: true }
};

const escapeCSV = (val) => {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
};

const createJsonToCsvTransform = () => {
  let headersWritten = false;
  let headers = [];
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let buffer = "";

  const processBuffer = (transform, isFlush = false) => {
    let startIndex = buffer.indexOf("[");

    if (startIndex === -1 && !isFlush) {
      return;
    }

    if (startIndex !== -1) {
      buffer = buffer.substring(startIndex + 1);
    }

    let i = 0;
    while (i < buffer.length) {
      const char = buffer[i];

      if (escapeNext) {
        escapeNext = false;
        i++;
        continue;
      }

      if (char === "\\") {
        escapeNext = true;
        i++;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        i++;
        continue;
      }

      if (!inString) {
        if (char === "{") {
          braceCount++;
          i++;
          continue;
        }

        if (char === "}") {
          braceCount--;

          if (braceCount === 0) {
            let objectEnd = i + 1;
            let objectStr = buffer.substring(0, objectEnd);

            try {
              const obj = JSON.parse(objectStr);

              if (!headersWritten) {
                headers = Object.keys(obj);
                transform.push(headers.map(escapeCSV).join(",") + "\n");
                headersWritten = true;
              }

              const row = headers.map((header) => {
                const value = obj[header];
                if (value === undefined || value === null) return "";
                if (typeof value === "object") return escapeCSV(JSON.stringify(value));
                return escapeCSV(String(value));
              }).join(",");
              transform.push(row + "\n");

              buffer = buffer.substring(objectEnd).trim();
              i = 0;
              continue;
            } catch (e) {
              // Invalid JSON, continue
            }
          }

          i++;
          continue;
        }

        if (char === "," && braceCount === 0) {
          i++;
          continue;
        }

        if (char === "]" && braceCount === 0) {
          return;
        }
      }

      i++;
    }
  };

  return new Transform({
    objectMode: false,

    transform(chunk, encoding, callback) {
      buffer += chunk.toString();
      processBuffer(this);
      callback();
    },

    flush(callback) {
      processBuffer(this, true);
      callback();
    },
  });
};

export const jsonToCsv = async (rawArgs) => {
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
      createJsonToCsvTransform(),
      createWriteStream(outputPath)
    );
  } catch (error) {
    throw new Error(`Failed to convert JSON to CSV: ${error.message}`);
  }

  console.log(`JSON successfully converted to CSV: ${outputPath}`);
};
