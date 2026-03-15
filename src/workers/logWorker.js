import { parentPort, workerData } from "worker_threads";
import { createReadStream } from "fs";

const processChunk = (chunk) => {
  const lines = chunk.toString().split("\n").filter((line) => line.trim());

  const stats = {
    levels: {},
    status: { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
    pathCounts: {},
    totalLines: 0,
    responseTimeSum: 0,
  };

  for (const line of lines) {
    const parts = line.trim().split(" ");

    if (parts.length < 7) continue;

    const [timestamp, level, service, statusCode, responseTime, method, path] =
      parts;

    if (!timestamp || !level || !service || !statusCode || !responseTime || !method || !path) {
      continue;
    }

    stats.totalLines++;

    const statusCodeNum = parseInt(statusCode, 10);
    const statusClass = Math.floor(statusCodeNum / 100) + "xx";
    if (stats.status[statusClass] !== undefined) {
      stats.status[statusClass]++;
    }

    if (!stats.levels[level]) {
      stats.levels[level] = 0;
    }
    stats.levels[level]++;

    if (!stats.pathCounts[path]) {
      stats.pathCounts[path] = 0;
    }
    stats.pathCounts[path]++;

    stats.responseTimeSum += parseInt(responseTime, 10);
  }

  return stats;
};

(async () => {
  const { chunkStart, chunkEnd, filePath } = workerData;

  const stream = createReadStream(filePath, {
    start: chunkStart,
    end: chunkEnd,
    encoding: "utf8",
  });

  let chunkData = "";

  for await (const data of stream) {
    chunkData += data;
  }

  const stats = processChunk(chunkData);

  parentPort.postMessage(stats);
})();
