import { describe, expect, it } from "vitest";
import { navigationSceneId, sceneLabel } from "./sceneConfig";

describe("シーン表示とナビゲーションの対応", () => {
  it.each([
    ["hearing", "ヒアリング"],
    ["requirements", "要件定義"],
    ["workflow", "構築"],
    ["build", "成果"],
  ])("%sは固有のインジケータ名を維持する", (id, label) => {
    expect(sceneLabel(id)).toBe(label);
  });

  it.each(["hearing", "requirements", "workflow", "build"])(
    "Studio内の%sはヘッダーナビ上でヒアリング項目をアクティブにする",
    (id) => {
      expect(navigationSceneId(id)).toBe("hearing");
    },
  );

  it("Studio外のナビIDは変更しない", () => {
    expect(navigationSceneId("hero")).toBe("hero");
    expect(navigationSceneId("works")).toBe("works");
  });
});
