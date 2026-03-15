class PathResolver {
  #currentPath = process.cwd();

  get() { return this.#currentPath; }

  set(newPath) { this.#currentPath = newPath; }
}

export const pathResolver = new PathResolver();
