import { describe, expect, it } from "vitest";
import {
  TOUCH_STATIC_MEDIA_QUERY,
  shouldUseStaticPresentation,
} from "./staticMode";

describe("shouldUseStaticPresentation", () => {
  it("OSがモーション低減を要求していれば静的表示にする", () => {
    expect(shouldUseStaticPresentation(true, false)).toBe(true);
  });

  it("主入力がタッチの端末なら静的表示にする", () => {
    expect(shouldUseStaticPresentation(false, true)).toBe(true);
  });

  it("マウス操作のPCで低減要求もなければ演出を有効にする", () => {
    expect(shouldUseStaticPresentation(false, false)).toBe(false);
  });

  it("両方該当しても静的表示のまま", () => {
    expect(shouldUseStaticPresentation(true, true)).toBe(true);
  });
});

describe("TOUCH_STATIC_MEDIA_QUERY", () => {
  it("hoverできずポインタが粗い端末(=タッチ主体)を対象にする", () => {
    expect(TOUCH_STATIC_MEDIA_QUERY).toBe(
      "(hover: none) and (pointer: coarse)",
    );
  });
});
