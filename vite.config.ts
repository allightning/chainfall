import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  server: { port: 5173, strictPort: true },
  build: {
    target: "es2022",
    sourcemap: false,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
