import { describe, expect, it } from "vitest";
import {
  ADDITIONAL_POSTER_PATH,
  ADDITIONAL_VIDEO_PATH,
  PORTAL_POSTER_PATH,
  PORTAL_VIDEO_PATH,
  TRANSITION_CONFIG,
  arrivalLayerOpacityAt,
  canvasProfileForViewport,
  integratedVideoTimesAt,
  mascotVideoHandoffTransform,
  portalPhaseAt,
  transitionStateAt,
} from "./portalTransitionConfig";

describe("統合ポータル進行設定", () => {
  it("Heroからヒアリング完成までを指定された7区間で定義する", () => {
    expect([
      0,
      TRANSITION_CONFIG.heroJourneyEnd,
      TRANSITION_CONFIG.existingTunnelEnd,
      TRANSITION_CONFIG.videoBridgeEnd,
      TRANSITION_CONFIG.additionalVideoEnd,
      TRANSITION_CONFIG.stillHandoffEnd,
      TRANSITION_CONFIG.hearingRevealEnd,
      TRANSITION_CONFIG.end,
    ]).toEqual([0, 0.38, 0.44, 0.47, 0.82, 0.89, 0.98, 1]);
  });

  it("2本のWeb用動画とposterを一箇所で定義する", () => {
    expect(PORTAL_VIDEO_PATH).toBe(
      "/assets/portal-tunnel/mascot-portal-tunnel-scroll.mp4",
    );
    expect(PORTAL_POSTER_PATH).toBe(
      "/assets/portal-tunnel/mascot-portal-tunnel-poster.jpg",
    );
    expect(ADDITIONAL_VIDEO_PATH).toBe(
      "/assets/portal-arrival/mascot-tunnel-coding-scroll.mp4",
    );
    expect(ADDITIONAL_POSTER_PATH).toBe(
      "/assets/portal-arrival/mascot-tunnel-coding-poster.jpg",
    );
  });

  it.each([
    [0, "hero-journey"],
    [0.3799, "hero-journey"],
    [0.38, "existing-tunnel"],
    [0.44, "video-bridge"],
    [0.47, "additional-video"],
    [0.82, "layer-handoff"],
    [0.89, "hearing-reveal"],
    [0.98, "hearing-hold"],
    [1, "hearing-hold"],
  ] as const)("進捗%fを%s区間として扱う", (progress, phase) => {
    expect(portalPhaseAt(progress)).toBe(phase);
  });

  it("44〜47%は既存動画と追加動画を同時に前進させる", () => {
    const start = integratedVideoTimesAt(0.44, 8, 8);
    const middle = integratedVideoTimesAt(0.455, 8, 8);
    const end = integratedVideoTimesAt(0.47, 8, 8);

    expect(start.existingTime).toBeCloseTo(7 + 16 / 24, 5);
    expect(start.additionalTime).toBe(0);
    expect(middle.existingTime).toBeGreaterThan(start.existingTime);
    expect(middle.additionalTime).toBeGreaterThan(start.additionalTime);
    expect(end.existingTime).toBeCloseTo(7 + 19 / 24, 5);
    expect(end.additionalTime).toBeCloseTo(0.125, 5);
  });

  it("1本目は末尾0.1〜0.25秒だけを除き、2本目は0秒から使用する", () => {
    const start = integratedVideoTimesAt(0.44, 8, 8);
    const end = integratedVideoTimesAt(0.47, 8, 8);

    expect(8 - end.existingTime).toBeGreaterThanOrEqual(0.1);
    expect(8 - end.existingTime).toBeLessThanOrEqual(0.25);
    expect(start.additionalTime).toBe(0);
  });

  it("追加動画を0秒から最終有効フレームまで使う", () => {
    const start = integratedVideoTimesAt(0.44, 8, 8);
    const end = integratedVideoTimesAt(0.82, 8, 8);

    expect(start.additionalTime).toBe(0);
    expect(end.additionalTime).toBeCloseTo(8 - 1 / 24, 6);
  });

  it("独立セクションを作らず、1本目後半から2本目前半のトンネル上へ予告を重ねる", () => {
    expect(TRANSITION_CONFIG.previewStart).toBe(0.33);
    expect(TRANSITION_CONFIG.previewHoldEnd).toBe(0.5);
    expect(TRANSITION_CONFIG.previewEnd).toBe(0.52);

    expect(transitionStateAt(0.329).previewProgress).toBe(0);
    expect(transitionStateAt(0.44).previewProgress).toBeGreaterThan(0);
    expect(transitionStateAt(0.52).previewExitProgress).toBe(1);
    expect(transitionStateAt(0.89).stillProgress).toBe(1);
  });

  it("冒頭の短い区間だけ待機マスコットから動画へ引き継ぐ", () => {
    expect(TRANSITION_CONFIG.heroIdleHandoffEnd).toBeGreaterThan(0);
    expect(TRANSITION_CONFIG.heroIdleHandoffEnd).toBeLessThanOrEqual(0.03);
    expect(TRANSITION_CONFIG.heroIdleHandoffEnd).toBeLessThan(
      TRANSITION_CONFIG.heroJourneyEnd,
    );
  });

  it("キャラクター単体の着地後、ヒアリングを89〜98%で連続表示する", () => {
    expect(transitionStateAt(0.889).hearingProgress).toBe(0);
    expect(transitionStateAt(0.935).hearingProgress).toBeCloseTo(0.5, 5);
    expect(transitionStateAt(0.98).hearingProgress).toBe(1);
  });

  it("装飾を再表示せず、動画終端から引き継いだキャラクターだけを保持する", () => {
    expect(arrivalLayerOpacityAt("decor", 0.82)).toBe(0);
    expect(arrivalLayerOpacityAt("decor", 0.845)).toBe(0);
    expect(arrivalLayerOpacityAt("decor", 0.89)).toBe(0);
    expect(arrivalLayerOpacityAt("mascot", 0.813)).toBe(0);
    expect(arrivalLayerOpacityAt("mascot", 0.817)).toBeGreaterThan(0);
    expect(arrivalLayerOpacityAt("mascot", 0.845)).toBe(1);
    expect(arrivalLayerOpacityAt("mascot", 0.98)).toBe(1);
  });

  it("動画のcover座標から単体キャラクターへのFLIP変換を画面比率ごとに算出する", () => {
    const transform = mascotVideoHandoffTransform({
      viewportWidth: 1280,
      viewportHeight: 720,
      objectPositionX: 0.5,
      finalRect: { left: 900, top: 460, width: 240 },
    });

    expect(transform.xPx).toBeCloseTo(-195, 5);
    expect(transform.yPx).toBeCloseTo(-181, 5);
    expect(transform.scale).toBeCloseTo(400 / 240, 5);
  });

  it("追加尺に合わせ、モバイルをPCより20〜30%短くする", () => {
    const ratio =
      TRANSITION_CONFIG.mobileLengthVh / TRANSITION_CONFIG.desktopLengthVh;
    expect(TRANSITION_CONFIG.desktopLengthVh).toBe(900);
    expect(ratio).toBeGreaterThanOrEqual(0.7);
    expect(ratio).toBeLessThanOrEqual(0.8);
    expect(TRANSITION_CONFIG.videoSmoothing).toBeGreaterThanOrEqual(0.08);
    expect(TRANSITION_CONFIG.videoSmoothing).toBeLessThanOrEqual(0.2);
  });
});

describe("Canvas品質設定", () => {
  it("DPRを1.5以下に抑え、モバイルとモーション低減では描画を軽量化する", () => {
    const desktop = canvasProfileForViewport(1440, 3, false);
    const mobile = canvasProfileForViewport(390, 3, false);
    const reduced = canvasProfileForViewport(390, 3, true);

    expect(desktop.dpr).toBe(1.5);
    expect(mobile.particleCount).toBeLessThan(desktop.particleCount);
    expect(mobile.streakCount).toBeLessThan(desktop.streakCount);
    expect(reduced.particleCount).toBe(0);
    expect(reduced.streakCount).toBe(0);
  });
});
