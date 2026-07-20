export const MEDIA_HAVE_FUTURE_DATA = 3;

export interface LoadablePortalVideo extends EventTarget {
  readonly readyState: number;
  readonly duration: number;
  readonly error: { readonly code: number } | null;
  load(): void;
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
      new Error(`ポータル動画を読み込めませんでした (code: ${video.error.code})`),
    );
  }
  if (
    video.readyState >= MEDIA_HAVE_FUTURE_DATA &&
    validDuration(video.duration)
  ) {
    return Promise.resolve(video.duration);
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
      resolve(duration);
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
