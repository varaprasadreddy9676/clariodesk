import { gzipSync } from "node:zlib";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  mediaBucket: string;
  rawEventBucket: string;
};

/**
 * Thin S3/MinIO wrapper (TDD §9.4, §23.3). Private buckets, short-lived signed
 * URLs, no public links. The only place the app talks to object storage.
 */
export class ObjectStorage {
  private readonly s3: S3Client;
  readonly mediaBucket: string;
  readonly rawEventBucket: string;

  constructor(cfg: StorageConfig) {
    this.s3 = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    this.mediaBucket = cfg.mediaBucket;
    this.rawEventBucket = cfg.rawEventBucket;
  }

  /**
   * Ensure both buckets exist (idempotent). Safe to call on boot — useful when
   * running against a fresh S3/MinIO without the compose init job (TDD §21.1).
   */
  async ensureBuckets(): Promise<void> {
    await Promise.all(
      [this.mediaBucket, this.rawEventBucket].map((bucket) =>
        this.ensureBucket(bucket),
      ),
    );
  }

  private async ensureBucket(bucket: string): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch {
        // Bucket may have been created concurrently, or perms disallow create
        // (managed S3 where the bucket already exists). Non-fatal.
      }
    }
  }

  /** Compress + store a raw gateway payload. Returns the byte size stored. */
  async putRawEvent(key: string, payload: unknown): Promise<number> {
    const gz = gzipSync(Buffer.from(JSON.stringify(payload)));
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.rawEventBucket,
        Key: key,
        Body: gz,
        ContentType: "application/gzip",
      }),
    );
    return gz.byteLength;
  }

  async putMedia(
    key: string,
    bytes: Uint8Array,
    contentType?: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.mediaBucket,
        Key: key,
        Body: bytes,
        ...(contentType ? { ContentType: contentType } : {}),
      }),
    );
  }

  /** Hard-delete a media object (retention purge, TDD §17.4). */
  async deleteMedia(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.mediaBucket, Key: key }),
    );
  }

  /** Hard-delete a raw-event payload object (retention purge, TDD §17.1). */
  async deleteRawEvent(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.rawEventBucket, Key: key }),
    );
  }

  /** Short-lived signed download URL — issue ONLY after a permission check. */
  async signedMediaUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.mediaBucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
