import fs from "fs/promises";
import path from "path";
import { pathResolver } from "./utils/pathResolver.js";


export const up = (currentPath) => {
  if (currentPath === path.parse(currentPath).root) return currentPath;
  return path.resolve(currentPath, "..");
};

export const cd = async (currentPath, newPath) => {
  if (!newPath) throw new Error("Path argument is required");

  const resolvedPath = path.resolve(currentPath, newPath);

  try {
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) throw new Error(`${resolvedPath} is not a directory`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Path does not exist: ${resolvedPath}`);
    }
    throw error;
  }

  return resolvedPath;
};

const ls = async (currentPath) => {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  return entries
    .map(
      (entry) => `${entry.name} [${entry.isDirectory() ? "folder" : "file"}]`,
    )
    .join("\n");
};

export const navigation = () => {
  const showPath = () => console.log(pathResolver.get());

  return {
    up: () => {
      pathResolver.set(up(pathResolver.get()));
      showPath();
    },

    cd: async (newPath) => {
      pathResolver.set(await cd(pathResolver.get(), newPath));
      showPath();
    },

    ls: async () => {
      console.log(await ls(pathResolver.get()));
    },
  };
};
