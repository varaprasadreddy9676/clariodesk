import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { CoreModule } from "./core/core.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { WebhooksModule } from "./webhooks/webhooks.module.js";
import { ChannelsModule } from "./channels/channels.module.js";
import { MessagesModule } from "./messages/messages.module.js";
import { OutboxModule } from "./outbox/outbox.module.js";
import { TicketsModule } from "./tickets/tickets.module.js";
import { ClientsModule } from "./clients/clients.module.js";
import { PhonesModule } from "./phones/phones.module.js";
import { TeamModule } from "./team/team.module.js";
import { ContactsModule } from "./contacts/contacts.module.js";
import { MediaModule } from "./media/media.module.js";
import { SearchModule } from "./search/search.module.js";
import { OpsModule } from "./ops/ops.module.js";
import { HealthController } from "./health.controller.js";
import { ConversationsModule } from "./conversations/conversations.module.js";
import { PushModule } from "./push/push.module.js";
import { CannedResponsesModule } from "./canned-responses/canned-responses.module.js";
import { AiModule } from "./ai/ai.module.js";
import { AuditLogModule } from "./audit/audit-log.module.js";

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    CoreModule,
    AuthModule,
    WebhooksModule,
    ChannelsModule,
    MessagesModule,
    OutboxModule,
    TicketsModule,
    ClientsModule,
    PhonesModule,
    TeamModule,
    ContactsModule,
    MediaModule,
    SearchModule,
    OpsModule,
    ConversationsModule,
    PushModule,
    CannedResponsesModule,
    AiModule,
    AuditLogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
