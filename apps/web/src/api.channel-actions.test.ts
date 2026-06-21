import { afterEach, describe, expect, it, vi } from "vitest";
import { ClarioApiClient } from "./api.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ClarioApiClient channel actions", () => {
  it("sends target state to the synchronized action endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ channelId: "channel-1" }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ClarioApiClient(() => ({
      token: "token",
      userId: "user-1",
      workspaceId: "workspace-1",
      role: "admin",
    }));

    await api.applyChannelAction("channel-1", {
      action: "archive",
      archived: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/channels/channel-1/actions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "archive", archived: true }),
      }),
    );
  });

  it("clears the current user's explicit unread marker", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ isMarkedUnread: false }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ClarioApiClient(() => ({
      token: "token",
      userId: "user-1",
      workspaceId: "workspace-1",
      role: "viewer",
    }));

    await api.clearChannelUnread("channel-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/channels/channel-1/read-state",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ markedUnread: false }),
      }),
    );
  });
});
