import {
  generateRequestSchema,
  type GenerateRequest,
} from "@commit-analyzer/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { ThrottleTierDecorator } from "../../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../../auth/current-user.decorator.js";
import { JwtOrApiKeyGuard } from "../../auth/jwt-or-api-key.guard.js";
import { GenerationStreamService } from "../services/generation-stream.service.js";
import { LlmKeyService } from "../services/llm-key.service.js";

import { HEARTBEAT_MS } from "./generate.constants.js";
import { canWrite, writeSseEvent } from "./generate.mappers.js";

@Controller()
@UseGuards(JwtOrApiKeyGuard)
export class GenerateController {
  constructor(
    @Inject(GenerationStreamService)
    private readonly stream: GenerationStreamService,
    @Inject(LlmKeyService)
    private readonly llmKeys: LlmKeyService,
  ) {}

  @Post("/generate")
  @HttpCode(HttpStatus.OK)
  @ThrottleTierDecorator("generate")
  async generate(
    @CurrentUser() userId: string,
    @Body() rawBody: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const parseResult = generateRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "invalid request body",
        issues: parseResult.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    const body: GenerateRequest = parseResult.data;
    const apiKey = await this.llmKeys.getDecrypted(userId, body.provider);
    if (!apiKey) {
      throw new HttpException(
        { code: "NO_LLM_KEY", message: "no LLM API key stored for provider" },
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Prime TTFT: disable Nagle + write a comment frame before the provider's
    // first token.
    res.socket?.setNoDelay(true);
    if (canWrite(res)) res.write(": connected\n\n");

    const abort = new AbortController();
    res.on("close", () => abort.abort());

    const heartbeat = setInterval(() => {
      if (canWrite(res)) res.write(": ping\n\n");
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    try {
      // Drain the generator fully — breaking early abandons it and skips the
      // cancelled-history persist in the post-abort branch.
      for await (const ev of this.stream.stream({
        userId,
        diff: body.diff,
        provider: body.provider,
        model: body.model,
        apiKey,
        options: {
          ...(body.repositoryId ? { repositoryId: body.repositoryId } : {}),
          ...(body.policyId ? { policyId: body.policyId } : {}),
          ...(body.count !== undefined ? { count: body.count } : {}),
          signal: abort.signal,
        },
      })) {
        if (canWrite(res)) writeSseEvent(res, ev);
      }
    } catch (err) {
      if (canWrite(res)) {
        writeSseEvent(res, {
          kind: "error",
          data: {
            code: "INTERNAL",
            message: err instanceof Error ? err.message : "internal error",
          },
        });
      }
    } finally {
      clearInterval(heartbeat);
      if (canWrite(res)) res.end();
    }
  }
}

