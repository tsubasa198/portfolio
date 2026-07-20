import { clamp01 } from "../core/sceneProgress";
import { smoothVideoTime } from "./portalVideoScrub";
import {
  integratedVideoTimesAt,
  type IntegratedVideoTimes,
} from "./portalTransitionConfig";

interface DecodedVideoFrameMetadata {
  readonly mediaTime: number;
}

type DecodedVideoFrameCallback = (
  now: DOMHighResTimeStamp,
  metadata: DecodedVideoFrameMetadata,
) => void;

export interface IntegratedScrubVideo {
  currentTime: number;
  readonly duration: number;
  readonly seeking: boolean;
  pause(): void;
  requestVideoFrameCallback?(callback: DecodedVideoFrameCallback): number;
  cancelVideoFrameCallback?(id: number): void;
}

export interface ProgressFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

export interface IntegratedVideoScrubberOptions {
  readonly smoothing: number;
  readonly settleEpsilon: number;
  readonly maxDeltaMs: number;
  readonly seekEpsilonSeconds: number;
  readonly scheduler?: ProgressFrameScheduler;
  readonly onUpdate?: (
    progress: number,
    times: IntegratedVideoTimes,
  ) => void;
  readonly onDecodedFrame?: (
    video: "existing" | "additional",
    mediaTime: number,
  ) => void;
  readonly onError?: (error: Error) => void;
}

const FRAME_DURATION_MS = 1000 / 60;

const browserScheduler: ProgressFrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (id) => window.cancelAnimationFrame(id),
};

/** 2本のseekとHTML/Canvasを、同じ補間済みマスター進捗へ束ねる。 */
export class IntegratedVideoScrubber {
  private readonly scheduler: ProgressFrameScheduler;
  private targetProgress = 0;
  private displayedProgress = 0;
  private animationFrameId: number | null = null;
  private readonly videoFrameCallbackIds = new Map<
    "existing" | "additional",
    number
  >();
  private lastTimestamp: number | null = null;
  private active = true;
  private destroyed = false;
  private failed = false;

  constructor(
    private readonly existingVideo: IntegratedScrubVideo,
    private readonly additionalVideo: IntegratedScrubVideo,
    private readonly options: IntegratedVideoScrubberOptions,
  ) {
    this.scheduler = options.scheduler ?? browserScheduler;
    // 再生クロックは使わず、スクロール進捗だけを唯一の時間源にする。
    this.existingVideo.pause();
    this.additionalVideo.pause();
  }

  setProgress(progress: number): void {
    if (this.destroyed || this.failed) return;
    this.targetProgress = clamp01(progress);
    this.schedule();
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

  progress(): number {
    return this.displayedProgress;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelScheduledFrames();
    this.existingVideo.pause();
    this.additionalVideo.pause();
  }

  private readonly tick: FrameRequestCallback = (timestamp) => {
    this.animationFrameId = null;
    if (!this.active || this.destroyed || this.failed) return;

    const deltaMs =
      this.lastTimestamp === null
        ? FRAME_DURATION_MS
        : Math.max(0, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    this.displayedProgress = smoothVideoTime(
      this.displayedProgress,
      this.targetProgress,
      this.options.smoothing,
      deltaMs,
      this.options.settleEpsilon,
      this.options.maxDeltaMs,
    );

    try {
      const times = integratedVideoTimesAt(
        this.displayedProgress,
        this.existingVideo.duration,
        this.additionalVideo.duration,
      );
      this.seekVideo("existing", this.existingVideo, times.existingTime);
      this.seekVideo("additional", this.additionalVideo, times.additionalTime);
      this.options.onUpdate?.(this.displayedProgress, times);

      const progressPending =
        Math.abs(this.targetProgress - this.displayedProgress) >
        this.options.settleEpsilon;
      const mediaPending =
        this.videoNeedsUpdate(this.existingVideo, times.existingTime) ||
        this.videoNeedsUpdate(this.additionalVideo, times.additionalTime);
      if (progressPending || mediaPending) this.schedule();
    } catch (error) {
      this.fail(error);
    }
  };

  private seekVideo(
    name: "existing" | "additional",
    video: IntegratedScrubVideo,
    time: number,
  ): void {
    if (video.seeking) return;
    if (
      Math.abs(video.currentTime - time) < this.options.seekEpsilonSeconds &&
      video.currentTime !== time
    ) {
      return;
    }
    video.currentTime = time;
    this.requestDecodedFrame(name, video);
  }

  private videoNeedsUpdate(
    video: IntegratedScrubVideo,
    time: number,
  ): boolean {
    return (
      video.seeking ||
      Math.abs(video.currentTime - time) >= this.options.seekEpsilonSeconds
    );
  }

  private requestDecodedFrame(
    name: "existing" | "additional",
    video: IntegratedScrubVideo,
  ): void {
    if (
      !video.requestVideoFrameCallback ||
      this.videoFrameCallbackIds.has(name)
    ) {
      return;
    }
    const callbackId = video.requestVideoFrameCallback((_now, metadata) => {
      this.videoFrameCallbackIds.delete(name);
      if (!this.destroyed) {
        this.options.onDecodedFrame?.(name, metadata.mediaTime);
      }
    });
    this.videoFrameCallbackIds.set(name, callbackId);
  }

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

  private cancelScheduledFrames(): void {
    if (this.animationFrameId !== null) {
      this.scheduler.cancel(this.animationFrameId);
      this.animationFrameId = null;
    }
    for (const [name, callbackId] of this.videoFrameCallbackIds) {
      const video =
        name === "existing" ? this.existingVideo : this.additionalVideo;
      video.cancelVideoFrameCallback?.(callbackId);
    }
    this.videoFrameCallbackIds.clear();
  }

  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    this.cancelScheduledFrames();
    const normalized =
      error instanceof Error ? error : new Error("統合動画seekに失敗しました");
    this.options.onError?.(normalized);
  }
}
