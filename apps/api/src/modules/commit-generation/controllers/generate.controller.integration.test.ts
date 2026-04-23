import "reflect-metadata";

import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { type INestApplication, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CqrsModule, EventBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { ClsModule, ClsService } from "nestjs-cls";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GENERATION_HISTORY_REPOSITORY,
  LLM_API_KEY_REPOSITORY,
  POLICY_REPOSITORY,
  REPOSITORY_REPOSITORY,
} from "../../../common/database/tokens.js";
import { THROTTLE_TIERS } from "../../../common/throttler/tiers.js";
import { UserThrottlerGuard } from "../../../common/throttler/user-throttler.guard.js";
import { CryptoService } from "../../../shared/crypto.service.js";
import {
  GenerationCompletedEvent,
} from "../../../shared/events/generation-completed.event.js";
import { GenerationFailedEvent } from "../../../shared/events/generation-failed.event.js";
import { PolicyValidationModule } from "../../../shared/policy-validation/policy-validation.module.js";
import { ApiKeyGuard } from "../../auth/api-key.guard.js";
import { JwtOrApiKeyGuard } from "../../auth/jwt-or-api-key.guard.js";
import { SupabaseAuthGuard } from "../../auth/supabase-auth.guard.js";
import { AnthropicProvider } from "../providers/anthropic.provider.js";
import { LLMProviderFactory } from "../providers/llm-provider.factory.js";
import type {
  GenerateArgs,
  LLMProvider,
  SuggestionEvent,
} from "../providers/llm-provider.interface.js";
import { OpenAIProvider } from "../providers/openai.provider.js";
import { DiffParserService } from "../services/diff-parser.service.js";
import { GenerationStreamService } from "../services/generation-stream.service.js";
import { LlmKeyService } from "../services/llm-key.service.js";
import { PromptBuilderService } from "../services/prompt-builder.service.js";

import { GenerateController } from "./generate.controller.js";

vi.mock("../../../common/config.js", () => ({
  getServerEnv: () => ({ GENERATION_POLICY_REGEN_ENABLED: false }),
}));

vi.mock("./generate.constants.js", () => ({ HEARTBEAT_MS: 50 }));

const USER_ID = "11111111-1111-1111-1111-111111111111";
const HISTORY_ID = "44444444-4444-4444-4444-444444444444";

const SAMPLE_DIFF = [
  "diff --git a/a.ts b/a.ts",
  "index 1..2 100644",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -1,2 +1,3 @@",
  " line",
  "+added",
].join("\n");

const happyPathScript: () => AsyncIterable<SuggestionEvent> = () => ({
  [Symbol.asyncIterator]() {
    const events: SuggestionEvent[] = [
      {
        kind: "suggestion",
        index: 0,
        value: { type: "feat", scope: null, subject: "add user validation", body: null, footer: null },
      },
      { kind: "done", tokensUsed: 123 },
    ];
    let i = 0;
    return {
      next(): Promise<IteratorResult<SuggestionEvent>> {
        return i < events.length
          ? Promise.resolve({ value: events[i++]!, done: false })
          : Promise.resolve({
              value: undefined as unknown as SuggestionEvent,
              done: true,
            });
      },
    };
  },
});

const hangingScript = (
  signal?: AbortSignal,
): AsyncIterable<SuggestionEvent> => ({
  async *[Symbol.asyncIterator]() {
    yield {
      kind: "suggestion",
      index: 0,
      value: { type: "feat", scope: null, subject: "first", body: null, footer: null },
    };
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("aborted"));
        return;
      }
      signal?.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        { once: true },
      );
      // Resolve after 5s as a safety net so a test bug doesn't hang forever.
      setTimeout(resolve, 5000).unref();
    });
  },
});

const fakeProvider = (
  script: (signal?: AbortSignal) => AsyncIterable<SuggestionEvent>,
): LLMProvider => ({
  name: "openai",
  verify: vi.fn().mockResolvedValue(true),
  generateSuggestions: (args: GenerateArgs) => script(args.signal),
});

