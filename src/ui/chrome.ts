/**
 * 共通UI: 進捗バー / シーンインジケータ / ナビ / ローディング /
 * リビール / 文字送り分割 / デバッグHUD (ionicのdat.GUI相当)。
 */

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { disclosureState, sceneScrollTop } from "../core/navigationState";
import { navigationSceneId } from "../core/sceneConfig";
import { normalizeSplitText, splitChars } from "../core/splitText";

const REVEAL_THRESHOLD = 0.25;

/** h1/h2を1文字ずつspan化して、CSSの文字送りトランジションを効かせる */
export function initSplitTitles(): void {
  for (const el of document.querySelectorAll<HTMLElement>(".js-split")) {
    const text = normalizeSplitText(el.textContent ?? "");
    el.textContent = "";
    splitChars(text).forEach((char, i) => {
      const span = document.createElement("span");
      span.className = "char";
      span.style.setProperty("--char-index", String(i));
      // スペースが潰れないようにNBSPへ置換
      span.textContent = char === " " ? " " : char;
      el.appendChild(span);
    });
  }
}

export function initLoading(): void {
  const loading = document.querySelector<HTMLElement>(".js-loading");
  if (!loading) return;
  // load完了で消す。既に読み込み済みの場合(dev再起動等)にも対応
  const hide = () => loading.classList.add("is-hidden");
  if (document.readyState === "complete") hide();
  else window.addEventListener("load", hide);
}

export type SceneScrollHandler = (top: number) => void;

/** 固定ステージへのリンクを、演出が読めるシーン内位置へ着地させる。 */
export function initSceneNavigation(
  scrollTo: SceneScrollHandler,
  reducedMotion: boolean,
): void {
  const links = document.querySelectorAll<HTMLAnchorElement>(
    "a[data-scene-progress]",
  );
  for (const link of links) {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href?.startsWith("#")) return;

      const target = document.getElementById(href.slice(1));
      if (!target) return;

      event.preventDefault();
      try {
        const requestedProgress = Number(link.dataset.sceneProgress ?? "0");
        const progress = reducedMotion ? 0 : requestedProgress;
        const top = sceneScrollTop(
          target.offsetTop,
          target.offsetHeight,
          window.innerHeight,
          progress,
        );
        if (window.location.hash !== href) {
          window.history.pushState(null, "", href);
        }
        scrollTo(top);
      } catch {
        // レイアウト計測ができない場合も、通常のアンカー移動は維持する
        target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      }
    });
  }
}

/** モバイルヘッダーの開閉と、Esc・外側クリック・リンク選択時の閉じる動作。 */
export function initMobileMenu(): void {
  const button = document.querySelector<HTMLButtonElement>(
    ".js-mobile-menu-toggle",
  );
  const panel = document.querySelector<HTMLElement>(".js-mobile-navigation");
  if (!button || !panel) return;

  let expanded = false;
  const setExpanded = (next: boolean) => {
    expanded = next;
    const state = disclosureState(expanded);
    button.setAttribute("aria-expanded", state.ariaExpanded);
    panel.hidden = state.panelHidden;
  };

  setExpanded(false);
  button.addEventListener("click", () => setExpanded(!expanded));
  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setExpanded(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !expanded) return;
    setExpanded(false);
    button.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!expanded || !(event.target instanceof Node)) return;
    if (button.contains(event.target) || panel.contains(event.target)) return;
    setExpanded(false);
  });

  const desktop = window.matchMedia("(min-width: 821px)");
  desktop.addEventListener("change", (event) => {
    if (event.matches) setExpanded(false);
  });
}

export function initProgressBar(): void {
  const fill = document.querySelector<HTMLElement>(".js-progress");
  if (!fill) return;
  ScrollTrigger.create({
    trigger: document.body,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      fill.style.transform = `scaleX(${self.progress})`;
    },
  });
}

/** 通常セクション(07-09)のふわっと出現 */
export function initReveals(): void {
  const targets = document.querySelectorAll(".js-reveal");
  if (targets.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target); // 一度出たら出しっぱなし
        }
      }
    },
    { threshold: REVEAL_THRESHOLD },
  );
  targets.forEach((el) => observer.observe(el));
}

export interface IndicatorController {
  setScene(id: string): void;
}

/**
 * 現在のシーンをヘッダーナビへ反映する。
 * 右端に出していた補助ラベルは廃止したので、ここではナビだけを更新する。
 */
export function initIndicator(): IndicatorController {
  const navPills = [
    ...document.querySelectorAll<HTMLElement>("[data-scene-link]"),
  ];
  let current = "";
  return {
    setScene(id: string) {
      if (id === current) return;
      current = id;
      const activeNavigationId = navigationSceneId(id);
      for (const pill of navPills) {
        pill.classList.toggle(
          "is-active",
          pill.dataset.sceneLink === activeNavigationId,
        );
      }
    },
  };
}

/** 通常セクションの在圏検知 (スクラブシーン外のインジケータ更新用) */
export function observeStaticSections(
  indicator: IndicatorController,
  includeStaticScrubScenes = false,
): void {
  const selector = includeStaticScrubScenes
    ? ".section[id], [data-static-scene]"
    : ".section[id]";
  const sections = document.querySelectorAll<HTMLElement>(selector);
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = entry.target as HTMLElement;
        indicator.setScene(target.dataset.staticScene ?? target.id);
      }
    },
    { threshold: 0.4 },
  );
  sections.forEach((el) => observer.observe(el));
}

/**
 * 画面から完全に外れたスクラブセクションへ data-scene-dormant を付ける。
 * CSS側でそのセクション内のアニメーションを止め、合成レイヤーを解放する。
 * 重さの主因はGPU/合成だったため、見えていないセクションの描画を止めるのが
 * 最も効く。rootMarginで画面の手前に来た時点で起こし、再開時のちらつきを防ぐ。
 */
export function observeSceneDormancy(): () => void {
  const sections = [
    ...document.querySelectorAll<HTMLElement>(
      ".js-intro, .js-studio, .js-works-flight",
    ),
  ];
  if (sections.length === 0) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        // 交差していない = 画面外。休眠させる。
        target.toggleAttribute("data-scene-dormant", !entry.isIntersecting);
      }
    },
    // 画面の上下に半画面ぶんの余白を取り、見える前に起こしておく
    { rootMargin: "50% 0px 50% 0px" },
  );
  sections.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

export interface DebugHud {
  update(scene: string, progress: number): void;
}

/** ?debug=1 で表示される開発モードHUD */
export function initDebugHud(): DebugHud | null {
  const enabled =
    new URLSearchParams(window.location.search).get("debug") === "1";
  const hud = document.querySelector<HTMLElement>(".js-hud");
  if (!enabled || !hud) return null;
  hud.hidden = false;
  const sceneEl = hud.querySelector(".js-hud-scene");
  const progressEl = hud.querySelector(".js-hud-progress");
  const scrollEl = hud.querySelector(".js-hud-scroll");
  return {
    update(scene: string, progress: number) {
      if (sceneEl) sceneEl.textContent = scene;
      if (progressEl) progressEl.textContent = progress.toFixed(3);
      if (scrollEl) scrollEl.textContent = String(Math.round(window.scrollY));
    },
  };
}
