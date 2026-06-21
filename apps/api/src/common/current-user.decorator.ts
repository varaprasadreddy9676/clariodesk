import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AuthUser } from "./auth-context.js";

/** Injects the authenticated {@link AuthUser} the JwtAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthUser }>();
    if (!req.user) throw new UnauthorizedException("Not authenticated");
    return req.user;
  },
);
