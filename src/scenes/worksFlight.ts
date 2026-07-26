import { ScrollTrigger } from "gsap/ScrollTrigger";
import { clamp01, segmentProgress } from "../core/sceneProgress";
import { measureCardGeometry, type CardGeometry } from "./cardGeometryMeasurer";
import { PortalVideoScrubber } from "./portalVideoScrub";
import {
  FINAL_CARD_FLIGHTS,
  FLIGHT_PASS_CARDS,
  GUIDE_MASCOT_ALPHA_BOUNDS,
  LANDING_END_SUBJECT_BOUNDS,
  LANDING_START_SUBJECT_BOUNDS,
  TAKEOFF_FRONT_SUBJECT_BOUNDS,
  TAKEOFF_START_SUBJECT_BOUNDS,
  WORKS_FLIGHT_CONFIG,
  finalCardStateAt,
  finalCardViewportOffsetAt,
  passCardStateAt,
  passCardViewportPointAt,
  quadraticBezierPoint,
  worksPageStateAt,
  worksFlightPhaseAt,
  worksFlightVideoTimeAt,
  type NormalizedSubjectBounds,
  type Point,
} from "./worksFlightConfig";

const FINAL_CARD_COUNT = 4;
const PASS_CARD_COUNT = 4;
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const TAKEOFF_ROTATION_DEG = -4.5;

interface SubjectGeometry extends Point {
  readonly width: number;
  readonly height: number;
}

interface ElementBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface SceneGeometry {
  readonly width: number;
  readonly height: number;
  readonly takeoffTarget: SubjectGeometry;
  readonly landingTarget: SubjectGeometry;
}

export interface WorksFlightScene {
  readonly progress: () => number;
  readonly destroy: () => void;
}

function ramp(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * clamp01(progress);
}

