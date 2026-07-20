import { describe, expect, it } from "vitest";
// @ts-expect-error Node組み込み型を開発依存へ持ち込まないため、この検査だけ型解決を省く。
import { existsSync, statSync } from "node:fs";
import {
  TRANSITION_CONFIG,
  integratedVideoTimesAt,
} from "./portalTransitionConfig";
import timelineSource from "./portalTransitionTimeline.ts?raw";
import introSource from "./intro.ts?raw";
import settleSource from "./heroIdleSettle.ts?raw";
import calibrationSource from "./heroCalibration.ts?raw";

/** 実際に使っている動画の尺。時刻マッピングの検証に使う。 */
const EXISTING_DURATION = 8;
const ADDITIONAL_DURATION = 8;

describe("動画先頭フレームへの固定", () => {
  it("位置合わせの基準となる先頭フレームが生成されている", () => {
    const path = new URL(
      "../../public/assets/hero/hero-video-first-frame.webp",
      import.meta.url,
    );
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(1024);
  });

  it("ハンドオフが終わるまで動画は先頭フレームに留まる", () => {
    // 静止レイヤーは動画の0秒の絵へ合わせてある。ここで動画が進むと
    // 背面には数フレーム先の絵があることになり、切り替えで飛んで見える。
    for (const progress of [
      0,
      0.004,
      0.008,
      0.013,
      TRANSITION_CONFIG.heroIdleHandoffEnd,
    ]) {
      const { existingTime } = integratedVideoTimesAt(
        progress,
        EXISTING_DURATION,
        ADDITIONAL_DURATION,
      );
      expect(existingTime).toBe(0);
    }
  });

  it("ハンドオフ完了後は動画が進み始める", () => {
    const { existingTime } = integratedVideoTimesAt(
      TRANSITION_CONFIG.heroIdleHandoffEnd + 0.02,
      EXISTING_DURATION,
      ADDITIONAL_DURATION,
    );
    expect(existingTime).toBeGreaterThan(0);
  });
});

describe("姿勢の収束", () => {
  it("収束はalphaの入れ替えより前に終わる", () => {
    expect(TRANSITION_CONFIG.heroIdleSettleEnd).toBeGreaterThan(0);
    expect(TRANSITION_CONFIG.heroIdleSettleEnd).toBeLessThan(
      TRANSITION_CONFIG.heroIdleHandoffEnd,
    );
  });

  it("alphaの入れ替えは収束後の短い区間で行う", () => {
    const swapLength =
      TRANSITION_CONFIG.heroIdleHandoffEnd -
      TRANSITION_CONFIG.heroIdleSettleEnd;
    expect(swapLength).toBeGreaterThan(0);
    // 長いクロスフェードで位置ずれをごまかさない
    expect(swapLength).toBeLessThanOrEqual(0.012);
  });

  it("静止レイヤーもマスコットも収束後にalphaを入れ替える", () => {
    expect(timelineSource).toMatch(
      /\.to\(\s*heroIdleMascot,[\s\S]*?config\.heroIdleSettleEnd,/,
    );
    expect(timelineSource).toMatch(
      /\.to\(\s*heroIdleVisualLayers,[\s\S]*?config\.heroIdleSettleEnd,/,
    );
  });

  it("ハンドオフでマスコットを動かしたりぼかしたりしない", () => {
    // 位置やぼけを足すと、その分だけ動画とずれる
    const mascotStep = timelineSource.match(
      /\.to\(\s*heroIdleMascot,\s*\{[\s\S]*?\},\s*config\.heroIdleSettleEnd/,
    )?.[0];
    expect(mascotStep).toBeDefined();
    expect(mascotStep).not.toMatch(/\by:\s*-?\d/);
    expect(mascotStep).not.toMatch(/blur\(/);
  });

  it("待機アニメーションは姿勢を保ったまま止めてから基準姿勢へ戻す", () => {
    // animationをいきなり外すと姿勢が初期値へ飛ぶ
    expect(settleSource).toContain("getComputedStyle");
    expect(settleSource).toMatch(/animation.*=\s*"none"/);
    expect(settleSource).toContain("transition");
    // 逆スクロールで待機へ戻せること
    expect(settleSource).toContain("removeProperty");
  });

  it("収束対象にマスコット・ポータル・パネル・球体が含まれる", () => {
    for (const selector of [
      ".hero-idle-mascot__jump",
      ".hero-idle-mascot__shadow",
      ".hero-layer--portal",
      ".hero-layer--orbit",
      ".hero-panel",
      ".hero-sphere",
    ]) {
      expect(settleSource).toContain(selector);
    }
  });

  it("スクロール進捗へ接続され、破棄も行われる", () => {
    expect(introSource).toContain("initHeroIdleSettle");
    expect(introSource).toContain("idleSettle.setProgress");
    expect(introSource).toContain("idleSettle.destroy()");
  });
});

describe("位置合わせモード", () => {
  it("URLパラメータでのみ有効になる", () => {
    expect(calibrationSource).toContain("heroCalibration");
    expect(calibrationSource).toMatch(/=== "1"/);
  });

  it("重ね・点滅・差分の比較手段を備える", () => {
    for (const mode of [
      "overlay",
      "blink",
      "difference",
      "layers",
      "reference",
    ]) {
      expect(calibrationSource).toContain(`"${mode}"`);
    }
  });

  it("参照フレームは動画と同じ矩形・object-fitで敷く", () => {
    expect(calibrationSource).toContain("hero-video-first-frame.webp");
  });
});
