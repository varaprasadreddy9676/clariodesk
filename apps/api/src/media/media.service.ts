import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@clariodesk/db";
import { ObjectStorage } from "@clariodesk/storage";
import { TOKENS } from "../tokens.js";
import type { AuthUser } from "../common/auth-context.js";
import { AccessService } from "../common/access.service.js";
import { AuditService } from "../common/audit.service.js";

@Injectable()
export class MediaService {
  constructor(
    @Inject(TOKENS.DB) private readonly db: Database,
    @Inject(TOKENS.STORAGE) private readonly storage: ObjectStorage,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Issue a short-lived signed download URL — only after verifying the user may
   * access the owning channel (TDD §9.4). The URL is never public.
   */
  async signedUrl(user: AuthUser, mediaId: string) {
    const rows = await this.db
      .select({
        channelId: schema.messageMedia.channelId,
        storageKey: schema.messageMedia.storageKey,
        storageStatus: schema.messageMedia.storageStatus,
        fileName: schema.messageMedia.fileName,
        mimeType: schema.messageMedia.mimeType,
      })
      .from(schema.messageMedia)
      .where(
        and(
          eq(schema.messageMedia.id, mediaId),
          eq(schema.messageMedia.workspaceId, user.workspaceId),
        ),
      )
      .limit(1);
    const media = rows[0];
    if (!media) throw new NotFoundException("Media not found");
    await this.access.assertChannelAccess(user, media.channelId);

    if (media.storageStatus !== "downloaded" || !media.storageKey) {
      throw new BadRequestException(
        `Media is not available (status: ${media.storageStatus})`,
      );
    }

    const url = await this.storage.signedMediaUrl(media.storageKey, 300);
    await this.audit.record({
      workspaceId: user.workspaceId,
      actorUserId: user.userId,
      action: "media.downloaded",
      targetType: "media",
      targetId: mediaId,
    });
    return {
      url,
      fileName: media.fileName,
      mimeType: media.mimeType,
      expiresInSeconds: 300,
    };
  }
}
