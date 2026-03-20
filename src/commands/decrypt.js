import { createReadStream, createWriteStream } from "fs";
import { createDecipheriv, scryptSync } from "crypto";
import { pipeline, Transform } from "stream";
import { promisify } from "util";
import { argParser } from "../utils/argParser.js";
import { pathResolver } from "../utils/pathResolver.js";
import path from "path";

const pipelineAsync = promisify(pipeline);

const argDefinitions = {
  input: { required: true },
  output: { required: true },
  password: { required: true }
};

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HEADER_LENGTH = SALT_LENGTH + IV_LENGTH;

class DecryptTransform extends Transform {
  constructor(password) {
    super();
    this.password = password;
    this.headerBuf = Buffer.alloc(0);
    this.headerParsed = false;
    this.chunks = [];
    this.decipher = null;
  }

  _transform(chunk, _encoding, callback) {
    try {
      if (!this.headerParsed) {
        this.headerBuf = Buffer.concat([this.headerBuf, chunk]);

        if (this.headerBuf.length < HEADER_LENGTH) {
          return callback(); // ждём ещё
        }

        const salt = this.headerBuf.subarray(0, SALT_LENGTH);
        const iv   = this.headerBuf.subarray(SALT_LENGTH, HEADER_LENGTH);
        const key  = scryptSync(this.password, salt, 32);

        this.decipher = createDecipheriv("aes-256-gcm", key, iv);
        this.headerParsed = true;

        const rest = this.headerBuf.subarray(HEADER_LENGTH);
        if (rest.length > 0) this.chunks.push(rest);

        return callback();
      }
      this.chunks.push(chunk);
      callback();
    } catch (err) {
      callback(err);
    }
  }

  _flush(callback) {
    try {
      const all = Buffer.concat(this.chunks);

      if (all.length < AUTH_TAG_LENGTH) {
        return callback(new Error("Invalid encrypted file format"));
      }

      const authTag    = all.subarray(-AUTH_TAG_LENGTH);
      const ciphertext = all.subarray(0, -AUTH_TAG_LENGTH);

      this.decipher.setAuthTag(authTag);

      let decrypted;
      try {
        decrypted = Buffer.concat([
          this.decipher.update(ciphertext),
          this.decipher.final()
        ]);
      } catch (err) {
        return callback(new Error(`Authentication failed: ${err.message}`));
      }

      this.push(decrypted);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

export const decrypt = async (rawArgs) => {
  const args = argParser({ args: rawArgs, argDefinitions });
  const currentPath = pathResolver.get();
  const inputPath  = path.resolve(currentPath, args.input);
  const outputPath = path.resolve(currentPath, args.output);

  await pipelineAsync(
    createReadStream(inputPath),
    new DecryptTransform(args.password),
    createWriteStream(outputPath)
  );

  console.log(`File decrypted successfully: ${outputPath}`);
};
