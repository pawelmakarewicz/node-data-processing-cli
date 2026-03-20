import readline from "readline";
import { navigation } from "./navigation.js";
import { pathResolver } from "./utils/pathResolver.js";
import { hash } from "./commands/hash.js";
import { hashCompare } from "./commands/hashCompare.js";
import { csvToJson } from "./commands/csvToJson.js";
import { jsonToCsv } from "./commands/jsonToCsv.js";
import { count } from "./commands/count.js";
import { encrypt } from "./commands/encrypt.js";
import { decrypt } from "./commands/decrypt.js";
import { logStats } from "./commands/logStats.js";

let exiting = false;

const exit = () => {
  if (exiting) return;
  exiting = true;
  console.log("Thank you for using Data Processing CLI!");
  setTimeout(() => process.exit(0), 100);
};

export const repl = () => {
  const nav = navigation();

  const commands = {
    up: () => nav.up(),
    cd: async (args) => await nav.cd(args[0]),
    ls: async () => await nav.ls(),
    hash: (args) => hash(args),
    "hash-compare": (args) => hashCompare(args),
    "csv-to-json": (args) => csvToJson(args),
    "json-to-csv": (args) => jsonToCsv(args),
    count: (args) => count(args),
    encrypt: (args) => encrypt(args),
    decrypt: (args) => decrypt(args),
    "log-stats": (args) => logStats(args),
    exit: () => exit(),
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
    terminal: process.stdin.isTTY ?? false,
  });

  console.log("Welcome to Data Processing CLI!");
  console.log(`You are currently in ${pathResolver.get()}`);

  rl.prompt();

  rl.on("line", async (line) => {
    const trimmedLine = line.trim();

    if (trimmedLine === ".exit") {
      exit();
      return;
    }

    if (trimmedLine === "exit") {
      exit();
      return;
    }

    const parts = trimmedLine.split(/\s+/).filter(part => part.length > 0);

    if (parts.length === 0) {
      rl.prompt();
      return;
    }

    let command = null;
    let args = [];

    for (let i = Math.min(parts.length, 3); i >= 1; i--) {
      const potentialCommand = parts.slice(0, i).join("-");
      if (commands[potentialCommand]) {
        command = potentialCommand;
        args = parts.slice(i);
        break;
      }
    }

    const handler = commands[command];

    if (handler) {
      try {
        await handler(args);
      } catch (e) {
        console.log(`Operation failed:\n${e.message}`);
      }
    } else {
      console.log("Invalid input");
    }

    rl.prompt();
  });

  rl.on("close", exit);
};
