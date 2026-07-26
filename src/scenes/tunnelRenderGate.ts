/**
 * トンネルCanvasの描画頻度を制御するゲート。
 *
 * アイドル中(スクロールが止まり進捗が変わらない間)は、時刻駆動の
 * 環境光アニメを30fpsに間引く。ポータルの明滅はゆっくりした周期なので
 * 30fpsで視覚差はなく、120Hzディスプレイでは全画面Canvas再描画
 * (shadowBlur付き)が1/4になり、アイドル時のGPU/CPU発熱を抑えられる。
 * スクラブ中(進捗が動いている間)は従来通り毎フレーム描画して
 * 追従性を保つ。
 */
const IDLE_FPS = 30;
export const IDLE_FRAME_INTERVAL_MS = 1000 / IDLE_FPS;
// rAFの時刻には丸め誤差やジッタがあるため、境界判定に僅かな余裕を持たせる
const INTERVAL_TOLERANCE_MS = 0.5;

export class TunnelRenderGate {
  private lastProgress: number | null = null;
  private lastRenderAtMs: number | null = null;

  shouldRender(progress: number, nowMs: number): boolean {
    // 不正値やタイマー巻き戻りは描画スキップより安全な「描画する」に倒す
    const progressChanged =
      this.lastProgress === null ||
      !Number.isFinite(progress) ||
      progress !== this.lastProgress;
    const elapsedMs =
      this.lastRenderAtMs === null ? Infinity : nowMs - this.lastRenderAtMs;
    const intervalElapsed =
      !Number.isFinite(elapsedMs) ||
      elapsedMs < 0 ||
      elapsedMs >= IDLE_FRAME_INTERVAL_MS - INTERVAL_TOLERANCE_MS;

    if (!progressChanged && !intervalElapsed) return false;

    this.lastProgress = progress;
    this.lastRenderAtMs = nowMs;
    return true;
  }
}
