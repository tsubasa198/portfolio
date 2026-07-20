import { describe, expect, it } from "vitest";
import { frameIndexFor } from "./frameSequence";

describe("frameIndexFor", () => {
  // 60フレームのシーケンスを進捗0〜1で引く
  it("進捗0で最初のフレーム", () => {
    expect(frameIndexFor(0, 60)).toBe(0);
  });

  it("進捗1で最後のフレーム", () => {
    expect(frameIndexFor(1, 60)).toBe(59);
  });

  it("進捗0.5で中央付近のフレーム", () => {
    expect(frameIndexFor(0.5, 60)).toBe(29);
  });

  it("進捗が範囲外でもインデックスは範囲内に収まる", () => {
    expect(frameIndexFor(-0.5, 60)).toBe(0);
    expect(frameIndexFor(1.5, 60)).toBe(59);
  });

  it("フレーム数1なら常に0", () => {
    expect(frameIndexFor(0, 1)).toBe(0);
    expect(frameIndexFor(1, 1)).toBe(0);
  });

  it("フレーム数0以下なら例外を投げる(アセット読み込み失敗の早期検出)", () => {
    expect(() => frameIndexFor(0.5, 0)).toThrow();
  });
});
