import { Injectable } from "@nestjs/common";

import {
  parseAndStripDiff,
  renderParsedDiff,
  type ParsedDiff,
} from "../../../shared/diff-parser.js";

@Injectable()
export class DiffParserService {
  parse(raw: string): ParsedDiff {
    return parseAndStripDiff(raw);
  }

  render(parsed: ParsedDiff): string {
    return renderParsedDiff(parsed);
  }
}
