import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CryptoService, DecryptionError } from "./crypto.service.js";

const makeKey = (): Buffer => randomBytes(32);

describe("CryptoService", () => {
  it("round-trips an empty string", () => {
    const svc = new CryptoService(makeKey());
    expect(svc.decrypt(svc.encrypt(""))).toBe("");
  });

  it("round-trips unicode", () => {
    const svc = new CryptoService(makeKey());
    const plain = "héllo 🌍 — Привіт, 世界";
    expect(svc.decrypt(svc.encrypt(plain))).toBe(plain);
  });

  it("emits versioned v1 format with four parts", () => {
    const svc = new CryptoService(makeKey());
    const out = svc.encrypt("hello");
    const parts = out.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
  });

  it("produces distinct ciphertexts for same plaintext (fresh IV)", () => {
    const svc = new CryptoService(makeKey());
    expect(svc.encrypt("same")).not.toBe(svc.encrypt("same"));
  });

  it("round-trips 1000 random inputs", () => {
    const svc = new CryptoService(makeKey());
    for (let i = 0; i < 1000; i++) {
      const len = Math.floor(Math.random() * 256);
      const plain = randomBytes(len).toString("base64");
      expect(svc.decrypt(svc.encrypt(plain))).toBe(plain);
    }
  });

  it("throws DecryptionError on tampered ciphertext", () => {
    const svc = new CryptoService(makeKey());
    const encrypted = svc.encrypt("secret");
    const parts = encrypted.split(":");
    const data = Buffer.from(parts[2]!, "base64");
    data[0] = (data[0] ?? 0) ^ 0x01;
    parts[2] = data.toString("base64");
    expect(() => svc.decrypt(parts.join(":"))).toThrow(DecryptionError);
  });

  it("throws DecryptionError on tampered auth tag", () => {
    const svc = new CryptoService(makeKey());
    const encrypted = svc.encrypt("secret");
    const parts = encrypted.split(":");
    const tag = Buffer.from(parts[3]!, "base64");
    tag[0] = (tag[0] ?? 0) ^ 0x01;
    parts[3] = tag.toString("base64");
    expect(() => svc.decrypt(parts.join(":"))).toThrow(DecryptionError);
  });

  it("throws DecryptionError when decrypted with wrong key", () => {
    const a = new CryptoService(makeKey());
    const b = new CryptoService(makeKey());
    const encrypted = a.encrypt("secret");
    expect(() => b.decrypt(encrypted)).toThrow(DecryptionError);
  });

  it("throws DecryptionError on unsupported version prefix", () => {
    const svc = new CryptoService(makeKey());
    const encrypted = svc.encrypt("x");
    const bad = "v2" + encrypted.slice(2);
    expect(() => svc.decrypt(bad)).toThrow(DecryptionError);
  });

  it("throws DecryptionError on malformed segment count", () => {
    const svc = new CryptoService(makeKey());
    expect(() => svc.decrypt("v1:only:two")).toThrow(DecryptionError);
  });

  it("rejects key of wrong length", () => {
    expect(() => new CryptoService(Buffer.alloc(16))).toThrow(/32 bytes/);
  });

  it("encryptParts/decryptParts round-trip", () => {
    const svc = new CryptoService(makeKey());
    const plain = "structured data";
    const parts = svc.encryptParts(plain);
    expect(parts.ciphertext).toBeInstanceOf(Buffer);
    expect(parts.iv).toBeInstanceOf(Buffer);
    expect(parts.tag).toBeInstanceOf(Buffer);
    expect(svc.decryptParts(parts)).toBe(plain);
  });

  it("decryptParts throws on wrong iv length", () => {
    const svc = new CryptoService(makeKey());
    const parts = svc.encryptParts("x");
    parts.iv = Buffer.alloc(8);
    expect(() => svc.decryptParts(parts)).toThrow(DecryptionError);
  });

  it("decryptParts throws on wrong tag length", () => {
    const svc = new CryptoService(makeKey());
    const parts = svc.encryptParts("x");
    parts.tag = Buffer.alloc(8);
    expect(() => svc.decryptParts(parts)).toThrow(DecryptionError);
  });

  it("decryptParts throws on tampered iv", () => {
    const svc = new CryptoService(makeKey());
    const parts = svc.encryptParts("secret");
    parts.iv[0] = (parts.iv[0] ?? 0) ^ 0xff;
    expect(() => svc.decryptParts(parts)).toThrow(DecryptionError);
  });
});
