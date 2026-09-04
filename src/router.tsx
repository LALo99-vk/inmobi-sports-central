import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start the loader when a link is hovered or touched rather than when it is
    // clicked. The sheet read behind these pages takes a second or two cold, and
    // that was all being paid after the click.
    defaultPreload: "intent",
    // Preloading buys nothing at 0: the data would be stale the instant it
    // arrived and the click would fetch it all over again. The server caches the
    // sheet for 60s anyway, so nothing fresher exists within this window.
    // useAutoRefresh calls router.invalidate(), which ignores this and always
    // refetches, so live scores still land on their own.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
