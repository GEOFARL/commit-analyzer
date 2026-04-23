import type { Response } from "express";

import type { StreamEvent } from "../services/generation-stream.types.js";

export function writeSseEvent(res: Response, ev: StreamEvent): void {
  res.write(`event: ${ev.kind}\ndata: ${JSON.stringify(ev.data)}\n\n`);
}
