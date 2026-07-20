import { describe, expect, it } from "vitest";
import { applyToggles, staggerRanges } from "./segmentToggle";

/** classList互換の最小スタブ (Node環境でDOMを使わずに検証するため) */
function fakeElement(): Element & { has: (c: string) => boolean } {
  const classes = new Set<string>();
  return {
    classList: {
      toggle: (c: string, force: boolean) => {
        if (force) classes.add(c);
        else classes.delete(c);
        return force;
      },
    },
    has: (c: string) => classes.has(c),
  } as unknown as Element & { has: (c: string) => boolean };
}

describe("applyToggles", () => {
  it("区間内なら is-visible を付与する", () => {
    const el = fakeElement();
    applyToggles(0.5, [{ el, start: 0.4, end: 0.6 }]);
    expect(el.has("is-visible")).toBe(true);
  });

  it("区間外なら is-visible を外す", () => {
    const el = fakeElement();
    applyToggles(0.5, [{ el, start: 0.4, end: 0.6 }]);
    applyToggles(0.7, [{ el, start: 0.4, end: 0.6 }]);
    expect(el.has("is-visible")).toBe(false);
  });

  it("endを省略すると start 以降ずっと表示 (積み上げ型)", () => {
    const el = fakeElement();
    applyToggles(0.9, [{ el, start: 0.2 }]);
    expect(el.has("is-visible")).toBe(true);
  });

  it("逆スクロールで start を下回ると非表示に戻る", () => {
    const el = fakeElement();
    applyToggles(0.5, [{ el, start: 0.2 }]);
    applyToggles(0.1, [{ el, start: 0.2 }]);
    expect(el.has("is-visible")).toBe(false);
  });
});

describe("staggerRanges", () => {
  it("要素群を区間内の等間隔ステップに割り当てる", () => {
    const els = [fakeElement(), fakeElement(), fakeElement(), fakeElement()];
    const ranges = staggerRanges(els, 0.2, 0.6);
    expect(ranges.map((r) => r.start)).toEqual([0.2, 0.3, 0.4, 0.5]);
  });

  it("空配列なら空を返す", () => {
    expect(staggerRanges([], 0, 1)).toEqual([]);
  });
});
