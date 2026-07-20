import { describe, expect, it, vi } from "vitest";
import {
  MEDIA_HAVE_FUTURE_DATA,
  preparePortalVideo,
  type LoadablePortalVideo,
} from "./portalVideoLoader";

class FakeVideo extends EventTarget implements LoadablePortalVideo {
  readyState = 0;
  duration = Number.NaN;
  error: { readonly code: number } | null = null;
  readonly load = vi.fn();
}

describe("スクラブ動画の準備", () => {
  it("十分なデータと有効なdurationがあれば即時解決する", async () => {
    const video = new FakeVideo();
    video.readyState = MEDIA_HAVE_FUTURE_DATA;
    video.duration = 8;
    await expect(preparePortalVideo(video, { timeoutMs: 1000 })).resolves.toBe(8);
  });

  it("metadataだけでは解決せずcanplayまで待つ", async () => {
    const video = new FakeVideo();
    let resolved = false;
    const preparation = preparePortalVideo(video, { timeoutMs: 1000 }).then(
      () => {
        resolved = true;
      },
    );

    video.readyState = 1;
    video.duration = 8;
    video.dispatchEvent(new Event("loadedmetadata"));
    await Promise.resolve();
    expect(resolved).toBe(false);

    video.readyState = MEDIA_HAVE_FUTURE_DATA;
    video.dispatchEvent(new Event("canplay"));
    await preparation;
    expect(resolved).toBe(true);
  });

  it("読み込み失敗と中断を握りつぶさない", async () => {
    const failedVideo = new FakeVideo();
    const failed = preparePortalVideo(failedVideo, { timeoutMs: 1000 });
    failedVideo.error = { code: 3 };
    failedVideo.dispatchEvent(new Event("error"));
    await expect(failed).rejects.toThrow("ポータル動画を読み込めませんでした");

    const controller = new AbortController();
    const aborted = preparePortalVideo(new FakeVideo(), {
      timeoutMs: 1000,
      signal: controller.signal,
    });
    controller.abort();
    await expect(aborted).rejects.toThrow("中断");
  });
});
