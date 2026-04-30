import {
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Req,
  Res,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { apiReference } from "@scalar/nestjs-api-reference";
import type { Request, Response } from "express";
import type { OpenAPIObject } from "openapi3-ts";

import { getServerEnv } from "../../common/config.js";

import { buildOpenApiDocument } from "./openapi-document.js";

@Controller("api/docs")
@SkipThrottle()
export class OpenapiController {
  private readonly document: OpenAPIObject | null;
  private readonly scalarHandler:
    | ReturnType<typeof apiReference>
    | null;
  private readonly enabled: boolean;

  constructor() {
    const env = getServerEnv();
    this.enabled = env.OPENAPI_DOCS_ENABLED;
    this.document = this.enabled ? buildOpenApiDocument(env.API_URL) : null;
    this.scalarHandler =
      this.document
        ? apiReference({
            content: this.document,
            theme: "default",
          })
        : null;
  }

  @Get("openapi.json")
  openapiJson(@Res() res: Response): void {
    if (!this.enabled || !this.document) throw new NotFoundException();
    res.status(HttpStatus.OK).type("application/json").send(this.document);
  }

  @Get()
  ui(@Req() req: Request, @Res() res: Response): void {
    if (!this.scalarHandler) throw new NotFoundException();
    (this.scalarHandler as (req: Request, res: Response) => void)(req, res);
  }
}
