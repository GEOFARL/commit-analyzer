import type { Response } from "express";

import type { StreamEvent } from "../services/generation-stream.types.js";

export function writeSseEvent(res: Response, ev: StreamEvent): void {
  res.write(`event: ${ev.kind}\ndata: ${JSON.stringify(ev.data)}\n\n`);
}

// On disconnect the socket is destroyed before res.end(), so `writableEnded`
// stays false even though writes would throw.
export function canWrite(res: Response): boolean {
  return res.writable && !res.destroyed;
}
