export interface DecodableImage extends EventTarget {
  readonly complete: boolean;
  readonly naturalWidth: number;
  decode?(): Promise<void>;
}

export interface ArrivalAssetLoadOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

function abortError(): Error {
  return new Error("到着レイヤーの読み込みを中断しました");
}

async function decodeImage(image: DecodableImage): Promise<void> {
  if (image.decode) {
    await image.decode();
  } else if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        image.removeEventListener("load", handleLoad);
        image.removeEventListener("error", handleError);
      };
      const handleLoad = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error("到着レイヤー画像を読み込めませんでした"));
      };
      image.addEventListener("load", handleLoad, { once: true });
      image.addEventListener("error", handleError, { once: true });
    });
  }

  if (image.naturalWidth <= 0) {
    throw new Error("到着レイヤー画像を読み込めませんでした");
  }
}

/** 使用対象画像のデコードが終わるまで、統合タイムラインを開始させない。 */
export async function prepareArrivalImages(
  images: readonly DecodableImage[],
  options: ArrivalAssetLoadOptions,
): Promise<void> {
  if (images.length === 0) {
    throw new Error("到着レイヤー画像が見つかりません");
  }
  if (options.signal?.aborted) throw abortError();

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let handleAbort: (() => void) | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `到着レイヤーの読み込みが${options.timeoutMs}ms以内に完了しませんでした`,
        ),
      );
    }, options.timeoutMs);
  });
  const aborted = new Promise<never>((_resolve, reject) => {
    if (!options.signal) return;
    handleAbort = () => reject(abortError());
    options.signal.addEventListener("abort", handleAbort, { once: true });
  });

  try {
    await Promise.race([
      Promise.all(images.map((image) => decodeImage(image))),
      timeout,
      aborted,
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
    if (options.signal && handleAbort) {
      options.signal.removeEventListener("abort", handleAbort);
    }
  }
}
