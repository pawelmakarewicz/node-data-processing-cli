import { homedir } from "os";

class PathResolver {
  #currentPath = homedir();

  get() { return this.#currentPath; }

  set(newPath) { this.#currentPath = newPath; }
}

export const pathResolver = new PathResolver();
