import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable, Optional } from "@nestjs/common";

import { getServerEnv } from "../common/config.js";

import {
  ALGO,
  IV_LENGTH,
  KEY_LENGTH,
  TAG_LENGTH,
  VERSION,
} from "./crypto.constants.js";
import type { EncryptedParts } from "./crypto.types.js";

export class DecryptionError extends Error {
  constructor(message = "decryption failed") {
    super(message);
    this.name = "DecryptionError";
  }
}

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  // `@Optional()` tells Nest to skip DI for this parameter — otherwise the
  // `emitDecoratorMetadata` type hint leaks `Buffer` as an injection token and
  // bootstrap dies with `UnknownDependenciesException`. Tests still pass a key
  // directly via `new CryptoService(buf)`.
  constructor(@Optional() key?: Buffer) {
    const resolved = key ?? Buffer.from(getServerEnv().ENCRYPTION_KEY_BASE64, "base64");
    if (resolved.length !== KEY_LENGTH) {
      throw new Error(`encryption key must be ${KEY_LENGTH} bytes`);
    }
    this.key = resolved;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString("base64"), ciphertext.toString("base64"), tag.toString("base64")].join(":");
  }

  decrypt(cipher: string): string {
    const parts = cipher.split(":");
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new DecryptionError("unsupported ciphertext format");
    }
    const ivB64 = parts[1]!;
    const dataB64 = parts[2]!;
    const tagB64 = parts[3]!;
    let iv: Buffer;
    let data: Buffer;
    let tag: Buffer;
    try {
      iv = Buffer.from(ivB64, "base64");
      data = Buffer.from(dataB64, "base64");
      tag = Buffer.from(tagB64, "base64");
    } catch {
      throw new DecryptionError("invalid base64 segment");
    }
    return this.decryptParts({ ciphertext: data, iv, tag });
  }

  encryptParts(plaintext: string): EncryptedParts {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
  }

  decryptParts({ ciphertext, iv, tag }: EncryptedParts): string {
    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      throw new DecryptionError("invalid iv or tag length");
    }
    try {
      const decipher = createDecipheriv(ALGO, this.key, iv);
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      return plaintext.toString("utf8");
    } catch {
      throw new DecryptionError();
    }
  }
}
