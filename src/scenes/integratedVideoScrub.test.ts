import { describe, expect, it, vi } from "vitest";
import {
  IntegratedVideoScrubber,
  type IntegratedScrubVideo,
  type ProgressFrameScheduler,
} from "./integratedVideoScrub";

class ManualScheduler implements ProgressFrameScheduler {
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

class FakeVideo implements IntegratedScrubVideo {
  currentTime = 0;
  duration = 8;
  seeking = false;
  readonly pause = vi.fn();
  readonly requestVideoFrameCallback = vi.fn(() => 31);
  readonly cancelVideoFrameCallback = vi.fn();
}

describe("IntegratedVideoScrubber", () => {
  it("2本をpauseしたまま、同じrAF補間進捗でseekする", () => {
    const scheduler = new ManualScheduler();
    const existing = new FakeVideo();
    const additional = new FakeVideo();
    const updates = vi.fn();
    const scrubber = new IntegratedVideoScrubber(existing, additional, {
      scheduler,
      smoothing: 0.12,
      settleEpsilon: 0.0001,
      maxDeltaMs: 50,
      seekEpsilonSeconds: 1 / 120,
      onUpdate: updates,
    });

    scrubber.setProgress(0.455);
    expect(existing.currentTime).toBe(0);
    scheduler.step(16);
    expect(existing.currentTime).toBeGreaterThan(0);
    expect(existing.pause).toHaveBeenCalledOnce();
    expect(additional.pause).toHaveBeenCalledOnce();
    expect(updates).toHaveBeenCalled();
  });

  it("接続区間まで進むと両動画が同時に動き、逆スクロールにも追従する", () => {
    const scheduler = new ManualScheduler();
    const existing = new FakeVideo();
    const additional = new FakeVideo();
    const scrubber = new IntegratedVideoScrubber(existing, additional, {
      scheduler,
      smoothing: 0.2,
      settleEpsilon: 0.0001,
      maxDeltaMs: 50,
      seekEpsilonSeconds: 1 / 120,
    });

    scrubber.setProgress(0.455);
    for (let index = 1; index <= 50; index += 1) scheduler.step(index * 16);
    expect(existing.currentTime).toBeGreaterThan(7.66);
    expect(additional.currentTime).toBeGreaterThan(0);

    const forwardExisting = existing.currentTime;
    const forwardAdditional = additional.currentTime;
    scrubber.setProgress(0.2);
    for (let index = 51; index <= 80; index += 1) scheduler.step(index * 16);
    expect(existing.currentTime).toBeLessThan(forwardExisting);
    expect(additional.currentTime).toBeLessThan(forwardAdditional);
  });

  it("seek中の動画だけ再代入せず、他方とマスター進捗は継続する", () => {
    const scheduler = new ManualScheduler();
    const existing = new FakeVideo();
    const additional = new FakeVideo();
    const updates = vi.fn();
    const scrubber = new IntegratedVideoScrubber(existing, additional, {
      scheduler,
      smoothing: 0.2,
      settleEpsilon: 0.0001,
      maxDeltaMs: 50,
      seekEpsilonSeconds: 1 / 120,
      onUpdate: updates,
    });

    existing.seeking = true;
    scrubber.setProgress(0.6);
    for (let index = 1; index <= 30; index += 1) scheduler.step(index * 16);
    expect(existing.currentTime).toBe(0);
    expect(additional.currentTime).toBeGreaterThan(0);
    expect(updates).toHaveBeenCalledTimes(30);

    existing.seeking = false;
    scheduler.step(31 * 16);
    expect(existing.currentTime).toBeGreaterThan(0);
  });

  it("非表示化とdestroyでrAF・RVFCを確実に破棄する", () => {
    const scheduler = new ManualScheduler();
    const existing = new FakeVideo();
    const additional = new FakeVideo();
    const scrubber = new IntegratedVideoScrubber(existing, additional, {
      scheduler,
      smoothing: 0.12,
      settleEpsilon: 0.0001,
      maxDeltaMs: 50,
      seekEpsilonSeconds: 1 / 120,
    });

    scrubber.setProgress(0.7);
    scheduler.step(16);
    scrubber.setActive(false);
    expect(scheduler.cancel).toHaveBeenCalled();
    scrubber.setActive(true);
    scrubber.destroy();
    scrubber.destroy();
    expect(existing.cancelVideoFrameCallback).toHaveBeenCalledWith(31);
    expect(additional.cancelVideoFrameCallback).toHaveBeenCalledWith(31);
  });
});
