import pino, { type Logger } from "pino";

/**
 * Structured JSON logging (TDD §22.1). Every log line should carry workspace /
 * phone / channel / request / job context. Use {@link childLogger} to bind that
 * context once per request or job rather than threading it through call sites.
 */
export type LogContext = {
  workspace_id?: string;
  phone_instance_id?: string;
  channel_id?: string;
  request_id?: string;
  job_id?: string;
  adapter_type?: string;
};

export function createLogger(level = "info"): Logger {
  return pino({
    level,
    base: { service: "clariodesk" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      // Never leak secrets/tokens into logs.
      paths: [
        "*.password",
        "*.token",
        "*.apiKey",
        "*.api_key",
        "*.secret",
        "*.authorization",
        "req.headers.authorization",
      ],
      censor: "[redacted]",
    },
  });
}

export function childLogger(parent: Logger, ctx: LogContext): Logger {
  return parent.child(ctx);
}

export type { Logger };
