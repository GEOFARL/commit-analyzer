import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { z } from "zod";

import { CurrentUser } from "./current-user.decorator.js";
import { AuthLoggedInEvent } from "./events/auth-logged-in.event.js";
import { AuthLoggedOutEvent } from "./events/auth-logged-out.event.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

const signInEventSchema = z.object({ provider: z.literal("github") });

@Controller("auth")
@UseGuards(SupabaseAuthGuard)
export class AuthController {
  constructor(@Inject(EventBus) private readonly eventBus: EventBus) {}

  @Post("sign-in-event")
  @HttpCode(200)
  signInEvent(
    @CurrentUser() userId: string,
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
      new AuthLoggedInEvent(userId, parsed.data.provider),
    );
    return { ok: true };
  }

  @Post("sign-out")
  @HttpCode(200)
  signOut(@CurrentUser() userId: string): { ok: true } {
    this.eventBus.publish(new AuthLoggedOutEvent(userId));
    return { ok: true };
  }
}
