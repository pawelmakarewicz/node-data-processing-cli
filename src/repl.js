import readline from "readline";
import { navigation } from "./navigation.js";
import { pathResolver } from "./utils/pathResolver.js";
import { hash } from "./commands/hash.js";

const exit = () => {
  console.log("Goodbye!");
  process.exit(0);
};

export const repl = () => {
  const { up, cd, ls } = navigation();

  const commands = {
    up: () => up(),
    cd: async ([dir]) => await cd(dir),
    ls: async () => await ls(),
    hash: (args) => hash(args),
    exit: () => exit(),
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  console.log("Welcome to the Node Data Processing CLI!");
  console.log(`You are currently in ${pathResolver.get()}`);

  rl.prompt();

  rl.on("line", async (line) => {
    const [command, ...args] = line.trim().split(" ");
    const handler = commands[command];

    if (handler) {
        try {
        await handler(args)
      } catch (e){
        console.log(`Operation failed:\n${e.message} `)
      }
      } else {
        console.log("Unknown command");
      }
      


    rl.prompt();
  });

  rl.on("close", exit);
};