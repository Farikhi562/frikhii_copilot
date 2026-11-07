import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/index.css";
import { AppRoutes } from "./app/router";
import { Toaster } from "./components/ui/Toast";
import { AuthProvider } from "./features/auth/AuthProvider";
import { AuthQueryReset } from "./features/auth/components/AuthQueryReset";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AuthQueryReset />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
