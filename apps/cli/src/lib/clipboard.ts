import clipboard from "clipboardy";

export class ClipboardError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = "ClipboardError";
  }
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await clipboard.write(text);
  } catch (err) {
    throw new ClipboardError("failed to write to clipboard", err);
  }
}
