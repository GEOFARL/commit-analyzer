import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { z } from "zod";

import { AuthLoggedInEvent } from "./events/auth-logged-in.event.js";
import { AuthLoggedOutEvent } from "./events/auth-logged-out.event.js";

const signInEventSchema = z.object({ provider: z.literal("github") });

@Controller("auth")
export class AuthController {
  constructor(@Inject(EventBus) private readonly eventBus: EventBus) {}

  @Post("sign-in-event")
  @HttpCode(202)
  signInEvent(@Body() body: unknown): { ok: true } {
    const { provider } = signInEventSchema.parse(body);
    this.eventBus.publish(new AuthLoggedInEvent(provider));
    return { ok: true };
  }

  @Post("sign-out")
  @HttpCode(200)
  signOut(): { ok: true } {
    this.eventBus.publish(new AuthLoggedOutEvent());
    return { ok: true };
  }
}
