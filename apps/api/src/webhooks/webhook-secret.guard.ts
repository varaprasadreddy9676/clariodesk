import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { AppConfig } from "@clariodesk/config";
import { TOKENS } from "../tokens.js";

/**
 * Authenticates the gateway, not a user. The gateway must present the shared
 * GATEWAY_WEBHOOK_SECRET via the `x-webhook-secret` header (TDD §25.3).
 */
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(@Inject(TOKENS.CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const provided = req.headers["x-webhook-secret"];
    if (
      typeof provided !== "string" ||
      provided !== this.config.GATEWAY_WEBHOOK_SECRET
    ) {
      throw new UnauthorizedException("Invalid webhook secret");
    }
    return true;
  }
}
