/**
 * ハンドオフの位置合わせを目視で検証するための開発用モード。
 *
 * 静止レイヤーと動画先頭フレームを同じ座標系へ置いた状態で重ね、
 * 主要アンカー(ポータル中心・台座・マスコット)が二重に見えなくなるまで
 * 位置を詰めるために使う。本番のバンドルへ影響を出さないよう、
 * ?heroCalibration=1 が付いているときだけ初期化する。
 */

/** 動画の最初に描画されるフレーム。位置合わせの唯一の基準。 */
const REFERENCE_FRAME_SRC = "/assets/hero/hero-video-first-frame.webp";
/** 交互点滅の間隔。速すぎると差が読めず、遅いと比較しづらい。 */
const BLINK_INTERVAL_MS = 200;

type CalibrationMode =
  "layers" | "reference" | "overlay" | "blink" | "difference";

const MODE_LABELS: ReadonlyArray<{ mode: CalibrationMode; label: string }> = [
  { mode: "layers", label: "分解レイヤーのみ" },
  { mode: "reference", label: "動画先頭フレームのみ" },
  { mode: "overlay", label: "重ねて表示 (50%)" },
  { mode: "blink", label: "交互に点滅" },
  { mode: "difference", label: "差分表示" },
];

export interface HeroCalibration {
  readonly destroy: () => void;
}

export function isCalibrationRequested(search: string): boolean {
  return new URLSearchParams(search).get("heroCalibration") === "1";
}

/**
 * 静止レイヤーの集合。背景・分解レイヤー・マスコット・前景を
 * ひとまとまりとして扱い、参照フレームと切り替える。
 */
function collectIdleLayers(scope: ParentNode): HTMLElement[] {
  const selectors = [
    ".js-hero-idle-background",
    ".hero-detail-layer",
    ".hero-mascot-layer",
    ".hero-foreground-layer",
  ];
  return selectors
    .map((selector) => scope.querySelector<HTMLElement>(selector))
    .filter((element): element is HTMLElement => element !== null);
}

export function initHeroCalibration(
  search: string = window.location.search,
): HeroCalibration | null {
  if (!isCalibrationRequested(search)) return null;

  const camera = document.querySelector<HTMLElement>(".js-portal-camera");
  if (!camera) return null;

  const layers = collectIdleLayers(camera);
  if (layers.length === 0) return null;

  // 参照フレームは動画と同じ矩形・同じobject-fitで敷く。
  // ここがずれると比較自体が意味を失う。
  const reference = document.createElement("img");
  reference.src = REFERENCE_FRAME_SRC;
  reference.alt = "";
  reference.className = "hero-calibration-reference";
  camera.appendChild(reference);

  const panel = document.createElement("div");
  panel.className = "hero-calibration-panel";
  const title = document.createElement("p");
  title.className = "hero-calibration-panel__title";
  title.textContent = "ハンドオフ位置合わせ";
  panel.appendChild(title);

  let mode: CalibrationMode = "overlay";
  let blinkTimer: number | undefined;
  let blinkShowsReference = false;

  const applyMode = () => {
    window.clearInterval(blinkTimer);
    blinkTimer = undefined;
    reference.style.mixBlendMode = "normal";

    const setLayers = (opacity: number) => {
      for (const layer of layers) layer.style.opacity = String(opacity);
    };

    switch (mode) {
      case "layers":
        setLayers(1);
        reference.style.opacity = "0";
        break;
      case "reference":
        setLayers(0);
        reference.style.opacity = "1";
        break;
      case "overlay":
        setLayers(1);
        reference.style.opacity = "0.5";
        break;
      case "difference":
        setLayers(1);
        reference.style.opacity = "1";
        // 一致した箇所が黒く沈むので、ずれだけが浮かび上がる
        reference.style.mixBlendMode = "difference";
        break;
      case "blink":
        blinkShowsReference = false;
        blinkTimer = window.setInterval(() => {
          blinkShowsReference = !blinkShowsReference;
          setLayers(blinkShowsReference ? 0 : 1);
          reference.style.opacity = blinkShowsReference ? "1" : "0";
        }, BLINK_INTERVAL_MS);
        break;
    }

    for (const button of panel.querySelectorAll<HTMLButtonElement>("button")) {
      button.dataset.active = String(button.dataset.mode === mode);
    }
  };

  for (const { mode: value, label } of MODE_LABELS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mode = value;
    button.textContent = label;
    button.addEventListener("click", () => {
      mode = value;
      applyMode();
    });
    panel.appendChild(button);
  }

  const hint = document.createElement("p");
  hint.className = "hero-calibration-panel__hint";
  hint.textContent = "ポータル中心・台座・マスコットが二重に見えなければ一致";
  panel.appendChild(hint);

  document.body.appendChild(panel);
  document.body.classList.add("hero-calibration-active");
  applyMode();

  return {
    destroy() {
      window.clearInterval(blinkTimer);
      reference.remove();
      panel.remove();
      document.body.classList.remove("hero-calibration-active");
      for (const layer of layers) layer.style.removeProperty("opacity");
    },
  };
}
