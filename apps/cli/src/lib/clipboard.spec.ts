import clipboard from "clipboardy";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { ClipboardError, copyToClipboard } from "./clipboard.js";

vi.mock("clipboardy", () => ({
  default: { write: vi.fn() },
}));

// eslint-disable-next-line @typescript-eslint/unbound-method
const writeMock = clipboard.write as unknown as Mock;

describe("copyToClipboard", () => {
  beforeEach(() => {
    writeMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to clipboardy.write", async () => {
    writeMock.mockResolvedValue(undefined);
    await copyToClipboard("hello");
    expect(writeMock).toHaveBeenCalledWith("hello");
  });

  it("wraps clipboardy errors in ClipboardError with cause", async () => {
    const underlying = new Error("xclip not installed");
    writeMock.mockRejectedValue(underlying);
    try {
      await copyToClipboard("x");
      expect.fail("expected ClipboardError");
    } catch (err) {
      expect(err).toBeInstanceOf(ClipboardError);
      expect((err as Error).message).toBe("failed to write to clipboard");
      expect((err as ClipboardError).cause).toBe(underlying);
    }
  });
});
