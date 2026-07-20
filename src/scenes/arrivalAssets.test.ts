import { describe, expect, it } from "vitest";
// @ts-expect-error Node組み込み型を本番依存へ追加せず、生成PNGのIHDRだけ検査する。
import { readFileSync } from "node:fs";

const TRANSPARENT_ASSETS = [
  "1-1-alpha.png",
  "1-2-alpha.png",
  "1-3-alpha.png",
  "1-4-alpha.png",
  "1-5-alpha.png",
  "1-6-alpha.png",
  "1-7-alpha.png",
] as const;

describe("到着シーンの分解素材", () => {
  it.each(TRANSPARENT_ASSETS)("%sは真のRGBA PNGである", (filename) => {
    const bytes = readFileSync(
      new URL(`../../public/assets/portal-arrival/${filename}`, import.meta.url),
    );
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    // PNG IHDRのcolor type 6はRGBAを表す。
    expect(bytes[25]).toBe(6);
  });

  it("背景素材は不透明な最背面として保持する", () => {
    const bytes = readFileSync(
      new URL(
        "../../public/assets/portal-arrival/1-8-background.png",
        import.meta.url,
      ),
    );
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    expect(bytes[25]).toBe(2);
  });
});
