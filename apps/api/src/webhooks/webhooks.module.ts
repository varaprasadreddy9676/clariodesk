import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller.js";
import { WebhooksService } from "./webhooks.service.js";
import { WebhookSecretGuard } from "./webhook-secret.guard.js";

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSecretGuard],
})
export class WebhooksModule {}
