import { copyFile, writeFile } from "node:fs/promises";

// GitHub Pages has no SPA rewrite. Copying index.html to 404.html lets the
// client router handle deep links such as /app/courses and /auth/callback.
await copyFile("dist/index.html", "dist/404.html");
await writeFile("dist/.nojekyll", "");
