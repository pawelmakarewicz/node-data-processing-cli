import { createReadStream, createWriteStream, promises as fs } from "fs";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const allowedArgs = ["input", "output"];

export const jsonToCsv = async (rawArgs) => {
  const args = argParser({ args: rawArgs, allowedArgs });

  if (!args.input) {
    throw new Error("--input argument is required");
  }

  if (!args.output) {
    throw new Error("--output argument is required");
  }

  const currentPath = pathResolver.get();
  const inputPath = path.resolve(currentPath, args.input);
  const outputPath = path.resolve(currentPath, args.output);

  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const readFile = createReadStream(inputPath, { encoding: "utf8" });

  let data = "";
  for await (const chunk of readFile) {
    data += chunk;
  }

  let jsonArray;
  try {
    jsonArray = JSON.parse(data);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  if (!Array.isArray(jsonArray)) {
    throw new Error("Input JSON must be an array of objects");
  }

  const headers = Object.keys(jsonArray[0] || {});

  const writeFile = createWriteStream(outputPath);

  const csvContent =
    headers.join(",") +
    "\n" +
    jsonArray
      .map((obj) =>
        headers.map((header) => obj[header] ?? "").join(",")
      )
      .join("\n") +
    "\n";

  writeFile.write(csvContent);
  writeFile.end();

  await new Promise((resolve, reject) => {
    writeFile.on("finish", resolve);
    writeFile.on("error", reject);
  });

  console.log(`JSON successfully converted to CSV: ${outputPath}`);
};
