import { clamp01 } from "./sceneProgress";

/**
 * 進捗(0〜1)から画像シーケンスのフレーム番号を返す。
 * AI生成のフレーム連番をcanvasでスクラブ再生する(Apple製品ページ方式)ための土台。
 */
export function frameIndexFor(progress: number, frameCount: number): number {
  if (frameCount <= 0) {
    throw new RangeError(`frameCount must be positive, got ${frameCount}`);
  }
  // roundだと0.5境界の揺れでフレームが前後する。floorで単調に進める
  return Math.floor(clamp01(progress) * (frameCount - 1));
}
