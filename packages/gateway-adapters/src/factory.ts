import { decryptSecret } from "@clariodesk/crypto";
import type { GatewayAdapterType } from "@clariodesk/types";
import { ClarioGatewayAdapter } from "./adapters/clario-gateway.js";
import type { WhatsAppGatewayAdapter } from "./interface.js";

export type PhoneGatewayCreds = {
  adapterType: GatewayAdapterType;
  gatewayBaseUrl: string | null;
  encryptedApiKey: string | null;
};

export type AdapterFactoryOptions = {
  /** Global fallback gateway URL/key when a phone has no per-phone creds. */
  defaultBaseUrl?: string | undefined;
  defaultApiKey?: string | undefined;
  /** Adapter-specific fallback URL/key when a phone has no per-phone creds. */
  defaultsByAdapter?: Partial<
    Record<
      GatewayAdapterType,
      { baseUrl?: string | undefined; apiKey?: string | undefined }
    >
  >;
  /** base64 AES-256-GCM key used to decrypt per-phone API keys. */
  encryptionKey: string;
};

/**
 * Builds gateway adapters, preferring per-phone credentials (base URL +
 * AES-256-GCM-encrypted API key) and falling back to the global defaults.
 * Shared by the API and worker so credential handling lives in one place.
 * Adapters are cached by their resolved (adapterType, baseUrl, apiKey).
 */
export class GatewayAdapterFactory {
  private readonly cache = new Map<string, WhatsAppGatewayAdapter>();

  constructor(private readonly opts: AdapterFactoryOptions) {}

  /** Adapter for pure normalization only — `normalizeWebhook` makes no calls. */
  normalizer(adapterType: GatewayAdapterType): WhatsAppGatewayAdapter {
    this.assertSupported(adapterType);
    const key = `normalizer:${adapterType}`;
    let adapter = this.cache.get(key);
    if (!adapter) {
      adapter = createAdapter(adapterType, "http://unused", "unused");
      this.cache.set(key, adapter);
    }
    return adapter;
  }

  forPhone(phone: PhoneGatewayCreds): WhatsAppGatewayAdapter {
    this.assertSupported(phone.adapterType);
    const adapterDefaults = this.opts.defaultsByAdapter?.[phone.adapterType];
    const baseUrl =
      phone.gatewayBaseUrl ??
      adapterDefaults?.baseUrl ??
      this.opts.defaultBaseUrl;
    const apiKey = phone.encryptedApiKey
      ? decryptSecret(phone.encryptedApiKey, this.opts.encryptionKey)
      : (adapterDefaults?.apiKey ?? this.opts.defaultApiKey);
    if (!baseUrl || !apiKey) {
      throw new Error(
        `${phone.adapterType} gateway is not configured for this phone`,
      );
    }
    const cacheKey = `${phone.adapterType}|${baseUrl}|${apiKey}`;
    let adapter = this.cache.get(cacheKey);
    if (!adapter) {
      adapter = createAdapter(phone.adapterType, baseUrl, apiKey);
      this.cache.set(cacheKey, adapter);
    }
    return adapter;
  }

  private assertSupported(adapterType: GatewayAdapterType): void {
    if (adapterType !== "clario_gateway") {
      throw new Error(
        `Adapter '${adapterType}' is legacy/reference only; Core v1 runtime uses clario_gateway`,
      );
    }
  }
}

function createAdapter(
  adapterType: GatewayAdapterType,
  baseUrl: string,
  apiKey: string,
): WhatsAppGatewayAdapter {
  if (adapterType !== "clario_gateway") {
    throw new Error(
      `Adapter '${adapterType}' is legacy/reference only; Core v1 runtime uses clario_gateway`,
    );
  }
  return new ClarioGatewayAdapter({ baseUrl, apiKey });
}
