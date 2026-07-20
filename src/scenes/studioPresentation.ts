export type StudioSceneId =
  | "hearing"
  | "requirements"
  | "workflow"
  | "build";

export type StudioReaction = "bounce" | "focus" | "working" | "celebrate";

export interface StudioPresentation {
  readonly id: StudioSceneId;
  readonly start: number;
  readonly end: number;
  readonly speech: string;
  readonly reaction: StudioReaction;
  readonly mascotVisible: true;
}

export const STUDIO_PRESENTATIONS: readonly StudioPresentation[] = [
  {
    id: "hearing",
    start: 0,
    end: 0.28,
    speech: "お話を聞かせてください！",
    reaction: "bounce",
    mascotVisible: true,
  },
  {
    id: "requirements",
    start: 0.28,
    end: 0.52,
    speech: "要件をまとめています！",
    reaction: "focus",
    mascotVisible: true,
  },
  {
    id: "workflow",
    start: 0.52,
    end: 0.76,
    speech: "フローを組み立て中！",
    reaction: "working",
    mascotVisible: true,
  },
  {
    id: "build",
    start: 0.76,
    end: 1.01,
    speech: "システム完成です！",
    reaction: "celebrate",
    mascotVisible: true,
  },
] as const;

export const STUDIO_SPEECH_TRANSITION = {
  exitDuration: 0.18,
  enterDuration: 0.22,
  totalDuration: 0.4,
  exit: { y: -8, scale: 0.96, blurPx: 4 },
  enter: { y: 12, scale: 0.94, blurPx: 4 },
} as const;

/** スクロール方向ではなく現在値だけで決め、逆スクロール時も同じ状態へ戻す。 */
export function studioPresentationAt(progress: number): StudioPresentation {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    STUDIO_PRESENTATIONS.find(
      (presentation) =>
        clamped >= presentation.start && clamped < presentation.end,
    ) ?? STUDIO_PRESENTATIONS[STUDIO_PRESENTATIONS.length - 1]
  );
}
