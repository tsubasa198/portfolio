import { describe, expect, it } from "vitest";
// @ts-expect-error Node組み込み型を開発依存へ持ち込まないため、この検査だけ型解決を省く。
import { readFileSync } from "node:fs";
import pageHtml from "../../index.html?raw";
import rippleSource from "./heroRipple.ts?raw";
import introSource from "./intro.ts?raw";
import { isRippleDisabled } from "./heroRipple";

const mainStyles = readFileSync(
  new URL("../styles/main.css", import.meta.url),
  "utf8",
);

const ruleBody = (selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [
    ...mainStyles.matchAll(
      new RegExp(`(^|\\n|,)\\s*${escaped}\\s*(\\{|,)`, "g"),
    ),
  ];
  if (matches.length === 0) {
    throw new Error(`CSSルール ${selector} が見つかりません`);
  }
  return matches
    .map((match) => {
      const open = mainStyles.indexOf("{", match.index!);
      const close = mainStyles.indexOf("}", open);
      return mainStyles.slice(open + 1, close);
    })
    .join("\n");
};

describe("ステージ起点の波紋", () => {
  it("波紋レイヤーとリングがDOMにある", () => {
    expect(pageHtml).toContain("js-hero-ripple");
    expect(pageHtml.match(/hero-ripple__ring/g)?.length).toBeGreaterThanOrEqual(
      3,
    );
    expect(pageHtml).toContain("hero-ripple__core");
  });

  it("発生源をステージ中心へ固定する", () => {
    // 台座の配置と同じ値を共有し、動画側のステージ波紋とも重なるようにする
    expect(mainStyles).toContain("--hero-stage-center-x");
    expect(mainStyles).toContain("--hero-stage-center-y");
    const ring = ruleBody(".hero-ripple__ring,\n.hero-ripple__core");
    expect(ring).toContain("left: var(--hero-stage-center-x)");
    expect(ring).toContain("top: var(--hero-stage-center-y)");
  });

  it("ステージ中心の値が台座レイヤーの配置と一致する", () => {
    const stageX = mainStyles.match(/--hero-stage-center-x:\s*([\d.]+)%/)?.[1];
    const stageY = mainStyles.match(/--hero-stage-center-y:\s*([\d.]+)%/)?.[1];
    const platform = ruleBody(".hero-layer--platform");
    const platformX = platform.match(/left:\s*([\d.]+)%/)?.[1];
    const platformY = platform.match(/top:\s*([\d.]+)%/)?.[1];
    expect(stageX).toBe(platformX);
    expect(stageY).toBe(platformY);
  });

  it("下の絵を消さずに光だけを重ねる", () => {
    expect(ruleBody(".hero-ripple")).toContain("mix-blend-mode: screen");
  });

  it("他のレイヤーと同じ座標系に載せ、発生源が台座からずれないようにする", () => {
    // 画面基準で置くと、画面比率が16:9から外れたときに中心がずれる
    const ripple = ruleBody(".hero-ripple");
    expect(ripple).toContain("var(--hero-world-width)");
    expect(ripple).toContain("var(--hero-world-height)");
    // モバイルの右寄せも他のレイヤーと同じ計算を共有する
    expect(mainStyles).toMatch(
      /\.hero-ripple\s*\{\s*\n\s*left:\s*calc\(\(100vw - var\(--hero-world-width\)\) \* 0\.83\)/,
    );
  });

  it("白いフラッシュではなくオレンジ〜アンバーの発光リングにする", () => {
    const ring = ruleBody(".hero-ripple__ring");
    // 塗りつぶしではなく輪。中心と外側が抜けている。
    expect(ring).toContain("radial-gradient");
    expect(ring).toMatch(/transparent[\s\S]*rgba\(255,\s*1\d\d/);
    // 白(255,255,255)は使わない
    expect(ring).not.toMatch(/rgba\(255,\s*255,\s*255/);
    expect(ring).toContain("blur(");
  });

  it("マスコットより前面で画面を覆う", () => {
    const rippleZ = Number(
      ruleBody(".hero-ripple").match(/z-index:\s*(\d+)/)?.[1],
    );
    const mascotZ = Number(
      ruleBody(".hero-idle-mascot").match(/z-index:\s*(\d+)/)?.[1],
    );
    expect(rippleZ).toBeGreaterThan(mascotZ);
  });
});

describe("波紋のタイミング", () => {
  it("スクロール開始直後に出はじめ、動画へ渡した後は消える", () => {
    expect(rippleSource).toMatch(/RIPPLE_START\s*=\s*0\.00\d/);
    expect(rippleSource).toMatch(/RIPPLE_END\s*=\s*0\.0\d+/);
  });

  it("ピークをハンドオフ位置に合わせる", () => {
    // 波紋が最も強い瞬間にalphaを入れ替えることで切り替えを隠す
    expect(rippleSource).toContain("heroIdleHandoffEnd");
    expect(rippleSource).toContain("overallIntensity");
  });

  it("リングは位相をずらして複数本が同時に見える", () => {
    const offsets = rippleSource.match(/RING_PHASE_OFFSETS\s*=\s*\[([^\]]+)\]/);
    expect(offsets).toBeTruthy();
    const values = offsets![1].split(",").map((v) => Number(v.trim()));
    expect(values).toHaveLength(3);
    // 間隔が広すぎると1本ずつしか見えず波紋にならない
    expect(Math.max(...values)).toBeLessThanOrEqual(0.4);
  });

  it("スクロール進捗へ接続され、破棄もされる", () => {
    expect(introSource).toContain("initHeroRipple");
    expect(introSource).toContain("ripple?.setProgress");
    expect(introSource).toContain("ripple?.destroy()");
  });
});

describe("波紋あり/なしの比較", () => {
  it("?heroRipple=off で無効化できる", () => {
    expect(isRippleDisabled("?heroRipple=off")).toBe(true);
    expect(isRippleDisabled("?heroRipple=on")).toBe(false);
    expect(isRippleDisabled("")).toBe(false);
  });
});
