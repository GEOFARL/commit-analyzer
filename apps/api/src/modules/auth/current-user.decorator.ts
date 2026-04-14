import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

import { getAuthUserId } from "../../common/request-context.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, _ctx: ExecutionContext): string => {
    const userId = getAuthUserId();
    if (!userId) throw new UnauthorizedException("no authenticated user");
    return userId;
  },
);
