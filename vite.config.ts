import { defineConfig } from "vite";

export const LOCAL_PORT = 5199;

export default defineConfig({
  server: {
    host: "localhost",
    port: LOCAL_PORT,
    strictPort: true,
  },
  preview: {
    host: "localhost",
    port: LOCAL_PORT,
    strictPort: true,
  },
  build: {
    target: "es2022",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