function smoothstep(value: number): number {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

function interpolateBounds(
  start: NormalizedSubjectBounds,
  end: NormalizedSubjectBounds,
  progress: number,
): NormalizedSubjectBounds {
  return {
    left: lerp(start.left, end.left, progress),
    top: lerp(start.top, end.top, progress),
    width: lerp(start.width, end.width, progress),
    height: lerp(start.height, end.height, progress),
  };
}

/** 透過動画は全フレームを保持するため、contain基準なら縦画面でも被写体が欠けない。 */
function subjectInContain(
  viewportWidth: number,
  viewportHeight: number,
  bounds: NormalizedSubjectBounds,
): SubjectGeometry {
  const containScale = Math.min(
    viewportWidth / VIDEO_WIDTH,
    viewportHeight / VIDEO_HEIGHT,
  );
  const renderedWidth = VIDEO_WIDTH * containScale;
  const renderedHeight = VIDEO_HEIGHT * containScale;
  const offsetX = (viewportWidth - renderedWidth) / 2;
  const offsetY = (viewportHeight - renderedHeight) / 2;
  const left = offsetX + bounds.left * renderedWidth;
  const top = offsetY + bounds.top * renderedHeight;
  const width = bounds.width * renderedWidth;
  const height = bounds.height * renderedHeight;
  return {
    x: left + width / 2,
    y: top + height / 2,
    width,
    height,
  };
}

function subjectInLocalBox(
  elementBox: ElementBox,
  bounds: NormalizedSubjectBounds,
): SubjectGeometry {
  const left = elementBox.left + elementBox.width * bounds.left;
  const top = elementBox.top + elementBox.height * bounds.top;
  const width = elementBox.width * bounds.width;
  const height = elementBox.height * bounds.height;
  return {
    x: left + width / 2,
    y: top + height / 2,
    width,
    height,
  };
}

/** fixed/sticky間でもページスクロール量に影響されないstage内座標を得る。 */
function elementBoxWithin(
  element: HTMLElement,
  ancestor: HTMLElement,
): ElementBox {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;

  while (current && current !== ancestor) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  if (current !== ancestor) {
    throw new Error("WorksFlightScene: stage内座標へ変換できません");
  }
  return {
    left,
    top,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
}

export function initWorksFlightScene(
  onUpdate?: (progress: number) => void,
): WorksFlightScene {
  const section = document.querySelector<HTMLElement>(".js-works-flight");
  const stage = document.querySelector<HTMLElement>(".js-works-flight-stage");
  const backdrop = document.querySelector<HTMLElement>(
    ".js-works-flight-backdrop",
  );
  const effects = document.querySelector<HTMLElement>(
    ".js-works-flight-effects",
  );
  const mascotLayer = document.querySelector<HTMLElement>(
    ".js-works-flight-mascot-layer",
  );
  const mascotVideo = document.querySelector<HTMLVideoElement>(
    ".js-works-flight-mascot-video",
  );
  const landingMascot = document.querySelector<HTMLImageElement>(
    ".js-works-flight-landing-mascot",
  );
  const studioStage = document.querySelector<HTMLElement>(".js-studio-stage");
  const studioMascot = document.querySelector<HTMLElement>(
    ".js-studio-mascot-position",
  );
  const copy = document.querySelector<HTMLElement>(".js-works-flight-copy");
  const secondaryCopy = document.querySelector<HTMLElement>(
    ".js-works-flight-copy-secondary",
  );
  const finalLayer = document.querySelector<HTMLElement>(
    ".js-works-flight-final-layer",
  );
  const finalCards = [
    ...document.querySelectorAll<HTMLElement>(".js-works-flight-card"),
  ];
  const passCards = [
    ...document.querySelectorAll<HTMLElement>(".js-works-flight-pass-card"),
  ];

  if (
    !section ||
    !stage ||
    !backdrop ||
    !effects ||
    !mascotLayer ||
    !mascotVideo ||
    !landingMascot ||
    !studioStage ||
    !studioMascot ||
    !copy ||
    !secondaryCopy ||
    !finalLayer ||
    finalCards.length !== FINAL_CARD_COUNT ||
    passCards.length !== PASS_CARD_COUNT ||
    FINAL_CARD_FLIGHTS.length !== FINAL_CARD_COUNT ||
    FLIGHT_PASS_CARDS.length !== PASS_CARD_COUNT
  ) {
    throw new Error("WorksFlightScene: 必要なDOM要素が見つかりません");
  }
  if (!Number.isFinite(mascotVideo.duration) || mascotVideo.duration <= 0) {
    throw new Error(
      `WorksFlightScene: 透過動画時間が不正です (${mascotVideo.duration})`,
    );
  }

  let progress = 0;
  let mediaFailed = false;
  let finalCardGeometry: readonly CardGeometry[] = [];
  let finalCardRowShift = 0;
  let sceneGeometry!: SceneGeometry;

  const measure = () => {
    const stageRect = stage.getBoundingClientRect();
    finalCardGeometry = measureCardGeometry(finalCards, stage);
    finalCardRowShift = Math.max(
      0,
      (finalCardGeometry[2]?.centerY ?? 0) -
        (finalCardGeometry[0]?.centerY ?? 0),
    );

    const studioMascotBox = elementBoxWithin(studioMascot, studioStage);
    const landingMascotBox = elementBoxWithin(landingMascot, stage);
    sceneGeometry = {
      width: stageRect.width,
      height: stageRect.height,
      takeoffTarget: subjectInLocalBox(
        studioMascotBox,
        GUIDE_MASCOT_ALPHA_BOUNDS,
      ),
      landingTarget: subjectInLocalBox(
        landingMascotBox,
        GUIDE_MASCOT_ALPHA_BOUNDS,
      ),
    };
  };

  try {
    mascotVideo.currentTime = worksFlightVideoTimeAt(0, mascotVideo.duration);
  } catch {
    mediaFailed = true;
    section.dataset.worksFlightMedia = "static-fallback";
  }

  const scrubber = new PortalVideoScrubber(mascotVideo, {
    smoothing: WORKS_FLIGHT_CONFIG.smoothing,
    catchUpSmoothing: WORKS_FLIGHT_CONFIG.catchUpSmoothing,
    catchUpThresholdSeconds: WORKS_FLIGHT_CONFIG.catchUpThresholdSeconds,
    endHoldSeconds: 0,
    progressToTime: worksFlightVideoTimeAt,
    onError: () => {
      mediaFailed = true;
      section.dataset.worksFlightMedia = "static-fallback";
      mascotLayer.style.opacity = "0";
    },
  });

  const renderPassCards = (value: number) => {
    const viewport = {
      width: sceneGeometry.width,
      height: sceneGeometry.height,
    };
    passCards.forEach((card, index) => {
      const state = passCardStateAt(value, index);
      const point = passCardViewportPointAt(value, index, viewport);
      const offsetX = point.x - viewport.width / 2;
      const offsetY = point.y - viewport.height / 2;
      card.style.opacity = state.opacity.toFixed(4);
      card.style.visibility = state.opacity <= 0.001 ? "hidden" : "visible";
      card.style.filter = `blur(${state.blurPx.toFixed(2)}px)`;
      card.style.transform =
        "translate(-50%, -50%) " +
        `translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0) ` +
        `scale(${state.scale.toFixed(4)}) ` +
        `rotateX(${state.rotateXDeg.toFixed(2)}deg) ` +
        `rotateY(${state.rotateYDeg.toFixed(2)}deg) ` +
        `rotateZ(${state.rotateZDeg.toFixed(2)}deg)`;
    });
  };

  const renderFinalCards = (value: number) => {
    if (finalCardGeometry.length !== finalCards.length) measure();
    const viewport = {
      width: sceneGeometry.width,
      height: sceneGeometry.height,
    };
    const pageState = worksPageStateAt(value);
    finalCards.forEach((card, index) => {
      const state = finalCardStateAt(value, index);
      const geometry = finalCardGeometry[index];
      const offset = finalCardViewportOffsetAt(
        { x: geometry.centerX, y: geometry.centerY },
        viewport,
        state,
        FINAL_CARD_FLIGHTS[index],
      );
      const isWorksOne = index < 2;
      const pageOpacity = isWorksOne
        ? pageState.worksOneOpacity
        : Math.max(pageState.flightOverviewOpacity, pageState.worksTwoOpacity);
      const opacity = state.opacity * pageOpacity;
      const pageOffsetY = isWorksOne
        ? -20 * (1 - pageState.worksOneOpacity)
        : -finalCardRowShift * pageState.worksTwoLift;
      const pageBlur = isWorksOne
        ? 8 * (1 - pageState.worksOneOpacity)
        : 10 *
          (1 - pageState.worksTwoOpacity) *
          (1 - pageState.flightOverviewOpacity);
      card.style.opacity = opacity.toFixed(4);
      card.style.visibility = opacity <= 0.001 ? "hidden" : "visible";
      card.style.filter = `blur(${Math.max(state.blurPx, pageBlur).toFixed(2)}px)`;
      card.style.transform =
        `translate3d(${offset.x.toFixed(2)}px, ${(offset.y + pageOffsetY).toFixed(2)}px, 0) ` +
        `scale(${state.scale.toFixed(4)}) ` +
        `rotateX(${state.rotateXDeg.toFixed(2)}deg) ` +
        `rotateY(${state.rotateYDeg.toFixed(2)}deg) ` +
        `rotateZ(${state.rotateZDeg.toFixed(2)}deg)`;
    });
    if (sceneGeometry.width < 600) {
      const secondPageStart = Math.max(0, finalCards[2].offsetLeft - 16);
      finalLayer.scrollLeft = secondPageStart * pageState.worksTwoLift;
    }
    finalLayer.style.pointerEvents =
      value >= WORKS_FLIGHT_CONFIG.landingMotionEnd ? "auto" : "none";
  };

  const renderMascot = (value: number) => {
    const centralScale =
      sceneGeometry.width <= WORKS_FLIGHT_CONFIG.mobileBreakpoint
        ? WORKS_FLIGHT_CONFIG.mobileCentralMascotScale
        : 1;
    const takeoffProgress = smoothstep(
      segmentProgress(
        value,
        WORKS_FLIGHT_CONFIG.takeoffMotionStart,
        WORKS_FLIGHT_CONFIG.takeoffMotionEnd,
      ),
    );
    const landingProgress = smoothstep(
      segmentProgress(
        value,
        WORKS_FLIGHT_CONFIG.landingMotionStart,
        WORKS_FLIGHT_CONFIG.landingMotionEnd,
      ),
    );
    const takeoffStartSource = subjectInContain(
      sceneGeometry.width,
      sceneGeometry.height,
      TAKEOFF_START_SUBJECT_BOUNDS,
    );
    const takeoffFrontSource = subjectInContain(
      sceneGeometry.width,
      sceneGeometry.height,
      TAKEOFF_FRONT_SUBJECT_BOUNDS,
    );
    const landingStartSource = subjectInContain(
      sceneGeometry.width,
      sceneGeometry.height,
      LANDING_START_SUBJECT_BOUNDS,
    );
    const landingEndSource = subjectInContain(
      sceneGeometry.width,
      sceneGeometry.height,
      LANDING_END_SUBJECT_BOUNDS,
    );

    let source = takeoffStartSource;
    let target = sceneGeometry.takeoffTarget;
    let scale = sceneGeometry.takeoffTarget.width / takeoffStartSource.width;
    let rotationZ = 0;

    if (value >= WORKS_FLIGHT_CONFIG.takeoffMotionStart) {
      const takeoffBounds = interpolateBounds(
        TAKEOFF_START_SUBJECT_BOUNDS,
        TAKEOFF_FRONT_SUBJECT_BOUNDS,
        takeoffProgress,
      );
      source = subjectInContain(
        sceneGeometry.width,
        sceneGeometry.height,
        takeoffBounds,
      );
      const control = {
        x: sceneGeometry.width * 0.76,
        y: sceneGeometry.height * 0.58,
      };
      const pathPoint = quadraticBezierPoint(
        sceneGeometry.takeoffTarget,
        control,
        takeoffFrontSource,
        takeoffProgress,
      );
      target = { ...sceneGeometry.takeoffTarget, ...pathPoint };
      const startScale =
        sceneGeometry.takeoffTarget.width / takeoffStartSource.width;
      scale = lerp(startScale, centralScale, takeoffProgress);
      rotationZ = TAKEOFF_ROTATION_DEG * Math.sin(Math.PI * takeoffProgress);
    }

    if (value >= WORKS_FLIGHT_CONFIG.takeoffMotionEnd) {
      source = takeoffFrontSource;
      target = takeoffFrontSource;
      scale = centralScale;
      rotationZ = 0;
    }

    if (value >= WORKS_FLIGHT_CONFIG.landingMotionStart) {
      const landingBounds = interpolateBounds(
        LANDING_START_SUBJECT_BOUNDS,
        LANDING_END_SUBJECT_BOUNDS,
        landingProgress,
      );
      source = subjectInContain(
        sceneGeometry.width,
        sceneGeometry.height,
        landingBounds,
      );
      const control = {
        x: sceneGeometry.width * 0.78,
        y: sceneGeometry.height * 0.64,
      };
      const pathPoint = quadraticBezierPoint(
        landingStartSource,
        control,
        sceneGeometry.landingTarget,
        landingProgress,
      );
      target = { ...sceneGeometry.landingTarget, ...pathPoint };
      const endScale =
        sceneGeometry.landingTarget.width / landingEndSource.width;
      scale = lerp(centralScale, endScale, landingProgress);
    }

    mascotLayer.style.transformOrigin = `${source.x.toFixed(2)}px ${source.y.toFixed(2)}px`;
    mascotLayer.style.transform =
      `translate3d(${(target.x - source.x).toFixed(2)}px, ` +
      `${(target.y - source.y).toFixed(2)}px, 0) ` +
      `scale(${scale.toFixed(5)}) rotateZ(${rotationZ.toFixed(2)}deg)`;

    const videoEntrance = smoothstep(
      ramp(
        value,
        WORKS_FLIGHT_CONFIG.mascotSwapStart,
        WORKS_FLIGHT_CONFIG.mascotSwapEnd,
      ),
    );
    const staticHandoff = smoothstep(
      ramp(
        value,
        WORKS_FLIGHT_CONFIG.mascotHandoffStart,
        WORKS_FLIGHT_CONFIG.landingMotionEnd,
      ),
    );
    mascotLayer.style.opacity = mediaFailed
      ? "0"
      : String(videoEntrance * (1 - staticHandoff));
    landingMascot.style.opacity = String(
      mediaFailed
        ? ramp(value, WORKS_FLIGHT_CONFIG.systemHoldEnd, 0.2)
        : staticHandoff,
    );
    landingMascot.style.transform = `translateY(${(
      3 *
      (1 - staticHandoff)
    ).toFixed(2)}px) scale(${(0.985 + staticHandoff * 0.015).toFixed(4)})`;

    const effectPoint = target;
    effects.style.setProperty(
      "--ray-origin-x",
      `${effectPoint.x.toFixed(2)}px`,
    );
    effects.style.setProperty(
      "--ray-origin-y",
      `${effectPoint.y.toFixed(2)}px`,
    );
  };

  const update = (value: number) => {
    progress = clamp01(value);
    section.dataset.worksFlightProgress = progress.toFixed(4);
    section.dataset.worksFlightPhase = worksFlightPhaseAt(progress);

    const backdropEntrance = smoothstep(
      ramp(
        progress,
        WORKS_FLIGHT_CONFIG.effectsStart,
        WORKS_FLIGHT_CONFIG.takeoffMotionEnd,
      ),
    );
    backdrop.style.opacity = String(backdropEntrance);

    const effectEntrance = smoothstep(
      ramp(
        progress,
        WORKS_FLIGHT_CONFIG.effectsStart,
        WORKS_FLIGHT_CONFIG.effectsPeak,
      ),
    );
    const effectExit = smoothstep(
      ramp(
        progress,
        WORKS_FLIGHT_CONFIG.effectsFadeStart,
        WORKS_FLIGHT_CONFIG.effectsEnd,
      ),
    );
    const effectIntensity = effectEntrance * (1 - effectExit);
    effects.style.opacity = String(effectIntensity);
    effects.style.setProperty("--flight-intensity", effectIntensity.toFixed(4));
    effects.style.setProperty("--ray-intensity", effectIntensity.toFixed(4));
    effects.style.setProperty(
      "--ray-scale",
      (0.6 + effectIntensity * 0.55).toFixed(4),
    );

    renderMascot(progress);
    renderPassCards(progress);
    renderFinalCards(progress);

    const copyEntrance = smoothstep(
      segmentProgress(
        progress,
        WORKS_FLIGHT_CONFIG.headingStart,
        WORKS_FLIGHT_CONFIG.worksOneStart + 0.025,
      ),
    );
    const pageState = worksPageStateAt(progress);
    const primaryCopyOpacity = copyEntrance * pageState.worksOneOpacity;
    copy.style.opacity = String(primaryCopyOpacity);
    copy.style.transform = `translateY(${(
      30 * (1 - primaryCopyOpacity) -
      16 * (1 - pageState.worksOneOpacity)
    ).toFixed(2)}px)`;
    copy.style.filter = `blur(${(10 * (1 - primaryCopyOpacity)).toFixed(2)}px)`;
    secondaryCopy.style.opacity = String(pageState.worksTwoOpacity);
    secondaryCopy.style.transform = `translateY(${(
      30 *
      (1 - pageState.worksTwoOpacity)
    ).toFixed(2)}px)`;
    secondaryCopy.style.filter = `blur(${(
      10 *
      (1 - pageState.worksTwoOpacity)
    ).toFixed(2)}px)`;

    scrubber.setProgress(progress);
    onUpdate?.(progress);
  };

  measure();
  const trigger = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    invalidateOnRefresh: true,
    onEnter: () => scrubber.setActive(true),
    onEnterBack: () => scrubber.setActive(true),
    onLeave: () => scrubber.setActive(false),
    onLeaveBack: () => scrubber.setActive(false),
    onUpdate: (self) => update(self.progress),
  });

  const handleResize = () => {
    measure();
    update(progress);
  };
  window.addEventListener("resize", handleResize, { passive: true });
  ScrollTrigger.addEventListener("refresh", measure);

  const rect = section.getBoundingClientRect();
  scrubber.setActive(rect.bottom > 0 && rect.top < window.innerHeight);
  update(trigger.progress);

  return {
    progress: () => progress,
    destroy() {
      trigger.kill();
      scrubber.destroy();
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.removeEventListener("refresh", measure);
      mascotVideo.pause();
      delete section.dataset.worksFlightProgress;
      delete section.dataset.worksFlightPhase;
      for (const element of [
        backdrop,
        effects,
        mascotLayer,
        landingMascot,
        copy,
        secondaryCopy,
        finalLayer,
        ...passCards,
        ...finalCards,
      ]) {
        element.removeAttribute("style");
      }
    },
  };
}
