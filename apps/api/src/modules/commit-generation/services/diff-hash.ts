import { createHash } from "node:crypto";

export const hashDiff = (normalized: string): string =>
  `sha256:${createHash("sha256").update(normalized, "utf8").digest("hex")}`;
