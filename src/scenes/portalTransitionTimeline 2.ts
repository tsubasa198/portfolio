import { gsap } from "gsap";
import { TRANSITION_CONFIG } from "./portalTransitionConfig";

export interface PortalTimelineElements {
  readonly frame1: HTMLElement;
  readonly frame2: HTMLElement;
  readonly frame3: HTMLElement;
  readonly frame4: HTMLElement;
  readonly frame5: HTMLElement;
  readonly heroSubject: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly bloom: HTMLElement;
  readonly turnBlur: HTMLElement;
  readonly flash: HTMLElement;
  readonly heroCopy: HTMLElement;
  readonly tunnelCopy: HTMLElement | null;
  readonly scrollHint: HTMLElement | null;
}

/**
 * 画像をページ単位でフェードさせず、空間マスクとカメラ姿勢で繋ぐマスターTL。
 * duration=1のため、設定値をそのままスクロール進捗として読める。
 */
export function createPortalTransitionTimeline(
  elements: PortalTimelineElements,
): gsap.core.Timeline {
  const {
    frame1,
    frame2,
    frame3,
    frame4,
    frame5,
    heroSubject,
    canvas,
    bloom,
    turnBlur,
    flash,
    heroCopy,
    tunnelCopy,
    scrollHint,
  } = elements;
  const config = TRANSITION_CONFIG;
  const fullMaskRadius = `${config.maskRadiusVmax}vmax`;
  const deepMaskStartRadius = `${config.deepMaskStartRadiusVmax}vmax`;
  const deepMaskTravelRadius = `${config.deepMaskTravelRadiusVmax}vmax`;
  const deepMaskEndRadius = `${config.deepMaskEndRadiusVmax}vmax`;
  const flashStartRadius = `${config.flashStartRadiusVmax}vmax`;
  const flashPeakRadius = `${config.flashPeakRadiusVmax}vmax`;
  const flashExitRadius = `${config.flashExitRadiusVmax}vmax`;
  const mobile = window.matchMedia(
    `(max-width: ${TRANSITION_CONFIG.mobileBreakpoint}px)`,
  ).matches;
  const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  const heroSurface = frame1.querySelector<HTMLElement>(
    ".portal-frame__surface",
  );
  const runnerSurface = frame2.querySelector<HTMLElement>(
    ".portal-frame__surface",
  );
  const portalSurface = frame3.querySelector<HTMLElement>(
    ".portal-frame__surface",
  );
  const frame5Surface = frame5.querySelector<HTMLElement>(
    ".portal-frame__surface",
  );
  if (!heroSurface || !runnerSurface || !portalSurface || !frame5Surface) {
    throw new Error("PortalTimeline: Heroのinner wrapperが見つかりません");
  }

  // timeline上のtime=0のsetはprogress=0で巻き戻るため、初期画は直接確定する。
  gsap.set(frame1, {
    x: 0,
    y: 0,
    scale: 1,
    rotationY: 0,
    rotationZ: 0,
    transformOrigin: "78% 46%",
  });
  gsap.set(frame2, {
    x: 0,
    y: 0,
    scale: 0.985,
    rotationY: 0,
    rotationZ: 0,
    transformOrigin: "78% 46%",
    "--portal-mask-radius": "0vmax",
    "--portal-mask-x": "68%",
    "--portal-mask-y": mobile ? "84%" : "59%",
    filter: "blur(9px) brightness(1.16)",
  });
  gsap.set(frame3, {
    x: 0,
    y: 0,
    scale: 1,
    rotationY: 0,
    rotationZ: 0,
    transformOrigin: "50% 45%",
    "--portal-mask-radius": "0vmax",
    "--portal-mask-x": "78%",
    "--portal-mask-y": "45%",
    filter: "blur(7px) brightness(1.12)",
  });
  gsap.set(portalSurface, {
    x: "28vw",
    y: 0,
    scale: 0.92,
    rotationY: -12,
    rotationZ: 0.8,
    transformOrigin: "50% 45%",
  });
  gsap.set(frame4, {
    x: 0,
    y: "-5vh",
    scale: 1.08,
    transformOrigin: "50% 54%",
    "--portal-mask-radius": "0vmax",
    filter: "blur(8px) brightness(1.2)",
  });
  gsap.set(frame5, {
    x: 0,
    y: 0,
    scale: 1,
    "--portal-mask-radius": "0vmax",
    "--portal-mask-x": "51%",
    "--portal-mask-y": "61%",
    filter: "none",
  });
  gsap.set(frame5Surface, {
    x: 0,
    y: "4vh",
    scale: 2.02,
    transformOrigin: "51% 61%",
    filter: "blur(5px) brightness(1.15)",
  });
  gsap.set(heroSubject, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
  gsap.set(canvas, { autoAlpha: 0.62 });
  gsap.set(bloom, {
    autoAlpha: 0.58,
    xPercent: -50,
    yPercent: -50,
    x: "28vw",
    scale: 1,
  });
  gsap.set(turnBlur, { autoAlpha: 0, scale: 0.55 });
  gsap.set(flash, {
    autoAlpha: 0,
    "--portal-flash-radius": flashStartRadius,
    mixBlendMode: config.flashBlendMode,
  });
  gsap.set(heroCopy, { autoAlpha: 1, y: 0 });
  if (mobile) {
    gsap.set([heroSurface, runnerSurface], { y: "29vh", scale: 0.64 });
  }
  if (tunnelCopy) gsap.set(tunnelCopy, { autoAlpha: 0, y: 22 });
  if (scrollHint) gsap.set(scrollHint, { autoAlpha: 1 });

  // 18〜35%: 発光と局所マスクの中で正面向きから背面走行へ切り替える。
  if (mobile) {
    timeline.to(
      [heroSurface, runnerSurface],
      {
        y: 0,
        scale: 1,
        duration: config.approachEnd - config.heroEnd,
        ease: "power1.inOut",
      },
      config.heroEnd,
    );
  }
  timeline
    .to(
      [frame1, frame2],
      {
        x: "-2.5vw",
        y: "-1vh",
        scale: 1.1,
        duration: config.approachEnd - config.heroEnd,
      },
      config.heroEnd,
    )
    .to(
      frame2,
      {
        "--portal-mask-radius": `${config.approachMaskRadiusVmax}vmax`,
        "--portal-mask-x": "72%",
        "--portal-mask-y": "52%",
        filter: "blur(0px) brightness(1.04)",
        duration: config.approachEnd - config.heroEnd,
        ease: "power1.inOut",
      },
      config.heroEnd,
    )
    .to(
      heroSubject,
      {
        autoAlpha: 0,
        y: "-1.5vh",
        scale: 0.93,
        filter: "blur(7px)",
        duration: 0.105,
      },
      0.205,
    )
    .to(turnBlur, { autoAlpha: 0.94, scale: 1, duration: 0.055 }, 0.205)
    .to(turnBlur, { autoAlpha: 0, scale: 1.55, duration: 0.085 }, 0.26)
    .to(
      bloom,
      {
        autoAlpha: 0.92,
        scale: 1.48,
        y: mobile ? "-30vh" : 0,
        duration: config.approachEnd - config.heroEnd,
      },
      config.heroEnd,
    )
    .to(
      heroCopy,
      {
        autoAlpha: 0,
        y: -34,
        duration: config.approachEnd - config.heroEnd,
      },
      config.heroEnd,
    );
  if (scrollHint) timeline.to(scrollHint, { autoAlpha: 0, duration: 0.06 }, 0.18);

  // 35〜52%: 右の斜め構図を正面中央へ回り込み、3枚目をポータル内から展開。
  timeline
    .to(
      [frame1, frame2],
      {
        x: 0,
        y: 0,
        scale: 1.1,
        rotationY: 0,
        rotationZ: 0,
        duration: config.portalFaceEnd - config.approachEnd,
        ease: "power1.inOut",
      },
      config.approachEnd,
    )
    .to(
      frame2,
      {
        "--portal-mask-radius": fullMaskRadius,
        "--portal-mask-x": "74%",
        "--portal-mask-y": "48%",
        filter: "blur(4px) brightness(1.08)",
        duration: config.portalFaceEnd - config.approachEnd,
      },
      config.approachEnd,
    )
    .to(
      frame3,
      {
        "--portal-mask-radius": fullMaskRadius,
        "--portal-mask-x": "50%",
        filter: "blur(0px) brightness(1.03)",
        duration: config.portalFaceEnd - config.approachEnd,
        ease: "power1.inOut",
      },
      config.approachEnd,
    )
    .to(
      portalSurface,
      {
        x: 0,
        y: 0,
        scale: 1.15,
        rotationY: 0,
        rotationZ: 0,
        duration: config.portalFaceEnd - config.approachEnd,
        ease: "power1.inOut",
      },
      config.approachEnd,
    )
    .to(
      bloom,
      {
        x: 0,
        y: mobile ? "-30vh" : 0,
        scale: 2.3,
        autoAlpha: 0.82,
        duration: config.portalFaceEnd - config.approachEnd,
        ease: "power1.inOut",
      },
      config.approachEnd,
    )
    .to(turnBlur, { autoAlpha: 0.36, scale: 2.1, duration: 0.07 }, 0.395)
    .to(turnBlur, { autoAlpha: 0, scale: 2.8, duration: 0.08 }, 0.465);

  if (tunnelCopy) {
    timeline
      .to(tunnelCopy, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.395)
      .to(tunnelCopy, { autoAlpha: 0, y: -24, duration: 0.09 }, 0.535);
  }

  // 52〜65%: ポータル中心から視界を覆い、同じ中心のままトンネルへ突入。
  timeline
    .to(
      frame3,
      {
        scale: 3.62,
        filter: "blur(11px) brightness(1.35)",
        duration: config.tunnelEntryEnd - config.portalFaceEnd,
        ease: "power2.in",
      },
      config.portalFaceEnd,
    )
    .to(
      frame4,
      {
        y: 0,
        scale: 1.02,
        "--portal-mask-radius": fullMaskRadius,
        filter: "blur(0px) brightness(1)",
        duration: config.tunnelEntryEnd - config.portalFaceEnd,
        ease: "power1.inOut",
      },
      config.portalFaceEnd,
    )
    .to(bloom, { autoAlpha: 1, scale: 6.8, duration: 0.065 }, 0.52)
    .to(bloom, { autoAlpha: 0.18, scale: 10.5, duration: 0.065 }, 0.585)
    .to(
      flash,
      {
        autoAlpha: 0.9,
        "--portal-flash-radius": flashPeakRadius,
        duration: 0.055,
      },
      0.545,
    )
    .to(
      flash,
      {
        autoAlpha: 0.08,
        "--portal-flash-radius": flashExitRadius,
        duration: 0.075,
      },
      0.6,
    )
    .to(canvas, { autoAlpha: 1, duration: 0.13 }, 0.52)
    .set(frame5, { "--portal-mask-radius": deepMaskStartRadius }, 0.632)
    .to(
      frame5Surface,
      { filter: "blur(1px) brightness(1.08)", duration: 0.018 },
      0.632,
    );

  // 65〜83%: 画像4を質感の基準に保ち、被写体だけを奥へ送り続ける。
  timeline
    .to(
      frame4,
      {
        scale: 1.2,
        y: "-1.2vh",
        filter: "blur(1.2px) brightness(1.04)",
        duration: config.tunnelTravelEnd - config.tunnelEntryEnd,
      },
      config.tunnelEntryEnd,
    )
    .to(
      frame5,
      {
        "--portal-mask-radius": deepMaskTravelRadius,
        duration: config.tunnelTravelEnd - config.tunnelEntryEnd,
        ease: "power1.inOut",
      },
      config.tunnelEntryEnd,
    )
    .to(
      frame5Surface,
      {
        scale: 1.28,
        y: 0,
        filter: "blur(0px) brightness(1.06)",
        duration: config.tunnelTravelEnd - config.tunnelEntryEnd,
        ease: "power1.inOut",
      },
      config.tunnelEntryEnd,
    )
    .to(bloom, { autoAlpha: 0.3, scale: 1.55, duration: 0.18 }, 0.65);

  // 83〜96%: 動くCanvasと中央光の下で5枚目を放射マスク展開する。
  timeline
    .to(
      frame4,
      {
        scale: 1.31,
        filter: "blur(3.5px) brightness(1.12)",
        duration: config.tunnelDeepEnd - config.tunnelTravelEnd,
      },
      config.tunnelTravelEnd,
    )
    .to(
      frame5,
      {
        "--portal-mask-radius": deepMaskEndRadius,
        "--portal-mask-x": "51%",
        "--portal-mask-y": "49%",
        duration: config.tunnelDeepEnd - config.tunnelTravelEnd,
        ease: "power2.out",
      },
      config.tunnelTravelEnd,
    )
    .to(
      frame5Surface,
      {
        y: 0,
        scale: 1,
        transformOrigin: "51% 49%",
        filter: "blur(0px) brightness(1.04)",
        duration: config.tunnelDeepEnd - config.tunnelTravelEnd,
        ease: "power1.inOut",
      },
      config.tunnelTravelEnd,
    )
    .set(flash, { "--portal-flash-radius": flashStartRadius }, 0.855)
    .to(
      flash,
      {
        autoAlpha: 0.34,
        "--portal-flash-radius": flashPeakRadius,
        duration: 0.045,
      },
      0.855,
    )
    .to(
      flash,
      {
        autoAlpha: 0,
        "--portal-flash-radius": flashExitRadius,
        duration: 0.07,
      },
      0.9,
    )
    .to(bloom, { autoAlpha: 0.5, scale: 1.2, duration: 0.13 }, 0.83);

  // 96〜100%: 中央光を残してStudioを奥から露出させる。
  timeline
    .to(
      frame5Surface,
      { scale: 1.08, filter: "blur(2px) brightness(1.16)", duration: 0.04 },
      0.96,
    )
    .to(canvas, { autoAlpha: 0.18, duration: 0.04 }, 0.96)
    .to(bloom, { autoAlpha: 0.86, scale: 3.5, duration: 0.04 }, 0.96)
    .set(flash, { "--portal-flash-radius": flashStartRadius }, 0.96)
    .to(
      flash,
      {
        autoAlpha: 0.48,
        "--portal-flash-radius": flashExitRadius,
        duration: 0.04,
      },
      0.96,
    );

  // 0〜18%にも明示的な長さを持たせ、timeline.duration()を常に1へ固定する。
  timeline.set({}, {}, config.end);
  return timeline;
}
