import "reflect-metadata";

import type { Server } from "node:http";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getServerEnvMock = vi.hoisted(() => vi.fn());
vi.mock("../../common/config.js", () => ({
  getServerEnv: getServerEnvMock,
}));

const { OpenapiController } = await import("./openapi.controller.js");

const baseEnv = {
  API_URL: "https://api.example.com",
  OPENAPI_DOCS_USERNAME: undefined as string | undefined,
  OPENAPI_DOCS_PASSWORD: undefined as string | undefined,
};

const buildApp = async (): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({
    controllers: [OpenapiController],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
};

const basic = (user: string, pass: string): string =>
  `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;

describe("OpenapiController (HTTP)", () => {
  let app: INestApplication | undefined;
  const server = (): Server => app!.getHttpServer() as Server;

  beforeEach(() => {
    getServerEnvMock.mockReturnValue({ ...baseEnv });
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.clearAllMocks();
  });

  it("serves openapi.json with the contracts-derived spec", async () => {
    app = await buildApp();
    const res = await request(server()).get("/api/docs/openapi.json");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/u);
    const body = res.body as {
      info: { title: string };
      openapi: string;
      paths: Record<string, Record<string, Record<string, unknown>>>;
      "x-websocket": { namespace: string };
    };
    expect(body.info.title).toBe("Commit Analyzer API");
    expect(body.openapi).toMatch(/^3\./u);
    expect(Object.keys(body.paths).length).toBeGreaterThan(20);
    expect(body.paths["/generate"]?.post?.["x-sse"]).toBe(true);
    expect(body["x-websocket"].namespace).toBe("/sync");
  });

  it("serves the Scalar UI as HTML referencing the JSON sub-route", async () => {
    app = await buildApp();
    const res = await request(server()).get("/api/docs");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/u);
    expect(res.text).toMatch(/@scalar/u);
    expect(res.text).toMatch(/Commit Analyzer API/u);
    expect(res.text.length).toBeGreaterThan(500);
  });

  describe("with Basic auth credentials configured", () => {
    beforeEach(() => {
      getServerEnvMock.mockReturnValue({
        ...baseEnv,
        OPENAPI_DOCS_USERNAME: "docs",
        OPENAPI_DOCS_PASSWORD: "letmein",
      });
    });

    it("returns 401 + WWW-Authenticate when no header is sent", async () => {
      app = await buildApp();
      const res = await request(server()).get("/api/docs");
      expect(res.status).toBe(401);
      expect(res.headers["www-authenticate"]).toMatch(/^Basic realm=/u);
    });

    it("returns 401 on bad credentials", async () => {
      app = await buildApp();
      const res = await request(server())
        .get("/api/docs/openapi.json")
        .set("Authorization", basic("docs", "wrong"));
      expect(res.status).toBe(401);
    });

    it("returns 200 on correct credentials for the UI", async () => {
      app = await buildApp();
      const res = await request(server())
        .get("/api/docs")
        .set("Authorization", basic("docs", "letmein"));
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/u);
    });

    it("returns 200 on correct credentials for openapi.json", async () => {
      app = await buildApp();
      const res = await request(server())
        .get("/api/docs/openapi.json")
        .set("Authorization", basic("docs", "letmein"));
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/json/u);
    });
  });
});
