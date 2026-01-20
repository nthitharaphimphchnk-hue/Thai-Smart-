import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown, queryKey?: unknown[]) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Don't redirect if it's auth.me query - it's a public procedure that can return null
  // Only redirect on protected procedures that require authentication
  const isAuthMeQuery = Array.isArray(queryKey) && 
    queryKey.length >= 2 && 
    queryKey[0] === "auth" && 
    queryKey[1] === "me";

  if (isAuthMeQuery) {
    console.log("[Auth] auth.me query failed - user not authenticated (this is OK)");
    return;
  }

  // Don't redirect if we're already on login/register page
  const currentPath = window.location.pathname;
  if (currentPath === "/login" || currentPath === "/register") {
    return;
  }

  // Check if user data exists in localStorage (recently logged in)
  try {
    const userData = localStorage.getItem("manus-runtime-user-info");
    if (userData && JSON.parse(userData)) {
      console.log("[Auth] User data exists in localStorage, skipping redirect");
      return;
    }
  } catch {
    // Ignore parse errors
  }

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    const queryKey = event.query.queryKey;
    redirectToLoginIfUnauthorized(error, queryKey);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
