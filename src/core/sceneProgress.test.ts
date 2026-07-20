import { describe, expect, it } from "vitest";
import { clamp01, segmentProgress, sceneProgress } from "./sceneProgress";

describe("clamp01", () => {
  it("範囲内の値はそのまま返す", () => {
    expect(clamp01(0.5)).toBe(0.5);
  });

  it("下限を下回る値は0に丸める", () => {
    expect(clamp01(-1)).toBe(0);
  });

  it("上限を超える値は1に丸める", () => {
    expect(clamp01(2)).toBe(1);
  });

  it("NaNは0として扱う(スクロール量が取得できない環境での安全策)", () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe("sceneProgress", () => {
  // シーン: top=1000px から length=2000px の区間
  it("シーン開始前は0", () => {
    expect(sceneProgress(500, 1000, 2000)).toBe(0);
  });

  it("シーン開始位置で0", () => {
    expect(sceneProgress(1000, 1000, 2000)).toBe(0);
  });

  it("シーン中間で0.5", () => {
    expect(sceneProgress(2000, 1000, 2000)).toBe(0.5);
  });

  it("シーン終了位置で1", () => {
    expect(sceneProgress(3000, 1000, 2000)).toBe(1);
  });

  it("シーン通過後は1のまま", () => {
    expect(sceneProgress(9999, 1000, 2000)).toBe(1);
  });

  it("lengthが0以下なら例外を投げる(設定ミスの早期検出)", () => {
    expect(() => sceneProgress(0, 0, 0)).toThrow();
    expect(() => sceneProgress(0, 0, -100)).toThrow();
  });
});

describe("segmentProgress", () => {
  // マスター進捗0〜1の中の部分区間 [0.25, 0.5] をローカル進捗0〜1に写像する
  it("区間開始前は0", () => {
    expect(segmentProgress(0.1, 0.25, 0.5)).toBe(0);
  });

  it("区間開始で0", () => {
    expect(segmentProgress(0.25, 0.25, 0.5)).toBe(0);
  });

  it("区間中間で0.5", () => {
    expect(segmentProgress(0.375, 0.25, 0.5)).toBe(0.5);
  });

  it("区間終了で1", () => {
    expect(segmentProgress(0.5, 0.25, 0.5)).toBe(1);
  });

  it("区間通過後は1のまま", () => {
    expect(segmentProgress(0.9, 0.25, 0.5)).toBe(1);
  });

  it("startがend以上なら例外を投げる(設定ミスの早期検出)", () => {
    expect(() => segmentProgress(0.5, 0.5, 0.5)).toThrow();
    expect(() => segmentProgress(0.5, 0.6, 0.5)).toThrow();
  });
});
