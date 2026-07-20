import { describe, expect, it } from "vitest";
// テスト実行環境はNodeだが、本番バンドルへ不要な@types/nodeは追加しない。
// @ts-expect-error Node組み込み型を開発依存へ持ち込まないため、この検査だけ型解決を省く。
import { existsSync, readFileSync, statSync } from "node:fs";
import pageHtml from "../../index.html?raw";
import timelineSource from "./portalTransitionTimeline.ts?raw";
import introSource from "./intro.ts?raw";

const mainStyles = readFileSync(
  new URL("../styles/main.css", import.meta.url),
  "utf8",
);

const assetPath = (name: string) =>
  new URL(`../../public/assets/hero/${name}`, import.meta.url);

/** ファーストビューを構成する分解レイヤー。奥から手前の順。 */
const LAYERS = [
  { key: "background", asset: "hero-background.webp", blend: "normal" },
  { key: "portal", asset: "hero-portal.webp", blend: "screen" },
  { key: "orbit", asset: "hero-orbit-particles.webp", blend: "screen" },
  { key: "platform", asset: "hero-platform.webp", blend: "normal" },
  {
    key: "panel-left-top",
    asset: "hero-ui-panel-code-tilted.webp",
    blend: "screen",
  },
  {
    key: "panel-right-middle",
    asset: "hero-ui-panel-chart.webp",
    blend: "screen",
  },
  {
    key: "panel-right-bottom",
    asset: "hero-ui-panel-code.webp",
    blend: "screen",
  },
  {
    key: "sphere-front-left",
    asset: "hero-sphere-bright.webp",
    blend: "screen",
  },
  {
    key: "sphere-front-right",
    asset: "hero-sphere-glass.webp",
    blend: "screen",
  },
] as const;

/**
 * CSSルールの本文を取り出す。
 * 同じセレクタが複合セレクタと単独ルールの両方に現れることがあるため、
 * 一致するルールをすべて連結して返す。
 */
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
  // セレクタ位置から、それが属するルールの本文を取り出す
  const bodies = matches.map((match) => {
    const open = mainStyles.indexOf("{", match.index!);
    const close = mainStyles.indexOf("}", open);
    return mainStyles.slice(open + 1, close);
  });
  return bodies.join("\n");
};

const zIndexOf = (selector: string): number => {
  const matched = ruleBody(selector).match(/z-index:\s*(-?\d+)/);
  if (!matched) throw new Error(`${selector} に z-index がありません`);
  return Number(matched[1]);
};

