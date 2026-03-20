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
  let inArray = false;
  let inString = false;
  let escapeNext = false;
  let buffer = "";

  const processBuffer = (transform, isFlush = false) => {
    if (!inArray) {
      const startIndex = buffer.indexOf("[");

      if (startIndex === -1 && !isFlush) {
        return;
      }

      if (startIndex !== -1) {
        buffer = buffer.substring(startIndex + 1);
        inArray = true;
      } else if (isFlush) {
        return;
      }
    }

    while (true) {
      let i = 0;
      let objectStart = -1;
      let currentBraceCount = 0;
      let currentInString = false;
      let currentEscapeNext = false;

      while (i < buffer.length) {
        const char = buffer[i];

        if (currentEscapeNext) {
          currentEscapeNext = false;
          i++;
          continue;
        }

        if (char === "\\") {
          currentEscapeNext = true;
          i++;
          continue;
        }

        if (char === '"') {
          currentInString = !currentInString;
          i++;
          continue;
        }

        if (!currentInString) {
          if (char === "{") {
            if (objectStart === -1) {
              objectStart = i;
            }
            currentBraceCount++;
            i++;
            continue;
          }

          if (char === "}") {
            currentBraceCount--;

            if (currentBraceCount === 0 && objectStart !== -1) {
              let objectEnd = i + 1;
              let objectStr = buffer.substring(objectStart, objectEnd);

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

                buffer = buffer.substring(objectEnd);

                break;
              } catch (e) {
                // Invalid JSON, try to continue
                i++;
                continue;
              }
            }

            i++;
            continue;
          }

          if (char === ",") {
            if (currentBraceCount === 0) {
              objectStart = -1;
            }
            i++;
            continue;
          }

          if (char === "]") {
            return;
          }

          if (char === " " || char === "\n" || char === "\r" || char === "\t") {
            i++;
            continue;
          }
        }

        i++;
      }

      if (objectStart === -1 || i === buffer.length) {
        break;
      }
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
