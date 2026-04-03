import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

// Load .env.local for DATABASE_URL
config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
