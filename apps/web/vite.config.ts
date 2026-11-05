import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

/**
 * Browsers share cookies across every project on `localhost`, so a dev machine
 * can build up request headers larger than Node's 16 KB default. The dev server
 * then answers 431 (Request Header Fields Too Large) before Vite ever sees the
 * request. Raising the limit keeps `npm run dev` usable.
 */
function allowLargeRequestHeaders(): Plugin {
  return {
    name: "allow-large-request-headers",
    apply: "serve",
    configureServer(server) {
      // Node's http.Server accepts this option but @types/node does not expose it.
      const httpServer = server.httpServer as
        | (typeof server.httpServer & { maxHeaderSize?: number })
        | null;
      if (httpServer) httpServer.maxHeaderSize = 64 * 1024;
    },
  };
}

export default defineConfig({
  // Keep one .env file at the repository root (see .env.example), not per workspace.
  envDir: "../../",
  plugins: [react(), tailwind(), allowLargeRequestHeaders()],
  preview: {
    // Allows access through temporary tunnel hostnames for remote previews.
    allowedHosts: true,
  },
});
