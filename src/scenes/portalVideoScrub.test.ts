import { describe, expect, it, vi } from "vitest";
import {
  PortalVideoScrubber,
  progressToVideoTime,
  smoothVideoTime,
  type AnimationFrameScheduler,
  type ScrubbableVideo,
} from "./portalVideoScrub";

class ManualScheduler implements AnimationFrameScheduler {
  private nextId = 1;
  private callbacks = new Map<number, FrameRequestCallback>();

  request = vi.fn((callback: FrameRequestCallback) => {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  });

  cancel = vi.fn((id: number) => {
    this.callbacks.delete(id);
  });

  step(time: number): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(time);
  }
}

class FakeVideo implements ScrubbableVideo {
  currentTime = 0;
  duration = 8;
  readyState = 4;
  seeking = false;
  readonly pause = vi.fn();
  readonly requestVideoFrameCallback = vi.fn(() => 41);
  readonly cancelVideoFrameCallback = vi.fn();
}

describe("動画時刻への変換", () => {
  it.each([
    [0, 0],
    [0.25, 2],
    [0.5, 4],
    [1, 8],
    [-1, 0],
    [2, 8],
  ])("進捗%fを%f秒へ写像する", (progress, expected) => {
    expect(progressToVideoTime(progress, 8)).toBeCloseTo(expected, 6);
  });

  it("最終フレームを越えない終端余白を適用する", () => {
    expect(progressToVideoTime(1, 8, 1 / 24)).toBeCloseTo(8 - 1 / 24, 6);
  });

  it("無効な動画時間を拒否する", () => {
    expect(() => progressToVideoTime(0.5, Number.NaN)).toThrow(RangeError);
    expect(() => progressToVideoTime(0.5, 0)).toThrow(RangeError);
  });
});

describe("フレームレート非依存の補間", () => {
  it("前進・後退のどちらでも目標を飛び越えない", () => {
    expect(smoothVideoTime(0, 8, 0.12, 1000 / 60)).toBeGreaterThan(0);
    expect(smoothVideoTime(0, 8, 0.12, 1000 / 60)).toBeLessThan(8);
    expect(smoothVideoTime(6, 2, 0.12, 1000 / 60)).toBeLessThan(6);
    expect(smoothVideoTime(6, 2, 0.12, 1000 / 60)).toBeGreaterThan(2);
  });

  it("約2フレーム分を一度に計算しても同じ位置へ近づく", () => {
    const once = smoothVideoTime(0, 8, 0.12, 1000 / 30);
    const first = smoothVideoTime(0, 8, 0.12, 1000 / 60);
    const twice = smoothVideoTime(first, 8, 0.12, 1000 / 60);
    expect(once).toBeCloseTo(twice, 5);
  });

  it("誤差が十分小さければ目標へスナップする", () => {
    expect(smoothVideoTime(3.999, 4, 0.12, 16, 0.002)).toBe(4);
  });
});

describe("PortalVideoScrubber", () => {
  it("progress設定時は直接seekせず、rAF内で補間する", () => {
    const scheduler = new ManualScheduler();
    const video = new FakeVideo();
    const scrubber = new PortalVideoScrubber(video, {
      scheduler,
      smoothing: 0.12,
      endHoldSeconds: 1 / 24,
    });

    scrubber.setProgress(0.5);
    expect(video.currentTime).toBe(0);
    scheduler.step(1000 / 60);
    expect(video.currentTime).toBeGreaterThan(0);
    expect(video.currentTime).toBeLessThan(4);
    expect(video.pause).toHaveBeenCalledOnce();
    expect(video.requestVideoFrameCallback).toHaveBeenCalled();
  });

  it("進行中に戻すと動画時刻も減少する", () => {
    const scheduler = new ManualScheduler();
    const video = new FakeVideo();
    const scrubber = new PortalVideoScrubber(video, {
      scheduler,
      smoothing: 0.12,
      endHoldSeconds: 1 / 24,
    });

    scrubber.setProgress(1);
    scheduler.step(16);
    scheduler.step(32);
    const forwardTime = video.currentTime;
    scrubber.setProgress(0);
    scheduler.step(48);
    expect(video.currentTime).toBeLessThan(forwardTime);
  });

  it("seek処理中は再代入せず、完了後に最新の補間位置を反映する", () => {
    const scheduler = new ManualScheduler();
    const video = new FakeVideo();
    const scrubber = new PortalVideoScrubber(video, {
      scheduler,
      smoothing: 0.12,
      endHoldSeconds: 1 / 24,
    });

    video.seeking = true;
    scrubber.setProgress(0.8);
    scheduler.step(16);
    scheduler.step(32);
    expect(video.currentTime).toBe(0);

    video.seeking = false;
    scheduler.step(48);
    expect(video.currentTime).toBeGreaterThan(0);
  });

  it("シーン固有の進捗→時刻写像を使用できる", () => {
    const scheduler = new ManualScheduler();
    const video = new FakeVideo();
    const progressToTime = vi.fn((progress: number, duration: number) =>
      progress < 0.5 ? progress * duration : duration / 2,
    );
    const scrubber = new PortalVideoScrubber(video, {
      scheduler,
      smoothing: 0.12,
      endHoldSeconds: 1 / 24,
      progressToTime,
    });

    scrubber.setProgress(0.75);
    scheduler.step(16);
    expect(progressToTime).toHaveBeenCalledWith(0.75, 8, 1 / 24);
    expect(video.currentTime).toBeGreaterThan(0);
    expect(video.currentTime).toBeLessThan(4);
  });

  it("高速スクロール時だけ強い補間で追従遅れを抑える", () => {
    const normalScheduler = new ManualScheduler();
    const catchUpScheduler = new ManualScheduler();
    const normalVideo = new FakeVideo();
    const catchUpVideo = new FakeVideo();
    const normal = new PortalVideoScrubber(normalVideo, {
      scheduler: normalScheduler,
      smoothing: 0.12,
      endHoldSeconds: 1 / 24,
    });
    const catchUp = new PortalVideoScrubber(catchUpVideo, {
      scheduler: catchUpScheduler,
      smoothing: 0.12,
      catchUpSmoothing: 0.26,
      catchUpThresholdSeconds: 0.75,
      endHoldSeconds: 1 / 24,
    });

    normal.setProgress(1);
    catchUp.setProgress(1);
    normalScheduler.step(16);
    catchUpScheduler.step(16);
    expect(catchUpVideo.currentTime).toBeGreaterThan(normalVideo.currentTime);
    expect(catchUpVideo.currentTime).toBeLessThan(8);
  });

  it("非表示化とdestroyでrAF/RVFCを破棄する", () => {
    const scheduler = new ManualScheduler();
    const video = new FakeVideo();
    const scrubber = new PortalVideoScrubber(video, {
      scheduler,
      smoothing: 0.12,
      endHoldSeconds: 1 / 24,
    });

    scrubber.setProgress(0.75);
    scheduler.step(16);
    scrubber.setActive(false);
    expect(scheduler.cancel).toHaveBeenCalled();
    scrubber.setActive(true);
    scrubber.destroy();
    scrubber.destroy();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(41);
  });
});
