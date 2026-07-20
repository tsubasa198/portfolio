import { clamp01 } from "../core/sceneProgress";

const FRAME_DURATION_MS = 1000 / 60;
const DEFAULT_MAX_DELTA_MS = 50;
const DEFAULT_SEEK_EPSILON_SECONDS = 1 / 120;
const DEFAULT_SETTLE_EPSILON_SECONDS = 0.002;

export interface AnimationFrameScheduler {
  readonly request: (callback: FrameRequestCallback) => number;
  readonly cancel: (id: number) => void;
}

interface DecodedVideoFrameMetadata {
  readonly mediaTime: number;
}

type DecodedVideoFrameCallback = (
  now: number,
  metadata: DecodedVideoFrameMetadata,
) => void;

export interface ScrubbableVideo {
  currentTime: number;
  readonly duration: number;
  readonly readyState: number;
  readonly seeking: boolean;
  pause(): void;
  requestVideoFrameCallback?(callback: DecodedVideoFrameCallback): number;
  cancelVideoFrameCallback?(id: number): void;
}

export interface PortalVideoScrubberOptions {
  readonly scheduler?: AnimationFrameScheduler;
  readonly smoothing: number;
  readonly endHoldSeconds: number;
  readonly seekEpsilonSeconds?: number;
  readonly settleEpsilonSeconds?: number;
  readonly maxDeltaMs?: number;
  readonly progressToTime?: (
    progress: number,
    duration: number,
    endHoldSeconds: number,
  ) => number;
  readonly catchUpSmoothing?: number;
  readonly catchUpThresholdSeconds?: number;
  readonly onTimeUpdate?: (currentTime: number, targetTime: number) => void;
  readonly onDecodedFrame?: (mediaTime: number) => void;
  readonly onError?: (error: Error) => void;
}

const browserScheduler: AnimationFrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (id) => window.cancelAnimationFrame(id),
};

/** 0〜1のスクロール進捗を、終端の安全余白を除いた動画時間へ写像する。 */
export function progressToVideoTime(
  progress: number,
  duration: number,
  endHoldSeconds = 0,
): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError(`動画時間が不正です: ${duration}`);
  }
  const safeProgress = Number.isFinite(progress) ? clamp01(progress) : 0;
  const safeHold = Number.isFinite(endHoldSeconds)
    ? Math.min(duration, Math.max(0, endHoldSeconds))
    : 0;
  return safeProgress * (duration - safeHold);
}

/** 60fpsを基準に、フレーム間隔が変わっても同じ速度で目標へ収束させる。 */
export function smoothVideoTime(
  currentTime: number,
  targetTime: number,
  smoothing: number,
  deltaMs: number,
  snapEpsilon = DEFAULT_SETTLE_EPSILON_SECONDS,
  maxDeltaMs = DEFAULT_MAX_DELTA_MS,
): number {
  if (!Number.isFinite(smoothing) || smoothing <= 0 || smoothing > 1) {
    throw new RangeError(`動画補間係数が不正です: ${smoothing}`);
  }
  if (Math.abs(targetTime - currentTime) <= snapEpsilon) return targetTime;

  const safeDelta = Math.min(
    maxDeltaMs,
    Math.max(0, Number.isFinite(deltaMs) ? deltaMs : FRAME_DURATION_MS),
  );
  const alpha = 1 - Math.pow(1 - smoothing, safeDelta / FRAME_DURATION_MS);
  const next = currentTime + (targetTime - currentTime) * alpha;
  return targetTime >= currentTime
    ? Math.min(next, targetTime)
    : Math.max(next, targetTime);
}

/** ScrollTriggerから目標だけを受け、実際のseekはrAF内で滑らかに行う。 */
export class PortalVideoScrubber {
  private readonly scheduler: AnimationFrameScheduler;
  private readonly seekEpsilonSeconds: number;
  private readonly settleEpsilonSeconds: number;
  private readonly maxDeltaMs: number;
  private targetTime: number;
  private smoothedTime: number;
  private animationFrameId: number | null = null;
  private videoFrameCallbackId: number | null = null;
  private lastTimestamp: number | null = null;
  private active = true;
  private destroyed = false;
  private failed = false;

