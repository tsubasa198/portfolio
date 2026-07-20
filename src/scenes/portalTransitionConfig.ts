import { clamp01, segmentProgress } from "../core/sceneProgress";

/** 2本の動画、静止レイヤー、Studioが共有する一本のショットの編集点。 */
export const TRANSITION_CONFIG = {
  heroIdleHandoffEnd: 0.018,
  heroEnd: 0.1,
  approachEnd: 0.22,
  portalEntryEnd: 0.38,
  heroJourneyEnd: 0.38,
  existingTunnelEnd: 0.44,
  videoBridgeEnd: 0.47,
  additionalVideoEnd: 0.82,
  stillVideoFadeEnd: 0.845,
  stillHandoffEnd: 0.89,
  studioPreludeStart: 0.89,
  hearingRevealEnd: 0.98,
  end: 1,
  previewStart: 0.33,
  previewHoldEnd: 0.5,
  previewEnd: 0.52,
  portalFlashStart: 0.25,
  portalExposurePeak: 0.33,
  portalFlashPeak: 0.34,
  existingConnectionStartSeconds: 7 + 16 / 24,
  existingConnectionEndSeconds: 7 + 19 / 24,
  additionalConnectionEndSeconds: 3 / 24,
  mascotVideoMatchStart: 0.814,
  additionalVideoMobileObjectPositionX: 0.77,
  desktopLengthVh: 900,
  mobileLengthVh: 700,
  videoSmoothing: 0.12,
  videoEndHoldSeconds: 1 / 24,
  videoSeekEpsilonSeconds: 1 / 120,
  progressSettleEpsilon: 0.0002,
  videoMaxDeltaMs: 50,
  videoReadyTimeoutMs: 15_000,
  maxDpr: 1.5,
  mobileBreakpoint: 820,
  desktopParticleCount: 58,
  mobileParticleCount: 26,
  desktopStreakCount: 24,
  mobileStreakCount: 10,
} as const;

export type ArrivalLayerKind = "decor" | "mascot";

export interface ElementRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

export interface MascotVideoHandoffInput {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly objectPositionX: number;
  readonly finalRect: ElementRect;
}

export interface MascotVideoHandoffTransform {
  readonly xPx: number;
  readonly yPx: number;
  readonly scale: number;
}

/** 2本目の最終表示フレーム上で、透過PNG全体が占める動画座標。 */
export const MASCOT_VIDEO_MATCH_RECT = {
  videoWidth: 1280,
  videoHeight: 720,
  left: 705,
  top: 279,
  size: 400,
} as const;

export const PORTAL_VIDEO_PATH =
  "/assets/portal-tunnel/mascot-portal-tunnel-scroll.mp4";

export const PORTAL_POSTER_PATH =
  "/assets/portal-tunnel/mascot-portal-tunnel-poster.jpg";

export const ADDITIONAL_VIDEO_PATH =
  "/assets/portal-arrival/mascot-tunnel-coding-scroll.mp4";

export const ADDITIONAL_POSTER_PATH =
  "/assets/portal-arrival/mascot-tunnel-coding-poster.jpg";

export type PortalPhase =
  | "hero-journey"
  | "existing-tunnel"
  | "video-bridge"
  | "additional-video"
  | "layer-handoff"
  | "hearing-reveal"
  | "hearing-hold";

export interface IntegratedVideoTimes {
  readonly existingTime: number;
  readonly additionalTime: number;
}

export interface TransitionState {
  readonly progress: number;
  readonly phase: PortalPhase;
  readonly approachProgress: number;
  readonly entryProgress: number;
  readonly tunnelProgress: number;
  readonly bridgeProgress: number;
  readonly additionalProgress: number;
  readonly previewProgress: number;
  readonly previewExitProgress: number;
  readonly stillProgress: number;
  readonly hearingProgress: number;
  readonly portalCenterX: number;
  readonly portalIntensity: number;
  readonly tunnelDepth: number;
  readonly tunnelSpeed: number;
  readonly foregroundIntensity: number;
  readonly nextSectionReveal: number;
}

export interface CanvasProfile {
  readonly dpr: number;
  readonly particleCount: number;
  readonly streakCount: number;
  readonly ringCount: number;
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function assertDuration(duration: number, label: string): void {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError(`${label}のdurationが不正です`);
  }
}

