import { useCallback, useEffect, useState } from "react";
import type { ClarioApiClient } from "./api.js";

export type PushPermissionState =
  | "unsupported"
  | "default"
  | "denied"
  | "granted-off"
  | "granted-on";

/**
 * Manages the browser's Web Push subscription lifecycle: checks support,
 * exposes current permission state, and subscribes/unsubscribes through the
 * API. Never prompts automatically — the caller decides when to ask
 * (browsers ignore/penalize permission prompts fired on page load).
 */
export function usePushSubscription(api: ClarioApiClient) {
  const [state, setState] = useState<PushPermissionState>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const refresh = useCallback(async () => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    if (Notification.permission === "default") {
      setState("default");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    setState(existing ? "granted-on" : "granted-off");
  }, [supported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }
      const { publicKey } = await api.pushVapidPublicKey();
      if (!publicKey) {
        setError("Push notifications aren't configured on this server.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
          .buffer as ArrayBuffer,
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser returned an incomplete subscription");
      }
      await api.pushSubscribe({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      });
      setState("granted-on");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not enable notifications",
      );
    } finally {
      setBusy(false);
    }
  }, [api, supported]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.pushUnsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("granted-off");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not disable notifications",
      );
    } finally {
      setBusy(false);
    }
  }, [api, supported]);

  return { state, busy, error, enable, disable };
}

/** VAPID public keys arrive base64url-encoded; the Push API needs a Uint8Array. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
