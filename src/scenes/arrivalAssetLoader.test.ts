import { describe, expect, it, vi } from "vitest";
import { prepareArrivalImages, type DecodableImage } from "./arrivalAssetLoader";

class FakeImage extends EventTarget implements DecodableImage {
  complete = true;
  naturalWidth = 100;
  readonly decode = vi.fn(async () => undefined);
}

describe("到着レイヤーの準備", () => {
  it("全画像をdecodeしてから解決する", async () => {
    const images = [new FakeImage(), new FakeImage()];
    await prepareArrivalImages(images, { timeoutMs: 1000 });
    expect(images[0].decode).toHaveBeenCalledOnce();
    expect(images[1].decode).toHaveBeenCalledOnce();
  });

  it("壊れた画像と中断を握りつぶさない", async () => {
    const broken = new FakeImage();
    broken.naturalWidth = 0;
    await expect(
      prepareArrivalImages([broken], { timeoutMs: 1000 }),
    ).rejects.toThrow("到着レイヤー");

    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareArrivalImages([new FakeImage()], {
        timeoutMs: 1000,
        signal: controller.signal,
      }),
    ).rejects.toThrow("中断");
  });
});