/** 終盤では環境を動画と一緒に消し、透過PNGのマスコットだけを残す。 */
export function arrivalLayerOpacityAt(
  kind: ArrivalLayerKind,
  progress: number,
): number {
  if (kind === "decor") return 0;
  return segmentProgress(
    clamp01(progress),
    TRANSITION_CONFIG.mascotVideoMatchStart,
    TRANSITION_CONFIG.additionalVideoEnd,
  );
}

/** object-fit: cover後の動画座標から、最終CSS配置へ戻すFLIP変換を求める。 */
export function mascotVideoHandoffTransform(
  input: MascotVideoHandoffInput,
): MascotVideoHandoffTransform {
  const { viewportWidth, viewportHeight, finalRect } = input;
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    !Number.isFinite(finalRect.left) ||
    !Number.isFinite(finalRect.top) ||
    !Number.isFinite(finalRect.width) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0 ||
    finalRect.width <= 0
  ) {
    throw new RangeError("マスコットの動画座標変換に不正な寸法があります");
  }

  const objectPositionX = clamp01(input.objectPositionX);
  const coverScale = Math.max(
    viewportWidth / MASCOT_VIDEO_MATCH_RECT.videoWidth,
    viewportHeight / MASCOT_VIDEO_MATCH_RECT.videoHeight,
  );
  const renderedWidth = MASCOT_VIDEO_MATCH_RECT.videoWidth * coverScale;
  const renderedHeight = MASCOT_VIDEO_MATCH_RECT.videoHeight * coverScale;
  const originX = (viewportWidth - renderedWidth) * objectPositionX;
  const originY = (viewportHeight - renderedHeight) * 0.5;
  const targetLeft =
    originX + MASCOT_VIDEO_MATCH_RECT.left * coverScale;
  const targetTop = originY + MASCOT_VIDEO_MATCH_RECT.top * coverScale;
  const targetSize = MASCOT_VIDEO_MATCH_RECT.size * coverScale;

  return {
    xPx: targetLeft - finalRect.left,
    yPx: targetTop - finalRect.top,
    scale: targetSize / finalRect.width,
  };
}

export function portalPhaseAt(progress: number): PortalPhase {
  const value = clamp01(progress);
  if (value < TRANSITION_CONFIG.heroJourneyEnd) return "hero-journey";
  if (value < TRANSITION_CONFIG.existingTunnelEnd) return "existing-tunnel";
  if (value < TRANSITION_CONFIG.videoBridgeEnd) return "video-bridge";
  if (value < TRANSITION_CONFIG.additionalVideoEnd) return "additional-video";
  if (value < TRANSITION_CONFIG.stillHandoffEnd) return "layer-handoff";
  if (value < TRANSITION_CONFIG.hearingRevealEnd) return "hearing-reveal";
  return "hearing-hold";
}

/** マスター進捗を2本の動画時刻へ写像し、44〜47%だけ両方を動かす。 */
export function integratedVideoTimesAt(
  progress: number,
  existingDuration: number,
  additionalDuration: number,
): IntegratedVideoTimes {
  assertDuration(existingDuration, "既存動画");
  assertDuration(additionalDuration, "追加動画");

  const value = clamp01(progress);
  const existingPlayableEnd = Math.max(
    0,
    existingDuration - TRANSITION_CONFIG.videoEndHoldSeconds,
  );
  const additionalPlayableEnd = Math.max(
    0,
    additionalDuration - TRANSITION_CONFIG.videoEndHoldSeconds,
  );
  const existingConnectionStart = Math.min(
    TRANSITION_CONFIG.existingConnectionStartSeconds,
    existingPlayableEnd,
  );
  const existingConnectionEnd = Math.min(
    TRANSITION_CONFIG.existingConnectionEndSeconds,
    existingPlayableEnd,
  );
  const additionalConnectionEnd = Math.min(
    TRANSITION_CONFIG.additionalConnectionEndSeconds,
    additionalPlayableEnd,
  );

  const existingBeforeBridge = segmentProgress(
    value,
    0,
    TRANSITION_CONFIG.existingTunnelEnd,
  );
  const bridgeProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.existingTunnelEnd,
    TRANSITION_CONFIG.videoBridgeEnd,
  );
  const additionalAfterBridge = segmentProgress(
    value,
    TRANSITION_CONFIG.videoBridgeEnd,
    TRANSITION_CONFIG.additionalVideoEnd,
  );

  const existingTime =
    value < TRANSITION_CONFIG.existingTunnelEnd
      ? mix(0, existingConnectionStart, existingBeforeBridge)
      : mix(existingConnectionStart, existingConnectionEnd, bridgeProgress);

  let additionalTime = 0;
  if (value >= TRANSITION_CONFIG.existingTunnelEnd) {
    additionalTime =
      value < TRANSITION_CONFIG.videoBridgeEnd
        ? mix(0, additionalConnectionEnd, bridgeProgress)
        : mix(
            additionalConnectionEnd,
            additionalPlayableEnd,
            additionalAfterBridge,
          );
  }

  return { existingTime, additionalTime };
}

