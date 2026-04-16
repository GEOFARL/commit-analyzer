import { applyDecorators } from "@nestjs/common";
import { SkipThrottle, Throttle } from "@nestjs/throttler";

import { THROTTLE_TIERS, type ThrottleTier } from "./tiers.js";

/**
 * Activates a single named throttle tier and skips the rest.
 *
 * Sets explicit skip=false for the active tier so method-level decorators
 * correctly override class-level skip metadata (the guard uses
 * `getAllAndOverride` which falls through to class when handler is unset).
 */
export const ThrottleTierDecorator = (tier: ThrottleTier) => {
  const skip: Record<string, boolean> = {};
  const throttle: Record<string, { limit: number; ttl: number }> = {};

  for (const [name, def] of Object.entries(THROTTLE_TIERS)) {
    if (name === tier) {
      skip[name] = false;
      throttle[name] = { limit: def.limit, ttl: def.ttl };
    } else {
      skip[name] = true;
    }
  }

  return applyDecorators(SkipThrottle(skip), Throttle(throttle));
};
