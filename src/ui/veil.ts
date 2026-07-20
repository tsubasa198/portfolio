/**
 * シーン間の「光のベール」。
 * トンネル終端の光→次シーンが光の中から現れる、という画面固定のままの遷移を作る。
 * sticky解除後の物理スクロール区間(デッドゾーン)を不透明な光で覆い隠すのが役割。
 */

const VEIL_COLOR =
  "radial-gradient(circle at 50% 50%, rgba(255, 248, 226, 0.98) 0%, rgba(255, 178, 86, 0.82) 18%, rgba(255, 111, 38, 0.32) 44%, transparent 74%)";

export interface Veil {
  /** 0(透明)〜1(完全に光で覆う) */
  set(opacity: number): void;
  destroy(): void;
}

export function createVeil(): Veil {
  const el = document.createElement("div");
  el.className = "transition-veil";
  el.style.background = VEIL_COLOR;
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);

  let current = -1;
  return {
    set(opacity: number) {
      const clamped = Math.min(1, Math.max(0, opacity));
      // 毎フレーム同じ値を書き続けない (スクロールイベントは高頻度なため)
      if (Math.abs(clamped - current) < 0.001) return;
      current = clamped;
      el.style.opacity = String(clamped);
      el.style.visibility = clamped === 0 ? "hidden" : "visible";
    },
    destroy() {
      el.remove();
    },
  };
}
