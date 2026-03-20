import { createReadStream } from "fs";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const argDefinitions = {
  input: { required: true }
};

export const count = async (rawArgs) => {
  const args = argParser({ args: rawArgs, argDefinitions });

  const currentPath = pathResolver.get();
  const inputPath = path.resolve(currentPath, args.input);

  const readFile = createReadStream(inputPath, { encoding: "utf8" });

  let lines = 0;
  let words = 0;
  let characters = 0;
  let lastChunkEndedWithNewline = false;
  let trailingWord = "";

  for await (const chunk of readFile) {
    characters += chunk.length;

    const chunkLines = chunk.split("\n");
    lines += chunkLines.length - 1;
    lastChunkEndedWithNewline = chunk.endsWith("\n");

    const combined = trailingWord + chunk;
    const tokens = combined.split(/\s+/).filter((word) => word.length > 0);

    if (tokens.length > 0 && !/\s$/.test(combined)) {
      trailingWord = tokens.pop();
    } else {
      trailingWord = "";
    }

    words += tokens.length;
  }

  if (trailingWord) {
    words += 1;
  }

  if (!lastChunkEndedWithNewline && characters > 0) {
    lines += 1;
  }

  console.log(`Lines: ${lines}`);
  console.log(`Words: ${words}`);
  console.log(`Characters: ${characters}`);
};