const buildApp = async (
  provider: LLMProvider,
  { withLlmKey = true } = {},
): Promise<{
  app: INestApplication;
  history: { createOne: ReturnType<typeof vi.fn> };
  eventBus: EventBus;
}> => {
  const history = {
    createOne: vi.fn().mockImplementation((input: unknown) =>
      Promise.resolve({
        id: HISTORY_ID,
        ...(input as object),
        createdAt: new Date(),
      }),
    ),
  };
  const llmKeyRepo = {
    findByUserAndProvider: vi.fn().mockResolvedValue(
      withLlmKey
        ? {
            userId: USER_ID,
            provider: "openai",
            keyEnc: Buffer.from("enc"),
            keyIv: Buffer.from("iv"),
            keyTag: Buffer.from("tag"),
          }
        : null,
    ),
  };
  const cryptoStub = {
    decryptParts: () => "sk-test",
  } as unknown as CryptoService;
  const policyRepo = {
    findWithRules: vi.fn().mockResolvedValue(null),
    getActiveForRepo: vi.fn().mockResolvedValue(null),
  };
  const reposRepo = {
    findByIdForUser: vi.fn().mockResolvedValue(null),
  };

  @Module({
    imports: [
      ClsModule.forRoot({ global: true, middleware: { mount: true } }),
      CqrsModule.forRoot(),
      PolicyValidationModule,
      ThrottlerModule.forRoot([
        THROTTLE_TIERS.default,
        THROTTLE_TIERS.auth,
        THROTTLE_TIERS.generate,
        THROTTLE_TIERS.analytics,
      ]),
    ],
    controllers: [GenerateController],
    providers: [
      { provide: APP_GUARD, useClass: UserThrottlerGuard },
      DiffParserService,
      PromptBuilderService,
      OpenAIProvider,
      AnthropicProvider,
      {
        provide: LLMProviderFactory,
        useValue: {
          get: () => provider,
        },
      },
      GenerationStreamService,
      LlmKeyService,
      { provide: GENERATION_HISTORY_REPOSITORY, useValue: history },
      { provide: LLM_API_KEY_REPOSITORY, useValue: llmKeyRepo },
      { provide: POLICY_REPOSITORY, useValue: policyRepo },
      { provide: REPOSITORY_REPOSITORY, useValue: reposRepo },
      { provide: CryptoService, useValue: cryptoStub },
      {
        provide: SupabaseAuthGuard,
        useFactory: (cls: ClsService) => ({
          canActivate: () => {
            cls.set("auth.userId", USER_ID);
            cls.set("auth.kind", "session");
            return true;
          },
        }),
        inject: [ClsService],
      },
      {
        provide: ApiKeyGuard,
        useFactory: (cls: ClsService) => ({
          canActivate: () => {
            cls.set("auth.userId", USER_ID);
            cls.set("auth.kind", "api-key");
            return true;
          },
        }),
        inject: [ClsService],
      },
      JwtOrApiKeyGuard,
    ],
  })
  class TestModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  const eventBus = app.get(EventBus);
  vi.spyOn(eventBus, "publish");
  return { app, history, eventBus };
};

