import { gsap } from "gsap";
import {
  STUDIO_SPEECH_TRANSITION,
  type StudioPresentation,
  type StudioReaction,
} from "./studioPresentation";

const MASCOT_GUIDE_START = 0.01;

export interface StudioMascotController {
  readonly setProgress: (
    progress: number,
    presentation: StudioPresentation,
  ) => void;
  readonly setVisible: (visible: boolean) => void;
  readonly destroy: () => void;
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`StudioMascot: ${selector} が見つかりません`);
  }
  return element;
}

export function initStudioMascot(): StudioMascotController {
  const idle = requiredElement<HTMLElement>(".js-studio-mascot-idle");
  const reaction = requiredElement<HTMLElement>(
    ".js-studio-mascot-reaction",
  );
  const sway = requiredElement<HTMLElement>(".js-studio-mascot-sway");
  const breathe = requiredElement<HTMLElement>(".js-studio-mascot-breathe");
  const shadow = requiredElement<HTMLElement>(".js-studio-mascot-shadow");
  const speech = requiredElement<HTMLElement>(".js-studio-mascot-speech");
  const speechText = requiredElement<HTMLElement>(".js-studio-speech-text");

  const mascotIdleTimeline = gsap
    .timeline({ paused: true, repeat: -1, yoyo: true })
    .to(idle, { y: -4, duration: 1.4, ease: "sine.inOut" });
  const mascotSwayTimeline = gsap
    .timeline({ paused: true, repeat: -1, yoyo: true })
    .fromTo(
      sway,
      { rotation: -1 },
      { rotation: 1, duration: 2.1, ease: "sine.inOut" },
    );
  const mascotBreathTimeline = gsap
    .timeline({ paused: true, repeat: -1, yoyo: true })
    .to(breathe, { scale: 1.012, duration: 1.7, ease: "sine.inOut" });
  const mascotShadowTimeline = gsap
    .timeline({ paused: true, repeat: -1, yoyo: true })
    .to(shadow, {
      scaleX: 0.9,
      scaleY: 0.82,
      opacity: 0.46,
      duration: 1.4,
      ease: "sine.inOut",
    });
  const idleTimelines = [
    mascotIdleTimeline,
    mascotSwayTimeline,
    mascotBreathTimeline,
    mascotShadowTimeline,
  ];

  let active = false;
  let sceneVisible = true;
  let progressEligible = false;
  let currentPresentation: StudioPresentation | null = null;
  let speechBubbleTimeline: gsap.core.Timeline | null = null;
  let mascotReactionTimeline: gsap.core.Timeline | null = null;

  const updateSpeech = (presentation: StudioPresentation) => {
    speechText.textContent = presentation.speech;
    speech.dataset.speechScene = presentation.id;
  };

  const playSpeech = (
    presentation: StudioPresentation,
    switching: boolean,
  ) => {
    speechBubbleTimeline?.kill();
    speechBubbleTimeline = gsap.timeline();

    if (switching) {
      speechBubbleTimeline
        .to(speech, {
          opacity: 0,
          y: STUDIO_SPEECH_TRANSITION.exit.y,
          scale: STUDIO_SPEECH_TRANSITION.exit.scale,
          filter: `blur(${STUDIO_SPEECH_TRANSITION.exit.blurPx}px)`,
          duration: STUDIO_SPEECH_TRANSITION.exitDuration,
          ease: "power2.in",
        })
        .add(() => updateSpeech(presentation));
    } else {
      updateSpeech(presentation);
    }

    speechBubbleTimeline.fromTo(
      speech,
      {
        opacity: 0,
        y: STUDIO_SPEECH_TRANSITION.enter.y,
        scale: STUDIO_SPEECH_TRANSITION.enter.scale,
        filter: `blur(${STUDIO_SPEECH_TRANSITION.enter.blurPx}px)`,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: "blur(0px)",
        duration: STUDIO_SPEECH_TRANSITION.enterDuration,
        ease: "power2.out",
      },
    );
  };

  const playReaction = (reactionName: StudioReaction) => {
    mascotReactionTimeline?.kill();
    gsap.set(reaction, { x: 0, y: 0, rotation: 0, scale: 1 });
    mascotReactionTimeline = gsap.timeline({
      defaults: { ease: "sine.inOut" },
    });

    if (reactionName === "bounce") {
      mascotReactionTimeline
        .to(reaction, { y: -7, rotation: -1.2, duration: 0.16 })
        .to(reaction, { y: 0, rotation: 1, duration: 0.18 })
        .to(reaction, { rotation: 0, duration: 0.16 });
      return;
    }
    if (reactionName === "focus") {
      mascotReactionTimeline
        .to(reaction, { y: 2, rotation: 2.5, scale: 0.992, duration: 0.24 })
        .to(reaction, { y: 0, rotation: 0, scale: 1, duration: 0.3 });
      return;
    }
    if (reactionName === "working") {
      mascotReactionTimeline
        .to(reaction, { x: -3, y: 1, rotation: -1.2, duration: 0.16 })
        .to(reaction, { x: 3, y: -1, rotation: 1.2, duration: 0.2 })
        .to(reaction, { x: 0, y: 0, rotation: 0, duration: 0.18 });
      return;
    }
    mascotReactionTimeline
      .to(reaction, { y: -9, scale: 1.06, duration: 0.18, ease: "power2.out" })
      .to(reaction, { y: 0, scale: 1, duration: 0.32, ease: "bounce.out" });
  };

  const setActive = (nextActive: boolean) => {
    if (active === nextActive) return;
    active = nextActive;
    if (active) {
      for (const timeline of idleTimelines) timeline.play();
      if (currentPresentation) {
        playSpeech(currentPresentation, false);
        playReaction(currentPresentation.reaction);
      }
      return;
    }

    speechBubbleTimeline?.kill();
    mascotReactionTimeline?.kill();
    for (const timeline of idleTimelines) timeline.pause(0);
    gsap.set([idle, reaction, sway, breathe], { clearProps: "transform" });
    gsap.set(shadow, { clearProps: "transform,opacity" });
    gsap.set(speech, {
      opacity: 0,
      y: STUDIO_SPEECH_TRANSITION.enter.y,
      scale: STUDIO_SPEECH_TRANSITION.enter.scale,
      filter: `blur(${STUDIO_SPEECH_TRANSITION.enter.blurPx}px)`,
    });
  };

  gsap.set(speech, {
    opacity: 0,
    y: STUDIO_SPEECH_TRANSITION.enter.y,
    scale: STUDIO_SPEECH_TRANSITION.enter.scale,
    filter: `blur(${STUDIO_SPEECH_TRANSITION.enter.blurPx}px)`,
  });

  return {
    setProgress(progress, presentation) {
      const changed = currentPresentation?.id !== presentation.id;
      currentPresentation = presentation;
      progressEligible = progress >= MASCOT_GUIDE_START;
      setActive(sceneVisible && progressEligible);
      if (!changed) return;
      if (!active) {
        updateSpeech(presentation);
        return;
      }
      playSpeech(presentation, true);
      playReaction(presentation.reaction);
    },
    setVisible(visible) {
      sceneVisible = visible;
      setActive(sceneVisible && progressEligible);
    },
    destroy() {
      speechBubbleTimeline?.kill();
      mascotReactionTimeline?.kill();
      for (const timeline of idleTimelines) {
        timeline.kill();
      }
      gsap.killTweensOf([idle, reaction, sway, breathe, shadow, speech]);
    },
  };
}
