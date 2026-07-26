/**
 * 制作実績カードの「自然位置」(transform適用前のレイアウト座標)を計測する。
 *
 * .work-card には transform の transition が付いているため、インラインの
 * transform を外しただけでは反映が0.4秒遅れ、古い(持ち上げ済みの)座標の
 * まま計測されてしまう。works02表示中にリサイズ/ScrollTrigger refreshが
 * 走ると行間シフト量が壊れてカードがタイトルとズレる原因になっていた。
 * 計測中は transition ごと無効化し、復元時もreflowを挟んで
 * トランジションの再発火(カードが一瞬アニメで戻る現象)を防ぐ。
 */

export interface MeasurableElement {
  readonly style: { transform: string; transition: string };
  getBoundingClientRect(): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface CardGeometry {
  readonly centerX: number;
  readonly centerY: number;
}

export function measureCardGeometry(
  cards: readonly MeasurableElement[],
  stage: MeasurableElement,
): CardGeometry[] {
  const previousStyles = cards.map((card) => ({
    transform: card.style.transform,
    transition: card.style.transition,
  }));
  cards.forEach((card) => {
    card.style.transition = "none";
    card.style.transform = "none";
  });
  try {
    const stageRect = stage.getBoundingClientRect();
    return cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        centerX: rect.left - stageRect.left + rect.width / 2,
        centerY: rect.top - stageRect.top + rect.height / 2,
      };
    });
  } finally {
    cards.forEach((card, index) => {
      card.style.transform = previousStyles[index].transform;
    });
    // transformの復元をレイアウトへ確定させてからtransitionを返す。
    // 同時に戻すと「none→元の値」の変化がトランジション扱いになり、
    // カードが0.4秒かけて滑り戻る視覚ノイズが出る。
    cards[0]?.getBoundingClientRect();
    cards.forEach((card, index) => {
      card.style.transition = previousStyles[index].transition;
    });
  }
}
