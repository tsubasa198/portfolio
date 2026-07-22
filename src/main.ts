import "./styles/main.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { prepareArrivalImages } from "./scenes/arrivalAssetLoader";
import { initIntroScene } from "./scenes/intro";
import {
  TRANSITION_CONFIG,
  arrivalLayerOpacityAt,
  mascotVideoHandoffTransform,
  type MascotVideoHandoffTransform,
} from "./scenes/portalTransitionConfig";
import { preparePortalVideo } from "./scenes/portalVideoLoader";
import { initStudioScene } from "./scenes/studio";
import { initWorksFlightScene } from "./scenes/worksFlight";
import { WORKS_FLIGHT_CONFIG } from "./scenes/worksFlightConfig";
import {
  initDebugHud,
  initIndicator,
  initLoading,
  initMobileMenu,
  initProgressBar,
  initReveals,
  initSceneNavigation,
  initSplitTitles,
  observeSceneDormancy,
  observeStaticSections,
} from "./ui/chrome";
import { createVeil, type Veil } from "./ui/veil";

gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollController {
  readonly lenis: Lenis;
  readonly destroy: () => void;
}

interface StageDirector {
  readonly destroy: () => void;
}

function initSmoothScroll(
  reducedMotion: boolean,
): SmoothScrollController | null {
  // OS設定でモーション低減が有効なら慣性スクロールを切る
  if (reducedMotion) return null;
  const lenis = new Lenis({ smoothWheel: true });
  const handleScroll = () => ScrollTrigger.update();
  const renderTick = (time: number) => lenis.raf(time * 1000);
  lenis.on("scroll", handleScroll);
  gsap.ticker.add(renderTick);
  gsap.ticker.lagSmoothing(0);

  return {
    lenis,
    destroy() {
      gsap.ticker.remove(renderTick);
      lenis.off("scroll", handleScroll);
      lenis.destroy();
    },
  };
}

