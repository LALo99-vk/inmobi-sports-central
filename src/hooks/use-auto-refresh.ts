import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Silently re-runs the current route's loader on an interval, so pages
 * backed by the sheet (which itself caches for 60s server-side) stay in
 * sync without the visitor having to reload or hit the manual Refresh button.
 */
export function useAutoRefresh(intervalMs: number) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.invalidate();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
}
