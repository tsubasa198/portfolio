import { describe, expect, it } from "vitest";
import {
  STUDIO_PRESENTATIONS,
  STUDIO_SPEECH_TRANSITION,
  studioPresentationAt,
} from "./studioPresentation";

describe("Studioの4工程プレゼンテーション", () => {
  it.each([
    [0, "hearing", "お話を聞かせてください！", "bounce"],
    [0.2799, "hearing", "お話を聞かせてください！", "bounce"],
    [0.28, "requirements", "要件をまとめています！", "focus"],
    [0.52, "workflow", "フローを組み立て中！", "working"],
    [0.76, "build", "システム完成です！", "celebrate"],
    [1, "build", "システム完成です！", "celebrate"],
  ] as const)(
    "進捗%fで%sの案内へ切り替える",
    (progress, id, speech, reaction) => {
      const presentation = studioPresentationAt(progress);
      expect(presentation.id).toBe(id);
      expect(presentation.speech).toBe(speech);
      expect(presentation.reaction).toBe(reaction);
      expect(presentation.mascotVisible).toBe(true);
    },
  );

  it("逆スクロールでも現在進捗から前の案内へ正しく戻る", () => {
    expect([0.8, 0.6, 0.3, 0.1].map(studioPresentationAt).map((item) => item.id))
      .toEqual(["build", "workflow", "requirements", "hearing"]);
  });

  it("4工程を重複なく定義する", () => {
    expect(STUDIO_PRESENTATIONS.map((item) => item.id)).toEqual([
      "hearing",
      "requirements",
      "workflow",
      "build",
    ]);
    expect(new Set(STUDIO_PRESENTATIONS.map((item) => item.speech)).size).toBe(4);
  });

  it("吹き出し切替を0.25〜0.45秒に収め、指定の退場・登場姿勢を持つ", () => {
    expect(STUDIO_SPEECH_TRANSITION.totalDuration).toBeGreaterThanOrEqual(0.25);
    expect(STUDIO_SPEECH_TRANSITION.totalDuration).toBeLessThanOrEqual(0.45);
    expect(STUDIO_SPEECH_TRANSITION.exit).toEqual({
      y: -8,
      scale: 0.96,
      blurPx: 4,
    });
    expect(STUDIO_SPEECH_TRANSITION.enter).toEqual({
      y: 12,
      scale: 0.94,
      blurPx: 4,
    });
  });
});
