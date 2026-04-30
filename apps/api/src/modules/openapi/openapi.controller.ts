import {
  Controller,
  Get,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { apiReference } from "@scalar/nestjs-api-reference";
import type { Request, Response } from "express";
import type { OpenAPIObject } from "openapi3-ts";

import { getServerEnv } from "../../common/config.js";

import { buildOpenApiDocument } from "./openapi-document.js";
import { OPENAPI_DOCS_REALM, safeEqual } from "./openapi.constants.js";

@Controller("api/docs")
@SkipThrottle()
export class OpenapiController {
  private readonly document: OpenAPIObject;
  private readonly scalarHandler: ReturnType<typeof apiReference>;
  private readonly username: string | undefined;
  private readonly password: string | undefined;

  constructor() {
    const env = getServerEnv();
    this.username = env.OPENAPI_DOCS_USERNAME;
    this.password = env.OPENAPI_DOCS_PASSWORD;
    this.document = buildOpenApiDocument(env.API_URL);
    this.scalarHandler = apiReference({
      content: this.document,
      theme: "default",
    });
  }

  private authorize(req: Request, res: Response): boolean {
    if (!this.username || !this.password) return true;

    const header = req.headers.authorization ?? "";
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep > 0) {
        const user = decoded.slice(0, sep);
        const pass = decoded.slice(sep + 1);
        if (safeEqual(user, this.username) && safeEqual(pass, this.password)) {
          return true;
        }
      }
    }

    res.setHeader(
      "WWW-Authenticate",
      `Basic realm="${OPENAPI_DOCS_REALM}", charset="UTF-8"`,
    );
    throw new UnauthorizedException();
  }

  // Scalar loads its bundle from cdn.jsdelivr.net, which the global helmet
  // CSP (`default-src 'self'`) blocks. Override CSP for the docs HTML route
  // only — the JSON route inherits the strict default.
  private allowScalarCdn(res: Response): void {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https:",
        "connect-src 'self' https:",
        "worker-src 'self' blob:",
      ].join("; "),
    );
  }

  @Get("openapi.json")
  openapiJson(@Req() req: Request, @Res() res: Response): void {
    if (!this.authorize(req, res)) return;
    res.status(HttpStatus.OK).type("application/json").send(this.document);
  }

  @Get()
  ui(@Req() req: Request, @Res() res: Response): void {
    if (!this.authorize(req, res)) return;
    this.allowScalarCdn(res);
    (this.scalarHandler as (req: Request, res: Response) => void)(req, res);
  }
}
