export const argParser = ({ args, argDefinitions }) => {
  const parsedArgs = {};
  const argNames = Object.keys(argDefinitions);

  for (let i = 0; i < args.length; i++) {
    const token = args[i];

    if (!token.startsWith("--")) {
      continue;
    }

    const name = token.slice(2);

    if (!argDefinitions[name]) {
      throw new Error(`Unknown argument: --${name}`);
    }

    const definition = argDefinitions[name];
    const type = definition.type || "string";

    if (type === "boolean") {
      parsedArgs[name] = true;
    } else {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for --${name}`);
      }
      parsedArgs[name] = value;
      i++; // Skip the value token
    }
  }

  for (const [name, definition] of Object.entries(argDefinitions)) {
    if (definition.default !== undefined && parsedArgs[name] === undefined) {
      parsedArgs[name] = definition.default;
    }

    if (definition.required && parsedArgs[name] === undefined) {
      throw new Error(`--${name} argument is required`);
    }
  }

  return parsedArgs;
};
