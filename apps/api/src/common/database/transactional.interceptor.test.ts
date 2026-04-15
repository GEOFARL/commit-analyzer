import "reflect-metadata";

import type { Server } from "node:http";

import {
  Controller,
  Get,
  type INestApplication,
} from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ClsModule, type ClsService } from "nestjs-cls";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLS_JWT_CLAIMS,
  CLS_USER_ID,
  getTxEntityManager,
} from "../request-context.js";

import { DATA_SOURCE } from "./tokens.js";
import { Transactional } from "./transactional.decorator.js";
import { TransactionalInterceptor } from "./transactional.interceptor.js";

type QueryCall = [sql: string, params?: unknown[]];

interface Recorder {
  queries: QueryCall[];
  startTx: number;
  commit: number;
  rollback: number;
  release: number;
}

const emptyRecorder = (): Recorder => ({
  queries: [],
  startTx: 0,
  commit: 0,
  rollback: 0,
  release: 0,
});

const makeFakeDataSource = (
  recorder: Recorder,
): { createQueryRunner: () => unknown } => ({
  createQueryRunner() {
    const manager = {
      query(sql: string, params?: unknown[]): Promise<unknown> {
        recorder.queries.push([sql, params]);
        return Promise.resolve([]);
      },
    };
    return {
      manager,
      connect: (): Promise<void> => Promise.resolve(),
      startTransaction: (): Promise<void> => {
        recorder.startTx += 1;
        return Promise.resolve();
      },
      commitTransaction: (): Promise<void> => {
        recorder.commit += 1;
        return Promise.resolve();
      },
      rollbackTransaction: (): Promise<void> => {
        recorder.rollback += 1;
        return Promise.resolve();
      },
      release: (): Promise<void> => {
        recorder.release += 1;
        return Promise.resolve();
      },
    };
  },
});

const ownedEndpoint = "/probe/owned";
const plainEndpoint = "/probe/plain";
const boomEndpoint = "/probe/boom";

@Controller("probe")
class ProbeController {
  @Get("owned")
  @Transactional()
  owned(): { sawManager: boolean } {
    return { sawManager: Boolean(getTxEntityManager()) };
  }

  @Get("plain")
  plain(): { sawManager: boolean } {
    return { sawManager: Boolean(getTxEntityManager()) };
  }

  @Get("boom")
  @Transactional()
  boom(): never {
    throw new Error("boom");
  }
}

type ClsSetup = ((cls: ClsService) => void) | undefined;

const buildApp = async (
  clsSetup: ClsSetup,
): Promise<{ app: INestApplication; recorder: Recorder }> => {
  const recorder = emptyRecorder();
  const moduleRef = await Test.createTestingModule({
    imports: [
      ClsModule.forRoot({
        global: true,
        middleware: {
          mount: true,
          generateId: true,
          setup: clsSetup,
        },
      }),
    ],
    controllers: [ProbeController],
    providers: [
      Reflector,
      { provide: DATA_SOURCE, useValue: makeFakeDataSource(recorder) },
      { provide: APP_INTERCEPTOR, useClass: TransactionalInterceptor },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, recorder };
};

const findSetConfig = (recorder: Recorder): QueryCall | undefined =>
  recorder.queries.find(([sql]) => sql.includes("set_config"));

describe("TransactionalInterceptor", () => {
  let app: INestApplication;
  let recorder: Recorder;
  const server = (): Server => app.getHttpServer() as Server;

  const setupUserOnly: ClsSetup = (cls) => {
    cls.set(CLS_USER_ID, "user-123");
  };

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("opens tx, sets jwt claims, commits, releases on @Transactional() handler", async () => {
    ({ app, recorder } = await buildApp(setupUserOnly));
    const res = await request(server()).get(ownedEndpoint).expect(200);
    expect(res.body).toEqual({ sawManager: true });
    expect(recorder.startTx).toBe(1);
    expect(recorder.commit).toBe(1);
    expect(recorder.rollback).toBe(0);
    expect(recorder.release).toBe(1);
    const setConfig = findSetConfig(recorder);
    expect(setConfig).toBeDefined();
    expect(setConfig?.[0]).toContain("request.jwt.claims");
    expect(setConfig?.[0]).toContain("true"); // is_local=true
    expect(setConfig?.[1]).toEqual([JSON.stringify({ sub: "user-123" })]);
  });

  it("passes full stored JWT claims when the guard populated them", async () => {
    ({ app, recorder } = await buildApp((cls) => {
      cls.set(CLS_USER_ID, "user-123");
      cls.set(CLS_JWT_CLAIMS, {
        sub: "user-123",
        role: "authenticated",
        email: "u@example.com",
      });
    }));
    await request(server()).get(ownedEndpoint).expect(200);
    const setConfig = findSetConfig(recorder);
    expect(setConfig?.[1]).toEqual([
      JSON.stringify({
        sub: "user-123",
        role: "authenticated",
        email: "u@example.com",
      }),
    ]);
  });

  it("skips tx for handlers without @Transactional()", async () => {
    ({ app, recorder } = await buildApp(setupUserOnly));
    const res = await request(server()).get(plainEndpoint).expect(200);
    expect(res.body).toEqual({ sawManager: false });
    expect(recorder.startTx).toBe(0);
    expect(recorder.commit).toBe(0);
    expect(recorder.queries).toHaveLength(0);
  });

  it("rolls back and releases when handler throws", async () => {
    ({ app, recorder } = await buildApp(setupUserOnly));
    await request(server()).get(boomEndpoint).expect(500);
    expect(recorder.startTx).toBe(1);
    expect(recorder.commit).toBe(0);
    expect(recorder.rollback).toBe(1);
    expect(recorder.release).toBe(1);
  });

  it("passes empty claims object when no user is bound", async () => {
    ({ app, recorder } = await buildApp(undefined));
    await request(server()).get(ownedEndpoint).expect(200);
    expect(findSetConfig(recorder)?.[1]).toEqual([JSON.stringify({})]);
  });
});
