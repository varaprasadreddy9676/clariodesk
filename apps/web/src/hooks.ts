import { useCallback, useEffect, useState } from "react";

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
  }, deps);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