/** CanvasとHTML前景が境界で不連続にならないための派生状態。 */
export function transitionStateAt(progress: number): TransitionState {
  const value = clamp01(progress);
  const approachProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.heroEnd,
    TRANSITION_CONFIG.approachEnd,
  );
  const entryProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.approachEnd,
    TRANSITION_CONFIG.portalEntryEnd,
  );
  const tunnelProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.portalEntryEnd,
    TRANSITION_CONFIG.additionalVideoEnd,
  );
  const bridgeProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.existingTunnelEnd,
    TRANSITION_CONFIG.videoBridgeEnd,
  );
  const additionalProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.videoBridgeEnd,
    TRANSITION_CONFIG.additionalVideoEnd,
  );
  const previewProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.previewStart,
    TRANSITION_CONFIG.previewHoldEnd,
  );
  const previewExitProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.previewHoldEnd,
    TRANSITION_CONFIG.previewEnd,
  );
  const stillProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.additionalVideoEnd,
    TRANSITION_CONFIG.stillHandoffEnd,
  );
  const hearingProgress = segmentProgress(
    value,
    TRANSITION_CONFIG.studioPreludeStart,
    TRANSITION_CONFIG.hearingRevealEnd,
  );

  const postVideoFade = segmentProgress(
    value,
    TRANSITION_CONFIG.additionalVideoEnd,
    TRANSITION_CONFIG.stillHandoffEnd,
  );
  const portalIntensity =
    value < TRANSITION_CONFIG.portalEntryEnd
      ? mix(0.2, 1, entryProgress)
      : mix(1, 0.18, postVideoFade);
  const foregroundIntensity =
    value < TRANSITION_CONFIG.additionalVideoEnd
      ? mix(0.45, 1, tunnelProgress)
      : mix(1, 0.08, postVideoFade);

  return {
    progress: value,
    phase: portalPhaseAt(value),
    approachProgress,
    entryProgress,
    tunnelProgress,
    bridgeProgress,
    additionalProgress,
    previewProgress,
    previewExitProgress,
    stillProgress,
    hearingProgress,
    portalCenterX: mix(78, 50, entryProgress),
    portalIntensity,
    tunnelDepth: mix(0, 1, tunnelProgress),
    tunnelSpeed: mix(0.18, 1.22, tunnelProgress),
    foregroundIntensity,
    nextSectionReveal: hearingProgress,
  };
}

export function canvasProfileForViewport(
  width: number,
  devicePixelRatio: number,
  reducedMotion: boolean,
): CanvasProfile {
  const mobile = width <= TRANSITION_CONFIG.mobileBreakpoint;
  const dpr = Math.min(
    TRANSITION_CONFIG.maxDpr,
    Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1),
  );

  if (reducedMotion) {
    return { dpr, particleCount: 0, streakCount: 0, ringCount: 0 };
  }

  return {
    dpr,
    particleCount: mobile
      ? TRANSITION_CONFIG.mobileParticleCount
      : TRANSITION_CONFIG.desktopParticleCount,
    streakCount: mobile
      ? TRANSITION_CONFIG.mobileStreakCount
      : TRANSITION_CONFIG.desktopStreakCount,
    ringCount: mobile ? 6 : 9,
  };
}