  constructor(
    private readonly video: ScrubbableVideo,
    private readonly options: PortalVideoScrubberOptions,
  ) {
    this.scheduler = options.scheduler ?? browserScheduler;
    this.seekEpsilonSeconds =
      options.seekEpsilonSeconds ?? DEFAULT_SEEK_EPSILON_SECONDS;
    this.settleEpsilonSeconds =
      options.settleEpsilonSeconds ?? DEFAULT_SETTLE_EPSILON_SECONDS;
    this.maxDeltaMs = options.maxDeltaMs ?? DEFAULT_MAX_DELTA_MS;
    this.smoothedTime = Number.isFinite(video.currentTime)
      ? Math.max(0, video.currentTime)
      : 0;
    this.targetTime = this.smoothedTime;
    // 再生クロックは使わず、スクロールだけを唯一の時間源にする。
    this.video.pause();
  }

  setProgress(progress: number): void {
    if (this.destroyed || this.failed) return;
    try {
      const mapProgress =
        this.options.progressToTime ?? progressToVideoTime;
      this.targetTime = mapProgress(
        progress,
        this.video.duration,
        this.options.endHoldSeconds,
      );
      this.schedule();
    } catch (error) {
      this.fail(error);
    }
  }

  setActive(active: boolean): void {
    if (this.destroyed || this.failed || this.active === active) return;
    this.active = active;
    this.lastTimestamp = null;
    if (!active) {
      this.cancelScheduledFrames();
      return;
    }
    this.schedule();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelScheduledFrames();
    this.video.pause();
  }

  private readonly tick: FrameRequestCallback = (timestamp) => {
    this.animationFrameId = null;
    if (!this.active || this.destroyed || this.failed) return;

    const deltaMs =
      this.lastTimestamp === null
        ? FRAME_DURATION_MS
        : timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    const catchUpThreshold = this.options.catchUpThresholdSeconds;
    const smoothing =
      catchUpThreshold !== undefined &&
      Math.abs(this.targetTime - this.smoothedTime) > catchUpThreshold
        ? (this.options.catchUpSmoothing ?? this.options.smoothing)
        : this.options.smoothing;
    this.smoothedTime = smoothVideoTime(
      this.smoothedTime,
      this.targetTime,
      smoothing,
      deltaMs,
      this.settleEpsilonSeconds,
      this.maxDeltaMs,
    );

    const shouldSeek =
      !this.video.seeking &&
      (Math.abs(this.video.currentTime - this.smoothedTime) >=
        this.seekEpsilonSeconds ||
        this.smoothedTime === this.targetTime);
    if (shouldSeek) {
      try {
        this.video.currentTime = this.smoothedTime;
        this.options.onTimeUpdate?.(this.smoothedTime, this.targetTime);
        this.requestDecodedFrame();
      } catch (error) {
        this.fail(error);
        return;
      }
    }

    const interpolationPending =
      Math.abs(this.targetTime - this.smoothedTime) >
      this.settleEpsilonSeconds;
    const decodedFramePending =
      this.video.seeking ||
      Math.abs(this.video.currentTime - this.smoothedTime) >=
        this.seekEpsilonSeconds;
    if (interpolationPending || decodedFramePending) {
      this.schedule();
    }
  };

  private schedule(): void {
    if (
      !this.active ||
      this.destroyed ||
      this.failed ||
      this.animationFrameId !== null
    ) {
      return;
    }
    this.animationFrameId = this.scheduler.request(this.tick);
  }

  private requestDecodedFrame(): void {
    if (
      !this.video.requestVideoFrameCallback ||
      this.videoFrameCallbackId !== null
    ) {
      return;
    }
    this.videoFrameCallbackId = this.video.requestVideoFrameCallback(
      (_now, metadata) => {
        this.videoFrameCallbackId = null;
        if (!this.destroyed) {
          this.options.onDecodedFrame?.(metadata.mediaTime);
        }
      },
    );
  }

  private cancelScheduledFrames(): void {
    if (this.animationFrameId !== null) {
      this.scheduler.cancel(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (
      this.videoFrameCallbackId !== null &&
      this.video.cancelVideoFrameCallback
    ) {
      this.video.cancelVideoFrameCallback(this.videoFrameCallbackId);
      this.videoFrameCallbackId = null;
    }
  }

  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    this.cancelScheduledFrames();
    const normalized =
      error instanceof Error ? error : new Error("動画seekに失敗しました");
    this.options.onError?.(normalized);
  }
}
