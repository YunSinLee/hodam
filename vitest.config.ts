import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: { environment: "node", globals: false, clearMocks: true },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
