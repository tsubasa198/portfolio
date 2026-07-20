export const MEDIA_HAVE_FUTURE_DATA = 3;

export interface LoadablePortalVideo extends EventTarget {
  readonly readyState: number;
  readonly duration: number;
  readonly error: { readonly code: number } | null;
  load(): void;
  /** 実DOMだけが持つ。テスト用のモックでは省略できるよう任意にしている。 */
  currentTime?: number;
  requestVideoFrameCallback?(callback: () => void): number;
}

/** 最初のフレーム描画を待つ上限。これを超えたら待たずに進む。 */
const FIRST_FRAME_TIMEOUT_MS = 400;

/**
 * 先頭フレームが実際に描画可能になるまで待つ。
 * readyStateがcanplayでも、最初のフレームが出る前に静止レイヤーを
 * 消すと一瞬黒が覗く。ハンドオフの基準も0秒の絵なので、ここで
 * currentTimeを0へ戻しておく。
 */
function waitForFirstFrame(video: LoadablePortalVideo): Promise<void> {
  if (typeof video.requestVideoFrameCallback !== "function") {
    return Promise.resolve();
  }
  if (typeof video.currentTime === "number" && video.currentTime !== 0) {
    video.currentTime = 0;
  }
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    video.requestVideoFrameCallback!(finish);
    // seekが起きない場合はコールバックが来ないため、待ち続けない
    setTimeout(finish, FIRST_FRAME_TIMEOUT_MS);
  });
}

export interface PreparePortalVideoOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

function validDuration(duration: number): boolean {
  return Number.isFinite(duration) && duration > 0;
}

/** metadataだけでなく、最初のシークを受けられるcanplay状態まで待つ。 */
export function preparePortalVideo(
  video: LoadablePortalVideo,
  options: PreparePortalVideoOptions,
): Promise<number> {
  if (video.error) {
    return Promise.reject(
      new Error(
        `ポータル動画を読み込めませんでした (code: ${video.error.code})`,
      ),
    );
  }
  if (
    video.readyState >= MEDIA_HAVE_FUTURE_DATA &&
    validDuration(video.duration)
  ) {
    return waitForFirstFrame(video).then(() => video.duration);
  }
  if (options.signal?.aborted) {
    return Promise.reject(new Error("ポータル動画の読み込みを中断しました"));
  }

  return new Promise<number>((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
      options.signal?.removeEventListener("abort", handleAbort);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };

    const finish = (duration: number) => {
      if (settled) return;
      settled = true;
      cleanup();
      // 最初のフレームが描けるまでは静止レイヤーを消させない
      void waitForFirstFrame(video).then(() => resolve(duration));
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    function handleReady(): void {
      if (video.readyState < MEDIA_HAVE_FUTURE_DATA) return;
      if (!validDuration(video.duration)) {
        fail(new Error(`ポータル動画の再生時間が不正です: ${video.duration}`));
        return;
      }
      finish(video.duration);
    }

    function handleError(): void {
      const code = video.error?.code ?? "unknown";
      fail(new Error(`ポータル動画を読み込めませんでした (code: ${code})`));
    }

    function handleAbort(): void {
      fail(new Error("ポータル動画の読み込みを中断しました"));
    }

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleError);
    options.signal?.addEventListener("abort", handleAbort, { once: true });
    timeoutId = setTimeout(() => {
      fail(
        new Error(
          `ポータル動画の読み込みが${options.timeoutMs}ms以内に完了しませんでした`,
        ),
      );
    }, options.timeoutMs);

    try {
      video.load();
      handleReady();
    } catch (error) {
      fail(
        error instanceof Error
          ? error
          : new Error("ポータル動画の読み込み開始に失敗しました"),
      );
    }
  });
}
