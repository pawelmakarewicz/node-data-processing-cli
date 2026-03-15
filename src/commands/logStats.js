import { promises as fs, createReadStream } from "fs";
import { Worker } from "worker_threads";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedArgs = ["input", "output"];

export const logStats = async (rawArgs) => {
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

  const stats = await fs.stat(inputPath);
  const fileSize = stats.size;
  const numWorkers = os.cpus().length;

  const chunkSize = Math.ceil(fileSize / numWorkers);

  const chunks = [];
  let position = 0;

  while (position < fileSize) {
    let end = Math.min(position + chunkSize - 1, fileSize - 1);

    const stream = createReadStream(inputPath, {
      start: end,
      end: Math.min(end + 1000, fileSize - 1),
      encoding: "utf8",
    });

    let chunkData = "";
    for await (const data of stream) {
      chunkData += data;
    }

    const lastNewline = chunkData.lastIndexOf("\n");
    if (lastNewline !== -1) {
      end += lastNewline + 1;
    }

    chunks.push({ start: position, end });
    position = end + 1;
  }

  const workers = chunks.map((chunk) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, "../workers/logWorker.js"), {
        workerData: {
          chunkStart: chunk.start,
          chunkEnd: chunk.end,
          filePath: inputPath,
        },
      });

      worker.on("message", resolve);
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  });

  const results = await Promise.all(workers);

  const mergedStats = {
    levels: {},
    status: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
    pathCounts: {},
    totalLines: 0,
    responseTimeSum: 0,
  };

  for (const result of results) {
    mergedStats.totalLines += result.totalLines;
    mergedStats.responseTimeSum += result.responseTimeSum;

    for (const [level, count] of Object.entries(result.levels)) {
      mergedStats.levels[level] = (mergedStats.levels[level] || 0) + count;
    }

    for (const [statusClass, count] of Object.entries(result.status)) {
      mergedStats.status[statusClass] += count;
    }

    for (const [path, count] of Object.entries(result.pathCounts)) {
      mergedStats.pathCounts[path] = (mergedStats.pathCounts[path] || 0) + count;
    }
  }

  const avgResponseTimeMs =
    mergedStats.totalLines > 0
      ? mergedStats.responseTimeSum / mergedStats.totalLines
      : 0;

  const topPaths = Object.entries(mergedStats.pathCounts)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const finalStats = {
    total: mergedStats.totalLines,
    levels: mergedStats.levels,
    status: mergedStats.status,
    topPaths,
    avgResponseTimeMs: Math.round(avgResponseTimeMs * 100) / 100,
  };

  await fs.writeFile(
    outputPath,
    JSON.stringify(finalStats, null, 2),
    "utf8"
  );

  console.log(`Log statistics saved to: ${outputPath}`);
};
