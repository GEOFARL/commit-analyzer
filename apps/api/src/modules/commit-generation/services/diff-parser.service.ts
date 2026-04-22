import {
  parseAndStripDiff,
  renderParsedDiff,
  type ParsedDiff,
} from "@commit-analyzer/diff-parser";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DiffParserService {
  parse(raw: string): ParsedDiff {
    return parseAndStripDiff(raw);
  }

  render(parsed: ParsedDiff): string {
    return renderParsedDiff(parsed);
  }
}