describe("POST /generate (SSE)", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("streams suggestion + done events with SSE framing, headers, and generation.completed", async () => {
    const ctx = await buildApp(fakeProvider(happyPathScript));
    app = ctx.app;
    const server = app.getHttpServer() as Server;

    const res = await request(server)
      .post("/generate")
      .set("authorization", "Bearer stub-jwt")
      .send({ diff: SAMPLE_DIFF, provider: "openai", model: "gpt-4o-mini" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.headers["cache-control"]).toBe("no-cache, no-transform");
    expect(res.headers["x-accel-buffering"]).toBe("no");

    const frames = parseSseFrames(res.text);
    expect(frames.map((f) => f.kind)).toEqual(["suggestion", "done"]);
    expect(frames[1]!.data).toMatchObject({
      historyId: HISTORY_ID,
      tokensUsed: 123,
    });

    const persisted = ctx.history.createOne.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(persisted.status).toBe("completed");

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const publish = vi.mocked(ctx.eventBus.publish);
    const published = publish.mock.calls.map((c) => c[0]);
    expect(
      published.some((e) => e instanceof GenerationCompletedEvent),
    ).toBe(true);
    expect(
      published.some((e) => e instanceof GenerationFailedEvent),
    ).toBe(false);
  });

  it("returns 412 with NO_LLM_KEY when the user has no stored key", async () => {
    const ctx = await buildApp(fakeProvider(happyPathScript), {
      withLlmKey: false,
    });
    app = ctx.app;
    const server = app.getHttpServer() as Server;

    const res = await request(server)
      .post("/generate")
      .set("authorization", "Bearer stub-jwt")
      .send({ diff: SAMPLE_DIFF, provider: "openai", model: "gpt-4o-mini" });

    expect(res.status).toBe(412);
    expect(res.body).toMatchObject({ code: "NO_LLM_KEY" });
  });

  it("accepts API-key auth via x-api-key header", async () => {
    const ctx = await buildApp(fakeProvider(happyPathScript));
    app = ctx.app;
    const server = app.getHttpServer() as Server;

    const res = await request(server)
      .post("/generate")
      .set("x-api-key", "cap_secret_xxxxxxxxxxxxxxxxxx")
      .send({ diff: SAMPLE_DIFF, provider: "openai", model: "gpt-4o-mini" });

    expect(res.status).toBe(200);
    const frames = parseSseFrames(res.text);
    expect(frames.map((f) => f.kind)).toEqual(["suggestion", "done"]);
  });

  it("delivers the first SSE frame within the TTFT budget (<2 s)", async () => {
    const ctx = await buildApp(fakeProvider(happyPathScript));
    app = ctx.app;
    await app.listen(0);
    const server = app.getHttpServer() as Server;
    const { port } = server.address() as AddressInfo;

    const http = await import("node:http");
    const payload = JSON.stringify({
      diff: SAMPLE_DIFF,
      provider: "openai",
      model: "gpt-4o-mini",
    });
    const start = performance.now();
    const ttft = await new Promise<number>((resolve, reject) => {
      const req_ = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/generate",
          method: "POST",
          headers: {
            authorization: "Bearer stub-jwt",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
        },
        (r) => {
          r.once("data", () => {
            const delta = performance.now() - start;
            req_.destroy();
            resolve(delta);
          });
          r.once("error", reject);
        },
      );
      req_.once("error", reject);
      req_.end(payload);
      setTimeout(() => reject(new Error("ttft timeout")), 3000);
    });
    expect(ttft).toBeLessThan(2000);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const ctx = await buildApp(fakeProvider(happyPathScript));
    app = ctx.app;
    const server = app.getHttpServer() as Server;

    const res = await request(server)
      .post("/generate")
      .send({ diff: SAMPLE_DIFF, provider: "openai", model: "gpt-4o-mini" });

    expect(res.status).toBe(401);
  });

  it("emits a `: ping` heartbeat on an idle stream", async () => {
    const ctx = await buildApp(fakeProvider(hangingScript));
    app = ctx.app;
    await app.listen(0);
    const server = app.getHttpServer() as Server;
    const { port } = server.address() as AddressInfo;

    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/generate`, {
      method: "POST",
      headers: {
        authorization: "Bearer stub-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        diff: SAMPLE_DIFF,
        provider: "openai",
        model: "gpt-4o-mini",
      }),
      signal: controller.signal,
    });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const chunk = await reader.read();
      if (chunk.done) break;
      accumulated += decoder.decode(chunk.value as Uint8Array, {
        stream: true,
      });
      if (accumulated.includes(": ping")) break;
    }
    controller.abort();
    await reader.cancel().catch(() => undefined);
    expect(accumulated).toContain(": ping");
  });

  it("on client disconnect persists cancelled status and aborts the provider", async () => {
    const ctx = await buildApp(fakeProvider(hangingScript));
    app = ctx.app;
    await app.listen(0);
    const server = app.getHttpServer() as Server;
    const { port } = server.address() as AddressInfo;

    const { default: http } = await import("node:http");
    const payload = JSON.stringify({
      diff: SAMPLE_DIFF,
      provider: "openai",
      model: "gpt-4o-mini",
    });
    await new Promise<void>((resolve, reject) => {
      const req_ = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/generate",
          method: "POST",
          headers: {
            authorization: "Bearer stub-jwt",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          res.once("data", () => {
            req_.destroy();
            resolve();
          });
          res.once("error", () => resolve());
          res.once("close", () => resolve());
        },
      );
      req_.once("error", () => resolve());
      req_.end(payload);
      setTimeout(
        () => reject(new Error("timed out waiting for first chunk")),
        3000,
      );
    });

    // Wait for the cancelled persist to land.
    const start = Date.now();
    while (
      ctx.history.createOne.mock.calls.length === 0 &&
      Date.now() - start < 3000
    ) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(ctx.history.createOne).toHaveBeenCalledTimes(1);
    const persisted = ctx.history.createOne.mock.calls[0]![0] as Record<
      string,
      unknown
    >;
    expect(persisted.status).toBe("cancelled");
  });
});

function parseSseFrames(
  raw: string,
): Array<{ kind: string; data: Record<string, unknown> }> {
  return raw
    .split("\n\n")
    .filter((f) => f.startsWith("event:"))
    .map((f) => {
      const [evLine, dataLine] = f.split("\n");
      const kind = evLine!.replace("event: ", "").trim();
      const json = JSON.parse(dataLine!.replace("data: ", "")) as Record<
        string,
        unknown
      >;
      return { kind, data: json };
    });
}

