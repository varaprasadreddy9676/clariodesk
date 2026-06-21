import { describe, expect, it, vi } from "vitest";
import type { ObjectStorage } from "@clariodesk/storage";
import type { WhatsAppGatewayAdapter } from "@clariodesk/gateway-adapters";
import { sendProviderMessage } from "./outbox-send.processor.js";

describe("sendProviderMessage", () => {
  it("loads stored bytes and sends media through the adapter", async () => {
    const storage = {
      getMedia: vi.fn(async () => Uint8Array.from([1, 2, 3])),
    } as unknown as ObjectStorage;
    const adapter = {
      sendMedia: vi.fn(async () => ({ providerMessageId: "MEDIA-1" })),
    } as unknown as WhatsAppGatewayAdapter;

    await expect(
      sendProviderMessage({
        adapter,
        storage,
        providerInstanceId: "support-1",
        providerChatId: "919876543210@c.us",
        body: "Proof",
        messageType: "image",
        quotedMessageId: null,
        media: {
          storageKey: "media/key",
          mimeType: "image/png",
          fileName: "proof.png",
        },
      }),
    ).resolves.toEqual({ providerMessageId: "MEDIA-1" });
    expect(adapter.sendMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaBase64: Buffer.from([1, 2, 3]).toString("base64"),
        caption: "Proof",
      }),
    );
  });
});
