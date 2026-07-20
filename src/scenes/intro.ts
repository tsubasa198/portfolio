/** Hero動画、スクロール時刻、HTML前景、Canvasを一本の補間進捗へ束ねる。 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { IntegratedVideoScrubber } from "./integratedVideoScrub";
import { PortalTunnelCanvas } from "./portalTunnelCanvas";
import { TRANSITION_CONFIG, portalPhaseAt } from "./portalTransitionConfig";
import {
  createPortalTransitionTimeline,
  type PortalTimelineElements,
} from "./portalTransitionTimeline";

export interface IntroScene {
  readonly progress: () => number;
  readonly visualProgress: () => number;
  readonly activeSceneId: () => "hero" | "tunnel" | "hearing";
  readonly destroy: () => void;
}

function requireElement<T extends Element>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`IntroScene: ${selector} が見つかりません`);
  return element;
}

export function initIntroScene(onUpdate?: () => void): IntroScene {
  const section = requireElement<HTMLElement>(".js-intro");
  const stage = requireElement<HTMLElement>(".js-intro-stage", section);
  const video = requireElement<HTMLVideoElement>(".js-portal-video", section);
  const additionalVideo = requireElement<HTMLVideoElement>(
    ".js-arrival-video",
    section,
  );
  const canvas = requireElement<HTMLCanvasElement>(
    ".js-portal-tunnel-canvas",
    section,
  );
  const heroCopy = requireElement<HTMLElement>('[data-copy="hero"]', section);
  const nextPreview = section.querySelector<HTMLElement>(
    ".js-portal-next-preview",
  );
  const scrollHint = section.querySelector<HTMLElement>(".js-scroll-hint");
  const heroIdleBackground = requireElement<HTMLImageElement>(
    ".js-hero-idle-background",
    section,
  );
  const heroIdleMascot = requireElement<HTMLElement>(
    ".js-hero-idle-mascot",
    section,
  );
  const heroDetailLayer = requireElement<HTMLElement>(
    ".js-hero-detail-layer",
    section,
  );
  const heroForegroundLayer = requireElement<HTMLElement>(
    ".js-hero-foreground-layer",
    section,
  );

  heroCopy.classList.add("is-visible");
  nextPreview?.classList.add("is-visible");
  video.pause();
  additionalVideo.pause();

  const elements: PortalTimelineElements = {
    existingVideo: video,
    additionalVideo,
    canvas,
    glow: requireElement(".js-portal-glow", section),
    flash: requireElement(".js-portal-flash", section),
    bridge: requireElement(".js-portal-bridge", section),
    vignette: requireElement(".portal-video-vignette", section),
    heroIdleBackground,
    heroIdleMascot,
    heroDetailLayer,
    heroForegroundLayer,
    heroCopy,
    nextPreview,
    scrollHint,
  };

  const renderer = new PortalTunnelCanvas(canvas);
  const timeline = createPortalTransitionTimeline(elements);
  let targetProgress = 0;
  let visualProgress = 0;
  let sceneVisible = true;
  let documentVisible = document.visibilityState !== "hidden";
  let destroyed = false;

  const scrubber = new IntegratedVideoScrubber(video, additionalVideo, {
    smoothing: TRANSITION_CONFIG.videoSmoothing,
    seekEpsilonSeconds: TRANSITION_CONFIG.videoSeekEpsilonSeconds,
    settleEpsilon: TRANSITION_CONFIG.progressSettleEpsilon,
    maxDeltaMs: TRANSITION_CONFIG.videoMaxDeltaMs,
    onUpdate: (progress, times) => {
      visualProgress = progress;
      timeline.progress(visualProgress);
      section.dataset.portalVisualProgress = visualProgress.toFixed(4);
      section.dataset.portalVideoTime = times.existingTime.toFixed(3);
      section.dataset.arrivalVideoTime = times.additionalTime.toFixed(3);
      // 大きく移動した後も、補間映像が境界へ追いついた時点でナビを同期する。
      onUpdate?.();
    },
    onDecodedFrame: (name, mediaTime) => {
      if (name === "existing") {
        section.dataset.portalDecodedTime = mediaTime.toFixed(3);
      } else {
        section.dataset.arrivalDecodedTime = mediaTime.toFixed(3);
      }
    },
    onError: (error) => {
      section.dataset.portalVideoError = error.message;
      console.error("ポータル動画のスクラブを停止しました", error);
    },
  });

  const resize = () => {
    const bounds = stage.getBoundingClientRect();
    renderer.resize(
      bounds.width || window.innerWidth,
      bounds.height || window.innerHeight,
      window.devicePixelRatio || 1,
    );
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  const updateActiveState = () => {
    scrubber.setActive(sceneVisible && documentVisible);
  };

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      sceneVisible = entry?.isIntersecting ?? false;
      updateActiveState();
    },
    { rootMargin: "100% 0px" },
  );
  visibilityObserver.observe(section);

  const handleVisibilityChange = () => {
    documentVisible = document.visibilityState !== "hidden";
    updateActiveState();
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  const updateMetadata = (value: number) => {
    targetProgress = value;
    section.dataset.portalProgress = targetProgress.toFixed(4);
    section.dataset.portalPhase = portalPhaseAt(targetProgress);
    onUpdate?.();
  };

  const trigger = ScrollTrigger.create({
    id: "hero-portal-video",
    trigger: section,
    start: "top top",
    end: "bottom bottom",
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      updateMetadata(self.progress);
      scrubber.setProgress(self.progress);
    },
  });

  timeline.progress(0);
  updateMetadata(trigger.progress);
  scrubber.setProgress(trigger.progress);
  section.dataset.portalReady = "true";

  const renderTick = () => {
    if (destroyed || !sceneVisible || !documentVisible) return;
    renderer.render(visualProgress, performance.now());
  };
  gsap.ticker.add(renderTick);
  renderTick();

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    trigger.kill();
    timeline.kill();
    scrubber.destroy();
    gsap.ticker.remove(renderTick);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    visibilityObserver.disconnect();
    resizeObserver.disconnect();
    renderer.clear();
    video.pause();
    additionalVideo.pause();
    delete section.dataset.portalReady;
  };

  return {
    progress: () => targetProgress,
    visualProgress: () => visualProgress,
    activeSceneId: () => {
      if (visualProgress < TRANSITION_CONFIG.heroJourneyEnd) return "hero";
      if (visualProgress < TRANSITION_CONFIG.studioPreludeStart)
        return "tunnel";
      return "hearing";
    },
    destroy,
  };
}