/** fixedステージ同士の重なりだけを管理し、Intro内部の映像には触れない。 */
function initStageDirector(
  veil: Veil,
  introVisualProgress: () => number,
  worksFlightProgress: () => number,
): StageDirector {
  const sections = {
    intro: document.querySelector<HTMLElement>(".js-intro"),
    studio: document.querySelector<HTMLElement>(".js-studio"),
    worksFlight: document.querySelector<HTMLElement>(".js-works-flight"),
  };
  const stages = {
    intro: document.querySelector<HTMLElement>(".js-intro-stage"),
    studio: document.querySelector<HTMLElement>(".js-studio-stage"),
  };
  const arrivalLayers = [
    ...document.querySelectorAll<HTMLElement>("[data-arrival-layer]"),
  ];
  const arrivalMascot = document.querySelector<HTMLImageElement>(
    '[data-arrival-layer="mascot"]',
  );
  const arrivalMascotPosition = document.querySelector<HTMLElement>(
    ".js-studio-mascot-position",
  );
  const studioBackground = document.querySelector<HTMLElement>(".studio-bg");
  const studioMockup = document.querySelector<HTMLElement>(
    ".js-studio-mockup-entry",
  );
  const studioCopy = document.querySelector<HTMLElement>(
    ".js-studio-copy-entry",
  );
  if (
    Object.values(sections).some((element) => !element) ||
    Object.values(stages).some((element) => !element) ||
    arrivalLayers.length !== 1 ||
    !arrivalMascot ||
    !arrivalMascotPosition ||
    !studioBackground ||
    !studioMockup ||
    !studioCopy
  ) {
    throw new Error("StageDirector: 必要なセクションが見つかりません");
  }

  interface Bounds {
    readonly top: number;
    readonly pinEnd: number;
    readonly bottom: number;
  }
  let bounds!: Record<keyof typeof sections, Bounds>;
  let mascotHandoff: MascotVideoHandoffTransform = {
    xPx: 0,
    yPx: 0,
    scale: 1,
  };
  const computeBounds = () => {
    const viewportHeight = window.innerHeight;
    const measure = (element: HTMLElement): Bounds => ({
      top: element.offsetTop,
      pinEnd: element.offsetTop + element.offsetHeight - viewportHeight,
      bottom: element.offsetTop + element.offsetHeight,
    });
    bounds = {
      intro: measure(sections.intro!),
      studio: measure(sections.studio!),
      worksFlight: measure(sections.worksFlight!),
    };

    if (arrivalMascotPosition.offsetWidth > 0) {
      mascotHandoff = mascotVideoHandoffTransform({
        viewportWidth: window.innerWidth,
        viewportHeight,
        objectPositionX:
          window.innerWidth <= TRANSITION_CONFIG.mobileBreakpoint
            ? TRANSITION_CONFIG.additionalVideoMobileObjectPositionX
            : 0.5,
        finalRect: {
          left: arrivalMascotPosition.offsetLeft,
          top: arrivalMascotPosition.offsetTop,
          width: arrivalMascotPosition.offsetWidth,
        },
      });
    }
  };
  computeBounds();
  window.addEventListener("resize", computeBounds, { passive: true });
  ScrollTrigger.addEventListener("refresh", computeBounds);

  const ramp = (value: number, from: number, to: number): number => {
    if (to <= from) return value >= to ? 1 : 0;
    return Math.min(1, Math.max(0, (value - from) / (to - from)));
  };

  const applyOpacity = (element: HTMLElement, opacity: number) => {
    element.style.opacity = String(opacity);
    element.style.visibility = opacity <= 0.001 ? "hidden" : "visible";
  };

  const applyMascotHandoff = (progress: number) => {
    // smoothstepで動画と静止レイヤー双方の速度差を境界上でゼロに近づける。
    const eased = progress * progress * (3 - 2 * progress);
    const remaining = 1 - eased;
    const x = mascotHandoff.xPx * remaining;
    const y = mascotHandoff.yPx * remaining;
    const scale = 1 + (mascotHandoff.scale - 1) * remaining;
    arrivalMascotPosition.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  };

  const renderTick = () => {
    const scrollY = window.scrollY;
    const introProgress = introVisualProgress();
    const worksProgress = worksFlightProgress();
    const beforeStudio = scrollY < bounds.studio.top;
    const handoffMorph = ramp(
      introProgress,
      TRANSITION_CONFIG.additionalVideoEnd,
      TRANSITION_CONFIG.stillHandoffEnd,
    );

    // 最終フレームの同位置へ単体PNGを重ね、動画が消えた後も同じ軌道で残す。
    const mascotOpacity = beforeStudio
      ? arrivalLayerOpacityAt("mascot", introProgress)
      : 1 -
        ramp(
          worksProgress,
          WORKS_FLIGHT_CONFIG.mascotSwapStart,
          WORKS_FLIGHT_CONFIG.mascotSwapEnd,
        );
    applyOpacity(arrivalMascotPosition, mascotOpacity);
    applyMascotHandoff(beforeStudio ? handoffMorph : 1);
    if (beforeStudio && introProgress < TRANSITION_CONFIG.additionalVideoEnd) {
      const matchProgress = arrivalLayerOpacityAt("mascot", introProgress);
      arrivalMascot!.style.filter = `blur(${1.2 * (1 - matchProgress)}px) drop-shadow(-10px 0 26px rgba(255, 145, 50, 0.2))`;
    } else {
      arrivalMascot!.style.removeProperty("filter");
    }

    // 動画内のポータル／UI／台座は動画と一緒に消し、ネイビー背景へ戻す。
    const backgroundEntrance = ramp(
      introProgress,
      TRANSITION_CONFIG.additionalVideoEnd,
      TRANSITION_CONFIG.stillHandoffEnd,
    );
    const mockupEntrance = ramp(
      introProgress,
      TRANSITION_CONFIG.studioPreludeStart,
      0.95,
    );
    const copyEntrance = ramp(introProgress, 0.93, 0.98);
    const launchCharge = ramp(
      worksProgress,
      WORKS_FLIGHT_CONFIG.systemHoldEnd,
      WORKS_FLIGHT_CONFIG.prepareEnd,
    );
    studioBackground!.style.opacity = String(
      beforeStudio ? backgroundEntrance : 1,
    );
    studioCopy!.style.opacity = String(beforeStudio ? copyEntrance : 1);
    studioCopy!.style.transform = beforeStudio
      ? `translateX(${-40 * (1 - copyEntrance)}px)`
      : `translateX(0) scale(${1 - launchCharge * 0.04})`;
    studioCopy!.style.filter = `blur(${
      beforeStudio ? 8 * (1 - copyEntrance) : launchCharge * 8
    }px)`;
    studioMockup!.style.opacity = String(beforeStudio ? mockupEntrance : 1);
    studioMockup!.style.transform = beforeStudio
      ? `translateY(${70 * (1 - mockupEntrance)}px) scale(${0.88 + 0.12 * mockupEntrance})`
      : `translateY(0) scale(${1 - launchCharge * 0.04})`;
    studioMockup!.style.filter = beforeStudio
      ? `blur(${16 * (1 - mockupEntrance)}px) drop-shadow(8px 0 24px rgba(255, 137, 47, 0.16))`
      : `blur(${launchCharge * 8}px) brightness(${1 + launchCharge * 0.12}) drop-shadow(0 0 ${24 + launchCharge * 42}px rgba(255, 137, 47, ${0.16 + launchCharge * 0.48}))`;

    const introOpacity = beforeStudio
      ? 1 -
        ramp(
          introProgress,
          TRANSITION_CONFIG.additionalVideoEnd,
          TRANSITION_CONFIG.stillVideoFadeEnd,
        )
      : 0;
    // 閾値時点では子要素が透明なので、ステージを先に有効化しても視覚的な段差はない。
    const studioEntrance =
      introProgress >= TRANSITION_CONFIG.mascotVideoMatchStart ? 1 : 0;
    const studioOpacity =
      (beforeStudio ? studioEntrance : 1) *
      (1 -
        ramp(
          worksProgress,
          WORKS_FLIGHT_CONFIG.systemHoldEnd,
          WORKS_FLIGHT_CONFIG.prepareEnd,
        ));

    applyOpacity(stages.intro!, introOpacity);
    applyOpacity(stages.studio!, studioOpacity);

    // 今回の接続はステージ内部のアンバーグローで行い、ナビを覆うベールは使わない。
    veil.set(0);
  };
  gsap.ticker.add(renderTick);
  renderTick();

  return {
    destroy() {
      gsap.ticker.remove(renderTick);
      window.removeEventListener("resize", computeBounds);
      ScrollTrigger.removeEventListener("refresh", computeBounds);
    },
  };
}

