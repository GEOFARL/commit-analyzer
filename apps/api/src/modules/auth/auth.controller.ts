import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";
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
  signInEvent(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ): { ok: true } {
    const { provider } = signInEventSchema.parse(body);
    this.eventBus.publish(new AuthLoggedInEvent(req.authUserId!, provider));
    return { ok: true };
  }

  @Post("sign-out")
  signOut(@Req() req: AuthenticatedRequest): { ok: true } {
    this.eventBus.publish(new AuthLoggedOutEvent(req.authUserId!));
    return { ok: true };
  }
}
