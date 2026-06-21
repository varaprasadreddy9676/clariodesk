import { GatewayAdapterFactory } from "@clariodesk/gateway-adapters";
import type { AppConfig } from "@clariodesk/config";

export type { PhoneGatewayCreds } from "@clariodesk/gateway-adapters";

/** Construct the shared gateway factory from app config (env defaults + key). */
export function createAdapterFactory(config: AppConfig): GatewayAdapterFactory {
  return new GatewayAdapterFactory({
    defaultBaseUrl: config.CLARIO_GATEWAY_BASE_URL,
    defaultApiKey: config.CLARIO_GATEWAY_API_KEY,
    defaultsByAdapter: {
      clario_gateway: {
        baseUrl: config.CLARIO_GATEWAY_BASE_URL,
        apiKey: config.CLARIO_GATEWAY_API_KEY,
      },
    },
    encryptionKey: config.ENCRYPTION_KEY,
  });
}

export { GatewayAdapterFactory as AdapterFactory };
