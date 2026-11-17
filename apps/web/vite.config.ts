import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Server-side env for dev and builds: apps/web/.env (auth), then
// packages/data/.env (DATABASE_URL), so there's one copy of each value. Real
// env vars win, and missing files are fine (Vercel sets real env vars).
for (const file of [".env", "../../packages/data/.env"]) {
  try {
    process.loadEnvFile(new URL(file, import.meta.url));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
}

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
