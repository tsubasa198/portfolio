import { describe, expect, it } from "vitest";
import { initialScrollModeFor } from "./initialScroll";

describe("initialScrollModeFor", () => {
  it("リロード時はハッシュがあっても先頭から始める", () => {
    expect(initialScrollModeFor("reload", "#works")).toBe("top");
  });

  it("リロード時にハッシュが無くても先頭から始める", () => {
    expect(initialScrollModeFor("reload", "")).toBe("top");
  });

  it("通常遷移でハッシュ無しなら先頭から始める", () => {
    expect(initialScrollModeFor("navigate", "")).toBe("top");
  });

  it("通常遷移で#heroや空ハッシュは先頭扱いにする", () => {
    expect(initialScrollModeFor("navigate", "#hero")).toBe("top");
    expect(initialScrollModeFor("navigate", "#")).toBe("top");
  });

  it("通常遷移でシーンハッシュがあれば着地させる(詳細ページからの戻り導線)", () => {
    expect(initialScrollModeFor("navigate", "#works")).toBe("hash-landing");
  });

  it("戻る/進むではハッシュ着地を維持する", () => {
    expect(initialScrollModeFor("back_forward", "#works")).toBe("hash-landing");
  });

  it("ナビゲーション種別が取れない環境ではハッシュ着地を優先する(ディープリンク保護)", () => {
    expect(initialScrollModeFor(undefined, "#works")).toBe("hash-landing");
  });
});
