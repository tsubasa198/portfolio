import { describe, expect, it } from "vitest";
import { disclosureState, sceneScrollTop } from "./navigationState";

describe("sceneScrollTop", () => {
  it("セクション内の進捗位置をスクロール座標へ変換する", () => {
    expect(sceneScrollTop(500, 9000, 1000, 0.08)).toBe(1140);
  });

  it("進捗は0〜1へ丸め、セクション外へ移動しない", () => {
    expect(sceneScrollTop(500, 9000, 1000, -1)).toBe(500);
    expect(sceneScrollTop(500, 9000, 1000, 2)).toBe(8500);
  });

  it("セクションが画面より短い場合はセクション先頭を返す", () => {
    expect(sceneScrollTop(500, 600, 1000, 0.5)).toBe(500);
  });

  it("高さが不正な場合は設定ミスとして例外を投げる", () => {
    expect(() => sceneScrollTop(0, 0, 1000, 0.5)).toThrow();
    expect(() => sceneScrollTop(0, 1000, 0, 0.5)).toThrow();
  });
});

describe("disclosureState", () => {
  it("開いている場合のaria属性とhidden属性を返す", () => {
    expect(disclosureState(true)).toEqual({
      ariaExpanded: "true",
      panelHidden: false,
    });
  });

  it("閉じている場合のaria属性とhidden属性を返す", () => {
    expect(disclosureState(false)).toEqual({
      ariaExpanded: "false",
      panelHidden: true,
    });
  });
});
