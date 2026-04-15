export interface EncryptedParts {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}
