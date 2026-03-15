export const argParser = ({ args, allowedArgs, booleanArgs = [] }) => {
  return args.reduce((acc, token, i) => {
    if (token.startsWith("--")) {
      const name = token.slice(2);
      if (!allowedArgs.includes(name)) {
        throw new Error(`Unknown argument: ${name}`);
      }
      if (booleanArgs.includes(name)) {
        acc[name] = true;
      } else {
        const value = args[i + 1];
        if (!value || value.startsWith("--")) {
          throw new Error(`Missing value for --${name}`);
        }
        acc[name] = value;
      }
    }
    return acc;
  }, {});
};