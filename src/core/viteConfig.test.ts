import { describe, expect, it } from "vitest";
import viteConfig, { LOCAL_PORT } from "../../vite.config";

describe("Vite localhost設定", () => {
  it("開発サーバーをlocalhost:5199へ固定する", () => {
    expect(LOCAL_PORT).toBe(5199);
    expect(viteConfig).toMatchObject({
      server: {
        host: "localhost",
        port: 5199,
        strictPort: true,
      },
    });
  });

  it("プレビューもlocalhost:5199へ固定する", () => {
    expect(viteConfig).toMatchObject({
      preview: {
        host: "localhost",
        port: 5199,
        strictPort: true,
      },
    });
  });
});
