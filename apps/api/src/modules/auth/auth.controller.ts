import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { z } from "zod";

import { AuthLoggedInEvent } from "./events/auth-logged-in.event.js";
import { AuthLoggedOutEvent } from "./events/auth-logged-out.event.js";
import {
  SupabaseAuthGuard,
  type AuthenticatedRequest,
} from "./supabase-auth.guard.js";

const signInEventSchema = z.object({ provider: z.literal("github") });

@Controller("auth")
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  constructor(@Inject(EventBus) private readonly eventBus: EventBus) {}

  @Post("sign-in-event")
  @HttpCode(200)
  signInEvent(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ): { ok: true } {
    const parsed = signInEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "invalid sign-in-event payload",
        issues: parsed.error.issues,
      });
    }
    this.eventBus.publish(
      new AuthLoggedInEvent(req.authUserId!, parsed.data.provider),
    );
    return { ok: true };
  }

  @Post("sign-out")
  @HttpCode(200)
  signOut(@Req() req: AuthenticatedRequest): { ok: true } {
    this.eventBus.publish(new AuthLoggedOutEvent(req.authUserId!));
    return { ok: true };
  }
}
