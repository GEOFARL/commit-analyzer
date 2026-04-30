import "reflect-metadata";

import { Test } from "@nestjs/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getServerEnvMock = vi.hoisted(() => vi.fn());
vi.mock("../../common/config.js", () => ({
  getServerEnv: getServerEnvMock,
}));

const { OpenapiController } = await import("./openapi.controller.js");

const createResponseStub = (): {
  status: ReturnType<typeof vi.fn>;
  type: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
} => {
  const res = {
    status: vi.fn().mockReturnThis(),
    type: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    end: vi.fn(),
    write: vi.fn(),
  };
  return res;
};

const baseEnv = {
  API_URL: "https://api.example.com",
  OPENAPI_DOCS_ENABLED: true,
};

describe("OpenapiController", () => {
  beforeEach(() => {
    getServerEnvMock.mockReturnValue({ ...baseEnv });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("serves the openapi.json document with project metadata", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpenapiController],
    }).compile();
    const controller = moduleRef.get(OpenapiController);
    const res = createResponseStub();

    controller.openapiJson(res as never);

    expect(res.type).toHaveBeenCalledWith("application/json");
    expect(res.send).toHaveBeenCalledTimes(1);
    const sent = res.send.mock.calls[0]?.[0] as
      | { info: { title: string }; paths: Record<string, unknown> }
      | undefined;
    expect(sent?.info.title).toBe("Commit Analyzer API");
    expect(Object.keys(sent?.paths ?? {}).length).toBeGreaterThan(10);
  });

  it("returns 404 from openapi.json when the flag is off", async () => {
    getServerEnvMock.mockReturnValue({ ...baseEnv, OPENAPI_DOCS_ENABLED: false });
    const moduleRef = await Test.createTestingModule({
      controllers: [OpenapiController],
    }).compile();
    const controller = moduleRef.get(OpenapiController);

    expect(() => controller.openapiJson(createResponseStub() as never)).toThrow(
      /Not Found/u,
    );
  });

  it("returns 404 from the UI when the flag is off", async () => {
    getServerEnvMock.mockReturnValue({ ...baseEnv, OPENAPI_DOCS_ENABLED: false });
    const moduleRef = await Test.createTestingModule({
      controllers: [OpenapiController],
    }).compile();
    const controller = moduleRef.get(OpenapiController);

    expect(() =>
      controller.ui({} as never, createResponseStub() as never),
    ).toThrow(/Not Found/u);
  });

  it("delegates UI rendering to the Scalar handler", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpenapiController],
    }).compile();
    const controller = moduleRef.get(OpenapiController);
    const res = createResponseStub();

    controller.ui({ headers: { accept: "text/html" } } as never, res as never);

    // Scalar writes HTML via res.end / res.write — assert at least one was called.
    expect(res.end.mock.calls.length + res.send.mock.calls.length).toBeGreaterThan(0);
  });
});
