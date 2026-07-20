import { describe, expect, it } from "vitest";
// テスト実行環境はNodeだが、本番バンドルへ不要な@types/nodeは追加しない。
// @ts-expect-error Node組み込み型を開発依存へ持ち込まないため、この検査だけ型解決を省く。
import { readFileSync } from "node:fs";

const alphaVideo = readFileSync(
  new URL(
    "../../public/assets/works-flight/mascot-achievements-alpha.webm",
    import.meta.url,
  ),
);

describe("制作実績遷移のWeb素材", () => {
  it("VP9 alphaのWebMを独立マスコット素材として配置する", () => {
    expect([...alphaVideo.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    expect(alphaVideo.toString("latin1")).toContain("V_VP9");
    expect(alphaVideo.byteLength).toBeGreaterThan(500_000);
  });
});
