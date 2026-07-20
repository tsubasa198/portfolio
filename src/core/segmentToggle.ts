/**
 * 進捗0〜1に対して「この区間にいる間だけ表示」を宣言的に扱うヘルパー。
 * ionicのタイムラインラベル(visible→静止→hidden)のクラス版。
 */

export interface ToggleRange {
  el: Element;
  /** この進捗以上で表示 */
  start: number;
  /** この進捗を超えたら非表示 (省略時は最後まで表示 = 積み上げ型) */
  end?: number;
  className?: string;
}

const DEFAULT_CLASS = "is-visible";

export function applyToggles(
  progress: number,
  ranges: readonly ToggleRange[],
): void {
  for (const range of ranges) {
    const active =
      progress >= range.start &&
      (range.end === undefined || progress < range.end);
    range.el.classList.toggle(range.className ?? DEFAULT_CLASS, active);
  }
}

/** 区間 [start, end] 内の等間隔ステップに要素群を割り当てる (チャット吹き出し等の順次出現用) */
export function staggerRanges(
  els: readonly Element[],
  start: number,
  end: number,
  hideAfter?: number,
): ToggleRange[] {
  if (els.length === 0) return [];
  const step = (end - start) / els.length;
  return els.map((el, i) => ({
    el,
    start: start + step * i,
    end: hideAfter,
  }));
}