describe("ファーストビューのアセット", () => {
  it.each(LAYERS.map((layer) => layer.asset))("%s が存在する", (asset) => {
    expect(existsSync(assetPath(asset))).toBe(true);
  });

  it.each(LAYERS.map((layer) => layer.asset))(
    "%s が空ファイルではない",
    (asset) => {
      expect(statSync(assetPath(asset)).size).toBeGreaterThan(1024);
    },
  );

  it("WebP形式で書き出されている", () => {
    for (const { asset } of LAYERS) {
      const header = readFileSync(assetPath(asset)).subarray(0, 12);
      expect(header.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(header.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
  });

  it("ファーストビュー全体が旧背景1枚(1.5MB)より軽い", () => {
    const total = LAYERS.reduce(
      (sum, { asset }) => sum + statSync(assetPath(asset)).size,
      0,
    );
    expect(total).toBeLessThan(1_500_000);
  });
});

describe("レイヤーの重なり順", () => {
  it("背景 < ポータル < 軌道 < 台座・UIパネル < マスコット < 前景球体", () => {
    const background = zIndexOf(".hero-idle-background");
    const portal = zIndexOf(".hero-layer--portal");
    const orbit = zIndexOf(".hero-layer--orbit");
    const platform = zIndexOf(".hero-layer--platform");
    const panel = zIndexOf(".hero-panel");
    const mascot = zIndexOf(".hero-idle-mascot");
    const sphere = zIndexOf(".hero-sphere");

    expect(background).toBeLessThan(portal);
    expect(portal).toBeLessThan(orbit);
    expect(orbit).toBeLessThan(platform);
    expect(platform).toBeLessThanOrEqual(panel);
    // マスコットが台座に埋まらず、UIパネルに顔を覆われない
    expect(panel).toBeLessThan(mascot);
    // 手前の光球だけがマスコットより前を通る
    expect(mascot).toBeLessThan(sphere);
  });

  it("発光素材はscreen、非発光の台座は通常合成にする", () => {
    expect(ruleBody(".hero-layer")).toContain(
      "mix-blend-mode: screen",
    );
    // 台座は金属。screenだと暗部が浮いて質感が壊れる。
    expect(ruleBody(".hero-layer--platform")).toContain(
      "mix-blend-mode: normal",
    );
  });

  it("blendがページ全体へ漏れないよう親でisolationする", () => {
    expect(ruleBody(".portal-camera")).toContain("isolation: isolate");
  });

  it("ラッパーはstacking contextを作らない", () => {
    // z-index・translate・opacityのいずれかを持つと内側のscreenが
    // 背景と混ざれなくなり、黒い矩形が出てしまう
    const wrapper = ruleBody(".hero-detail-layer");
    expect(wrapper).not.toMatch(/z-index:/);
    expect(wrapper).not.toMatch(/translate:/);
    expect(wrapper).not.toMatch(/opacity:/);
  });
});

describe("動画へのハンドオフ", () => {
  it("全レイヤーがDOMに存在し、ハンドオフ対象の内側にある", () => {
    for (const { key } of LAYERS) {
      expect(pageHtml).toContain(`data-hero-layer="${key}"`);
    }
    // 背景は単独、それ以外は2つのラッパーのどちらかに属する
    expect(pageHtml).toContain("js-hero-detail-layer");
    expect(pageHtml).toContain("js-hero-foreground-layer");
  });

  it("背景・分解レイヤー・前景をまとめて1つのターゲットにする", () => {
    expect(timelineSource).toContain("heroIdleVisualLayers");
    expect(timelineSource).toMatch(
      /heroIdleVisualLayers[\s\S]*?heroIdleBackground[\s\S]*?heroDetailLayer[\s\S]*?heroForegroundLayer/,
    );
    // ラッパーではなく個々の画像を対象にする（stacking context対策）
    expect(timelineSource).toContain(
      'querySelectorAll<HTMLElement>("[data-hero-layer]")',
    );
  });

  it("静止レイヤーは冒頭のハンドオフ区間で一斉に消える", () => {
    // 一部だけ遅れて消えると動画の上に取り残される
    expect(timelineSource).toMatch(
      /\.to\(\s*heroIdleVisualLayers,[\s\S]*?duration:\s*config\.heroIdleHandoffEnd/,
    );
    expect(timelineSource).not.toMatch(
      /\.to\(\s*heroDetailLayer,[\s\S]*?autoAlpha:\s*0/,
    );
  });

  it("前景レイヤーがタイムラインへ渡されている", () => {
    expect(introSource).toContain('".js-hero-foreground-layer"');
    expect(introSource).toContain("heroForegroundLayer");
    expect(timelineSource).toContain("readonly heroForegroundLayer");
  });

  it("マスコットの待機アニメーションを維持する", () => {
    expect(mainStyles).toContain("hero-idle-jump");
    expect(mainStyles).toContain("hero-idle-shadow");
    expect(pageHtml).toContain("hero-idle-mascot__jump");
    expect(pageHtml).toContain("hero-idle-mascot__shadow");
    // マスコット素材は差し替えない
    expect(pageHtml).toContain("/assets/hero/hero-mascot-idle-alpha.png");
  });
});

describe("待機アニメーション", () => {
  it("transformとopacityを奪わず独立プロパティで動かす", () => {
    // GSAPがハンドオフでtransform/opacityを操作するため、
    // CSSアニメーション側が奪うとフェードアウトが効かなくなる
    const keyframes = mainStyles.match(
      /@keyframes hero-(portal-breathe|orbit-drift|panel-float|sphere-float)\s*\{[\s\S]*?\n\}/g,
    );
    expect(keyframes).toHaveLength(4);
    for (const frame of keyframes!) {
      expect(frame).not.toMatch(/[^-]transform:/);
      expect(frame).not.toMatch(/[^-]opacity:/);
    }
  });

  it("モーション低減時は全レイヤーのアニメーションを止める", () => {
    expect(mainStyles).toMatch(
      /body\.reduced-motion \.hero-foreground-layer \*/,
    );
    expect(mainStyles).toMatch(/body\.reduced-motion \.hero-detail-layer \*/);
  });

  it("全レイヤーが同じポータル中心を基準に拡大する", () => {
    expect(mainStyles).toContain("--hero-portal-origin-x");
    expect(mainStyles).toContain("--hero-portal-origin-y");
    expect(ruleBody(".hero-layer")).toContain(
      "transform-origin: var(--hero-portal-origin-x) var(--hero-portal-origin-y)",
    );
  });

  it("スクロールズームで画像の端が覗かないようオーバースキャンする", () => {
    expect(mainStyles).toMatch(/--hero-world-width:\s*max\(106vw/);
    expect(mainStyles).toMatch(/--hero-world-height:\s*max\(106svh/);
    expect(ruleBody(".portal-camera")).toContain("overflow: hidden");
  });
});
