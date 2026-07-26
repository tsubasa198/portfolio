/**
 * 読み込み時の開始位置の決定。
 *
 * ハッシュ着地(#worksで実績カードへ等)は詳細ページからの戻り導線に
 * 必要だが、リロードにまで適用すると「さっき見ていたセクションから
 * 再開」してしまい、演出の途中から始まって見える。リロードは常に
 * ファーストビューから始め、ハッシュ着地は通常遷移・戻る/進むに限る。
 */
export type InitialScrollMode = "top" | "hash-landing";

export function initialScrollModeFor(
  navigationType: string | undefined,
  hash: string,
): InitialScrollMode {
  if (navigationType === "reload") return "top";
  if (!hash || hash === "#" || hash === "#hero") return "top";
  return "hash-landing";
}
