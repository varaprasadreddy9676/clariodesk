import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "idle" | "loading"; data: T | null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | null; error: string };

export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({
    status: "idle",
    data: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return load();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let current = true;
    setState((prev) => ({ status: "loading", data: prev.data, error: null }));
    refresh()
      .then((data) => {
        if (current) setState({ status: "success", data, error: null });
      })
      .catch((err: unknown) => {
        if (current)
          setState((prev) => ({
            status: "error",
            data: prev.data,
            error: err instanceof Error ? err.message : "Request failed",
          }));
      });
    return () => {
      current = false;
    };
  }, [refresh]);

  // Expose a manual refresh that also guards against stale responses
  const refreshGuarded = useCallback(async () => {
    setState((prev) => ({ status: "loading", data: prev.data, error: null }));
    try {
      const data = await load();
      setState({ status: "success", data, error: null });
    } catch (err) {
      setState((prev) => ({
        status: "error",
        data: prev.data,
        error: err instanceof Error ? err.message : "Request failed",
      }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, refresh: refreshGuarded };
}

// Keeps a ref in sync with the latest value — use in callbacks that close over
// async data so they always call the most recent refresh, not a stale one.
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
