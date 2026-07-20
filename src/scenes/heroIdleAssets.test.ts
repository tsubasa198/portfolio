import { describe, expect, it } from "vitest";
// @ts-expect-error Node組み込み型を本番依存へ追加せず、素材契約だけを検証する。
import { readFileSync } from "node:fs";

function pngInfo(relativePath: string) {
  const bytes = readFileSync(new URL(relativePath, import.meta.url));
  return {
    signature: bytes.subarray(1, 4).toString("ascii"),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  };
}

describe("Hero待機素材", () => {
  it("マスコットは実アルファを持つ十分な解像度のPNGである", () => {
    const info = pngInfo("../../public/assets/hero/hero-mascot-idle-alpha.png");
    expect(info.signature).toBe("PNG");
    expect(info.width).toBeGreaterThanOrEqual(1200);
    expect(info.height).toBeGreaterThanOrEqual(1200);
    expect(info.colorType).toBe(6);
  });

  it("待機中に動画内マスコットを隠す高解像度背景プレートを持つ", () => {
    const info = pngInfo("../../public/assets/hero/hero-idle-background.png");
    expect(info.signature).toBe("PNG");
    expect(info.width).toBeGreaterThanOrEqual(1200);
    expect(info.height).toBeGreaterThanOrEqual(675);
  });
});
