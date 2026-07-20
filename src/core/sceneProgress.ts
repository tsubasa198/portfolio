/**
 * スクロール駆動アニメーションの進捗計算。
 * ionic (ionic.co.jp) の World/rangeProgress 方式を踏襲した純粋関数群。
 */

export function clamp01(value: number): number {
  // NaNはスクロール量が取得できない環境(初期化前など)で起こり得るため0に倒す
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * ページ全体のスクロール量から、あるシーン区間内の進捗(0〜1)を返す。
 * @param scrollY 現在のスクロール量(px)
 * @param sceneTop シーン開始位置(px)
 * @param sceneLength シーンのスクロール長(px)
 */
export function sceneProgress(
  scrollY: number,
  sceneTop: number,
  sceneLength: number,
): number {
  if (sceneLength <= 0) {
    throw new RangeError(`sceneLength must be positive, got ${sceneLength}`);
  }
  return clamp01((scrollY - sceneTop) / sceneLength);
}

/**
 * マスター進捗(0〜1)の部分区間 [start, end] をローカル進捗0〜1に写像する。
 * 1本のタイムラインを複数シーンに分割するときに使う。
 */
export function segmentProgress(
  master: number,
  start: number,
  end: number,
): number {
  if (start >= end) {
    throw new RangeError(`segment start (${start}) must be < end (${end})`);
  }
  return clamp01((master - start) / (end - start));
}
