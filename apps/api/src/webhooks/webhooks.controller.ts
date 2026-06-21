import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { GatewayAdapterType } from "@clariodesk/types";
import { WebhookSecretGuard } from "./webhook-secret.guard.js";
import { WebhooksService } from "./webhooks.service.js";

@Controller("gateway-webhooks")
@UseGuards(WebhookSecretGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  /** Gateway posts events here. Must authenticate, persist, enqueue, return fast. */
  @Post(":adapterType/:phoneInstanceId")
  ingest(
    @Param("adapterType") adapterType: string,
    @Param("phoneInstanceId") phoneInstanceId: string,
    @Body() payload: unknown,
  ): Promise<{ accepted: number }> {
    if (!isAdapterType(adapterType)) {
      throw new BadRequestException(`Unknown adapter type '${adapterType}'`);
    }
    return this.webhooks.ingest(adapterType, phoneInstanceId, payload);
  }
}

function isAdapterType(value: string): value is GatewayAdapterType {
  return value === "clario_gateway";
}
