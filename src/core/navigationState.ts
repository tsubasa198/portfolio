import { clamp01 } from "./sceneProgress";

export interface DisclosureState {
  ariaExpanded: "true" | "false";
  panelHidden: boolean;
}

/** 固定ステージの進捗を、ページ全体のスクロール座標へ変換する。 */
export function sceneScrollTop(
  sectionTop: number,
  sectionHeight: number,
  viewportHeight: number,
  progress: number,
): number {
  if (!Number.isFinite(sectionTop)) {
    throw new RangeError(`sectionTop must be finite, got ${sectionTop}`);
  }
  if (!Number.isFinite(sectionHeight) || sectionHeight <= 0) {
    throw new RangeError(
      `sectionHeight must be positive, got ${sectionHeight}`,
    );
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new RangeError(
      `viewportHeight must be positive, got ${viewportHeight}`,
    );
  }

  const scrollableLength = Math.max(0, sectionHeight - viewportHeight);
  return sectionTop + scrollableLength * clamp01(progress);
}

/** ボタンとメニューパネルで共有する開閉属性を一箇所で決定する。 */
export function disclosureState(expanded: boolean): DisclosureState {
  return {
    ariaExpanded: expanded ? "true" : "false",
    panelHidden: !expanded,
  };
}
