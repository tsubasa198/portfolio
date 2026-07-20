import { TRANSITION_CONFIG } from "./portalTransitionConfig";

/**
 * ステージ中心から広がるエネルギー波紋。
 *
 * 静止レイヤーと動画は素材が別物なので、位置を詰めても発光や粒子の差は残る。
 * その差を目立たせないよう、切り替えの瞬間に光を重ねて視線を奪う。
 * 波紋が最も強くなる時点をalphaの入れ替え位置に合わせてあるので、
 * ユーザーには「切り替わった」ではなく「同じ世界が動き出した」と映る。
 *
 * ?heroRipple=off で無効化でき、波紋あり/なしを比較できる。
 */

/** 波紋が出はじめる進捗。スクロールに反応していることをすぐ伝える。 */
const RIPPLE_START = 0.001;
/** 波紋が消え切る進捗。動画側の演出へ渡したあとは残さない。 */
const RIPPLE_END = 0.055;
/**
 * リング1本ごとの発生間隔。0〜1で表した波紋区間内の位相差。
 * 間隔を空けすぎると1本ずつしか見えず、波紋ではなく単発の輪になる。
 */
const RING_PHASE_OFFSETS = [0, 0.16, 0.32] as const;
/** リングの拡大率。1で画面端に届く大きさになる。 */
const RING_MAX_SCALE = 1;
/** リングの出発点。0にすると点から始まって不自然なので少し大きさを持たせる。 */
const RING_MIN_SCALE = 0.06;

export interface HeroRipple {
  readonly setProgress: (progress: number) => void;
  readonly destroy: () => void;
}

export function isRippleDisabled(search: string): boolean {
  return new URLSearchParams(search).get("heroRipple") === "off";
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 立ち上がりは速く、減衰はゆるやかにして、光が引いていく余韻を作る。 */
function ringIntensity(phase: number): number {
  if (phase <= 0 || phase >= 1) return 0;
  const rise = Math.min(1, phase / 0.18);
  const fall = 1 - Math.max(0, (phase - 0.18) / 0.82);
  return rise * fall * fall;
}

export function initHeroRipple(
  scope: ParentNode,
  search: string = window.location.search,
): HeroRipple | null {
  const root = scope.querySelector<HTMLElement>(".js-hero-ripple");
  if (!root) return null;

  if (isRippleDisabled(search)) {
    root.dataset.heroRipple = "off";
    return {
      setProgress: () => {},
      destroy: () => {},
    };
  }

  const rings = [...root.querySelectorAll<HTMLElement>(".hero-ripple__ring")];
  const core = root.querySelector<HTMLElement>(".hero-ripple__core");

  /**
   * 波紋全体の強さ。
   * alphaを入れ替える区間で最大になるよう、ピークをhandoffEndへ寄せる。
   */
  const overallIntensity = (rippleProgress: number): number => {
    const peak =
      (TRANSITION_CONFIG.heroIdleHandoffEnd - RIPPLE_START) /
      (RIPPLE_END - RIPPLE_START);
    if (rippleProgress <= peak) {
      return clamp01(rippleProgress / peak);
    }
    return clamp01(1 - (rippleProgress - peak) / (1 - peak));
  };

  const setProgress = (progress: number) => {
    const rippleProgress = clamp01(
      (progress - RIPPLE_START) / (RIPPLE_END - RIPPLE_START),
    );

    if (rippleProgress <= 0 || rippleProgress >= 1) {
      root.style.opacity = "0";
      return;
    }

    root.style.opacity = overallIntensity(rippleProgress).toFixed(3);

    rings.forEach((ring, index) => {
      // 各リングは位相をずらして順に生まれ、外へ抜けていく
      const phase = clamp01(
        (rippleProgress - RING_PHASE_OFFSETS[index]) /
          (1 - RING_PHASE_OFFSETS[index]),
      );
      const scale = RING_MIN_SCALE + (RING_MAX_SCALE - RING_MIN_SCALE) * phase;
      ring.style.transform = `scale(${scale.toFixed(4)})`;
      ring.style.opacity = ringIntensity(phase).toFixed(3);
    });

    if (core) {
      // 芯は最初だけ強く光り、リングを送り出したら引く
      const coreFade = clamp01(1 - rippleProgress / 0.5);
      core.style.opacity = (coreFade * coreFade).toFixed(3);
      core.style.transform = `scale(${(0.6 + rippleProgress * 0.8).toFixed(3)})`;
    }
  };

  setProgress(0);

  return {
    setProgress,
    destroy() {
      root.style.removeProperty("opacity");
      for (const ring of rings) {
        ring.style.removeProperty("transform");
        ring.style.removeProperty("opacity");
      }
      core?.style.removeProperty("opacity");
      core?.style.removeProperty("transform");
    },
  };
}