async function main(): Promise<void> {
  const cleanups: Array<() => void> = [];
  let cleanupRegistered = false;

  const cleanup = () => {
    if (cleanupRegistered) return;
    cleanupRegistered = true;
    for (const dispose of cleanups.reverse()) dispose();
  };

  const mediaAbortController = new AbortController();
  cleanups.push(() => mediaAbortController.abort());
  const handlePageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) cleanup();
  };
  const handlePageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    ScrollTrigger.refresh();
    ScrollTrigger.update();
  };
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
  cleanups.push(() => {
    window.removeEventListener("pagehide", handlePageHide);
    window.removeEventListener("pageshow", handlePageShow);
  });
  import.meta.hot?.dispose(cleanup);

  try {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    document.body.classList.toggle("reduced-motion", reducedMotion);

    // スクロール距離を進行設定と同じ場所から調整できるようCSSへ渡す。
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty(
      "--intro-desktop-length",
      `${TRANSITION_CONFIG.desktopLengthVh}vh`,
    );
    rootStyle.setProperty(
      "--intro-mobile-length",
      `${TRANSITION_CONFIG.mobileLengthVh}svh`,
    );
    rootStyle.setProperty(
      "--works-flight-desktop-length",
      `${WORKS_FLIGHT_CONFIG.desktopLengthVh}vh`,
    );
    rootStyle.setProperty(
      "--works-flight-mobile-length",
      `${WORKS_FLIGHT_CONFIG.mobileLengthSvh}svh`,
    );

    initLoading();
    initSplitTitles();
    const portalVideos = [
      ...document.querySelectorAll<HTMLVideoElement>(".js-scrub-video"),
    ];
    const portalSources = portalVideos.map((video) =>
      video.querySelector<HTMLSourceElement>("source[data-src]"),
    );
    const arrivalImages = [
      ...document.querySelectorAll<HTMLImageElement>("[data-arrival-layer]"),
    ];
    const worksFlightVideo = document.querySelector<HTMLVideoElement>(
      ".js-works-flight-mascot-video",
    );
    const worksFlightSource =
      worksFlightVideo?.querySelector<HTMLSourceElement>("source[data-src]");
    const worksFlightImages = [
      ...document.querySelectorAll<HTMLImageElement>(
        ".js-works-flight-landing-mascot",
      ),
    ];
    if (
      portalVideos.length !== 2 ||
      portalSources.some((source) => !source?.dataset.src) ||
      arrivalImages.length !== 1 ||
      worksFlightImages.length !== 1 ||
      !worksFlightVideo ||
      !worksFlightSource?.dataset.src
    ) {
      throw new Error("統合ポータル素材のDOM契約を満たしていません");
    }

    const smoothScroll = initSmoothScroll(reducedMotion);
    if (smoothScroll) cleanups.push(smoothScroll.destroy);

    const indicator = initIndicator();
    const hud = initDebugHud();
    initMobileMenu();
    initSceneNavigation((top) => {
      if (smoothScroll) {
        smoothScroll.lenis.scrollTo(top, { duration: 0.9 });
        return;
      }
      window.scrollTo({ top, behavior: "auto" });
    }, reducedMotion);

    // モーション低減時は透過動画を読み込まず、静止マスコットと実績DOMを表示する。
    if (reducedMotion) {
      for (const video of portalVideos) {
        video.preload = "none";
        video.pause();
        video.load();
      }
      worksFlightVideo.preload = "none";
      worksFlightVideo.pause();
      document.body.dataset.portalAssets = "ready";
      document.body.dataset.portalMedia = "poster-and-layers";
      indicator.setScene("hero");
      initProgressBar();
      initReveals();
      observeStaticSections(indicator, true);
      return;
    }

    portalSources.forEach((source) => {
      source!.src = source!.dataset.src!;
    });
    worksFlightSource.src = worksFlightSource.dataset.src;
    await Promise.all([
      ...portalVideos.map((video) =>
        preparePortalVideo(video, {
          timeoutMs: TRANSITION_CONFIG.videoReadyTimeoutMs,
          signal: mediaAbortController.signal,
        }),
      ),
      prepareArrivalImages(arrivalImages, {
        timeoutMs: TRANSITION_CONFIG.videoReadyTimeoutMs,
        signal: mediaAbortController.signal,
      }),
      prepareArrivalImages(worksFlightImages, {
        timeoutMs: WORKS_FLIGHT_CONFIG.videoReadyTimeoutMs,
        signal: mediaAbortController.signal,
      }),
      preparePortalVideo(worksFlightVideo, {
        timeoutMs: WORKS_FLIGHT_CONFIG.videoReadyTimeoutMs,
        signal: mediaAbortController.signal,
      }),
    ]);
    document.body.dataset.portalAssets = "ready";
    document.body.dataset.portalMedia = "ready";

    const veil = createVeil();
    cleanups.push(veil.destroy);

    // 各シーンは初期化中に一度onUpdateを同期発火するため、参照は遅延バインドにする。
    let intro: ReturnType<typeof initIntroScene> | undefined;
    let studio: ReturnType<typeof initStudioScene> | undefined;
    let worksFlight: ReturnType<typeof initWorksFlightScene> | undefined;
    intro = initIntroScene(() => {
      if (!intro) return;
      if (studio && studio.progress() > 0) return;
      indicator.setScene(intro.activeSceneId());
      hud?.update(intro.activeSceneId(), intro.progress());
    });
    cleanups.push(intro.destroy);
    studio = initStudioScene(() => {
      if (!studio || !intro) return;
      const beforeHearing =
        studio.progress() <= 0 &&
        intro.visualProgress() < TRANSITION_CONFIG.studioPreludeStart;
      if (beforeHearing) return;
      indicator.setScene(studio.activeSceneId());
      hud?.update(studio.activeSceneId(), studio.progress());
    });
    cleanups.push(studio.destroy);
    worksFlight = initWorksFlightScene((progress) => {
      if (!worksFlight || !studio) return;
      studio.setMascotVisible(progress < WORKS_FLIGHT_CONFIG.mascotSwapEnd);
      const sceneId =
        progress < WORKS_FLIGHT_CONFIG.prepareEnd ? "build" : "works";
      indicator.setScene(sceneId);
      hud?.update("works", progress);
    });
    cleanups.push(worksFlight.destroy);
    studio.setMascotVisible(
      worksFlight.progress() < WORKS_FLIGHT_CONFIG.mascotSwapEnd,
    );
    if (worksFlight.progress() > 0) {
      indicator.setScene(
        worksFlight.progress() < WORKS_FLIGHT_CONFIG.prepareEnd
          ? "build"
          : "works",
      );
    } else if (studio.progress() > 0) {
      indicator.setScene(studio.activeSceneId());
    } else {
      indicator.setScene(intro.activeSceneId());
    }

    const stageDirector = initStageDirector(
      veil,
      intro.visualProgress,
      worksFlight.progress,
    );
    cleanups.push(stageDirector.destroy);
    initProgressBar();
    initReveals();
    observeStaticSections(indicator);
    cleanups.push(observeSceneDormancy());
  } catch (error) {
    cleanup();
    // 演出の初期化に失敗してもposterと既存コンテンツは読める状態を保つ。
    console.error("初期化エラー: スクロール演出を無効化して続行します", error);
    document.body.classList.add("no-motion");
    for (const element of document.querySelectorAll(
      ".scene-copy, .js-reveal",
    )) {
      element.classList.add("is-visible");
    }
  }
}

void main();
