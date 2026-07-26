/**
 * スクラブ演出を止めて静的表示にするかの判定。
 *
 * タッチ主体の端末(スマホ・タブレット)はスクラブ操作と相性が悪く、
 * 発熱・電池・通信量の面でも動画演出が不利なため、OSのモーション低減
 * 設定と同じ「静的フォールバック」経路に合流させる。
 * hoverできる端末(タッチ対応ノートPC等)は演出を維持する。
 */
export const TOUCH_STATIC_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

export function shouldUseStaticPresentation(
  prefersReducedMotion: boolean,
  touchPrimary: boolean,
): boolean {
  return prefersReducedMotion || touchPrimary;
}
