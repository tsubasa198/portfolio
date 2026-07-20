/**
 * 待機アニメーションを、いま見えている姿勢を保ったまま止めて、
 * 動画先頭フレームと同じ基準姿勢へ収束させる。
 *
 * 静止レイヤーの位置とサイズを動画へ合わせても、マスコットがジャンプの
 * 途中だったりパネルが浮いている最中だったりすると、その分だけ動画と
 * ずれた状態でalphaが入れ替わり「別映像に切り替わった」ように見える。
 *
 * CSSアニメーションはinline styleより強いので、単にtransformを書いても
 * 効かない。またanimationを外すと姿勢が初期値へ飛ぶ。そのため
 * 「現在の計算値を書き写してからanimationを外す」順で処理する。
 */

/** 収束にかける時間。長いと待機が止まったことに気づかれる。 */
const SETTLE_DURATION_MS = 140;

/** 待機アニメーションを持ち、ハンドオフ前に基準姿勢へ戻す要素。 */
const SETTLE_SELECTORS = [
  ".hero-idle-mascot__jump",
  ".hero-idle-mascot__shadow",
  ".hero-layer--portal",
  ".hero-layer--orbit",
  ".hero-panel",
  ".hero-sphere",
] as const;

/** アニメーションで動かしている個別プロパティ。基準姿勢はいずれも初期値。 */
const ANIMATED_PROPERTIES = [
  "transform",
  "translate",
  "rotate",
  "scale",
  "filter",
  "opacity",
] as const;

interface SettleTarget {
  readonly element: HTMLElement;
  /** アニメーション適用前の値。ここへ戻すと動画先頭フレームと同じ姿勢になる。 */
  readonly restPose: Record<string, string>;
}

export interface HeroIdleSettle {
  /** 進捗0〜1で姿勢を収束させる。1で完全に基準姿勢。 */
  readonly setProgress: (progress: number) => void;
  readonly destroy: () => void;
}

/**
 * アニメーションを外した状態の計算値を読む。
 * これが動画先頭フレームと揃えるべき基準姿勢になる。
 */
function readRestPose(element: HTMLElement): Record<string, string> {
  const previous = element.style.animation;
  element.style.animation = "none";
  // 強制的に再計算させてから読む
  void element.offsetWidth;
  const computed = getComputedStyle(element);
  const pose: Record<string, string> = {};
  for (const property of ANIMATED_PROPERTIES) {
    pose[property] = computed.getPropertyValue(property);
  }
  element.style.animation = previous;
  return pose;
}

export function initHeroIdleSettle(scope: ParentNode): HeroIdleSettle {
  const targets: SettleTarget[] = [];
  for (const selector of SETTLE_SELECTORS) {
    for (const element of scope.querySelectorAll<HTMLElement>(selector)) {
      targets.push({ element, restPose: readRestPose(element) });
    }
  }

  let settled = false;

  /**
   * いま見えている姿勢を書き写してからCSSアニメーションを止め、
   * transitionで基準姿勢へ送る。
   * GSAPを使わないのは、translate/rotate/scaleの個別プロパティを
   * transformのショートハンドとして解釈されてしまうため。
   */
  const settle = () => {
    if (settled) return;
    settled = true;

    for (const target of targets) {
      const computed = getComputedStyle(target.element);
      const current: Record<string, string> = {};
      for (const property of ANIMATED_PROPERTIES) {
        current[property] = computed.getPropertyValue(property);
      }

      // 見た目を保ったままアニメーションを外す
      target.element.style.animation = "none";
      for (const [property, value] of Object.entries(current)) {
        target.element.style.setProperty(property, value);
      }
      // 書き込んだ値を確定させてからtransitionを張らないと補間されない
      void target.element.offsetWidth;

      target.element.style.transition = ANIMATED_PROPERTIES.map(
        (property) => `${property} ${SETTLE_DURATION_MS}ms ease-out`,
      ).join(", ");
      for (const property of ANIMATED_PROPERTIES) {
        target.element.style.setProperty(property, target.restPose[property]);
      }
    }
  };

  /** CSSアニメーションへ戻す。逆スクロールで待機状態へ復帰するときに使う。 */
  const release = () => {
    if (!settled) return;
    settled = false;
    for (const target of targets) {
      target.element.style.removeProperty("transition");
      target.element.style.removeProperty("animation");
      for (const property of ANIMATED_PROPERTIES) {
        target.element.style.removeProperty(property);
      }
    }
  };

  return {
    setProgress(progress: number) {
      if (progress > 0) settle();
      else release();
    },
    destroy() {
      release();
    },
  };
}
