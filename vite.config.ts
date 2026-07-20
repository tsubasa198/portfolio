import { defineConfig } from "vite";
import works from "./src/core/works.data.json";

export const LOCAL_PORT = 5199;

/**
 * 制作実績の詳細ページもビルド対象に含める。
 * ページは scripts/build-work-pages.mjs が同じJSONから生成するので、
 * ここもJSONを起点にすれば入力の取りこぼしが起きない。
 */
const workPageInputs = Object.fromEntries(
  works.map((work) => [`works/${work.slug}`, `works/${work.slug}.html`]),
);

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
    rollupOptions: {
      input: {
        main: "index.html",
        ...workPageInputs,
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
