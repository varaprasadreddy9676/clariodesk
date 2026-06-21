import { z } from "zod";

/**
 * Single source of truth for environment configuration.
 *
 * Fails fast at startup (CLAUDE.md: "Validate that required secrets are present
 * at startup"). Every runtime process imports `loadConfig()` once and passes the
 * typed result down — no scattered `process.env` reads.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_MEDIA: z.string().min(1),
  S3_BUCKET_RAW_EVENTS: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),

  API_PORT: z.coerce.number().int().positive().default(4000),
  GATEWAY_WEBHOOK_SECRET: z.string().min(8),

  /** base64-encoded 32-byte key for AES-256-GCM secret encryption at rest. */
  ENCRYPTION_KEY: z
    .string()
    .default("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=") // dev only
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message:
        "ENCRYPTION_KEY must decode to 32 bytes (openssl rand -base64 32)",
    }),

  CLARIO_GATEWAY_BASE_URL: z.string().url().default("http://localhost:2786"),
  CLARIO_GATEWAY_API_KEY: z.string().default("dev-clario-gateway-key"),

  /** Comma-separated CORS allowlist; empty = reflect origin in dev. */
  CORS_ORIGINS: z.string().optional(),

  STALE_SYNC_THRESHOLD_SECONDS: z.coerce.number().int().positive().default(900),
  SEND_DELAY_MS: z.coerce.number().int().min(0).default(3000),

  // ── Retention (scheduler) ──
  RAW_EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
  MESSAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
  MEDIA_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
  /** Connected phone unseen this long is marked degraded. */
  PHONE_STALE_MINUTES: z.coerce.number().int().positive().default(30),

  // ── Worker backpressure / reconnect-storm controls ──
  WORKER_NORMALIZE_CONCURRENCY: z.coerce.number().int().positive().default(8),
  /** Max normalization jobs processed per second (DB write backpressure). */
  WORKER_NORMALIZE_MAX_PER_SEC: z.coerce.number().int().positive().default(50),
  /** Max backfill media downloads per second (gateway/S3 backpressure). */
  WORKER_BACKFILL_MEDIA_MAX_PER_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(5),
  /** A normalize batch larger than this is treated as a reconnect storm. */
  RECONNECT_STORM_EVENT_THRESHOLD: z.coerce
    .number()
    .int()
    .positive()
    .default(100),
  /** Per-event throttle (ms) applied while draining a reconnect storm. */
  RECONNECT_STORM_THROTTLE_MS: z.coerce.number().int().min(0).default(25),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | undefined;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n` +
        `See .env.example for the required variables.`,
    );
  }
  // Production hardening: refuse default/weak secrets.
  if (parsed.data.NODE_ENV === "production") {
    if (
      parsed.data.JWT_SECRET.includes("dev-only") ||
      parsed.data.JWT_SECRET.length < 32
    ) {
      throw new Error(
        "JWT_SECRET must be a strong (>=32 char) non-default secret in production.",
      );
    }
    if (
      parsed.data.ENCRYPTION_KEY ===
      "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE="
    ) {
      throw new Error(
        "ENCRYPTION_KEY must be set to a unique value in production (openssl rand -base64 32).",
      );
    }
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — clears the memoized config. */
export function resetConfigCache(): void {
  cached = undefined;
}
