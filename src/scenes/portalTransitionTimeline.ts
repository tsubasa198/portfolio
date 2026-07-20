import { gsap } from "gsap";
import { TRANSITION_CONFIG } from "./portalTransitionConfig";

export interface PortalTimelineElements {
  readonly existingVideo: HTMLVideoElement;
  readonly additionalVideo: HTMLVideoElement;
  readonly canvas: HTMLCanvasElement;
  readonly glow: HTMLElement;
  readonly flash: HTMLElement;
  readonly bridge: HTMLElement;
  readonly vignette: HTMLElement;
  readonly heroIdleBackground: HTMLImageElement;
  readonly heroIdleMascot: HTMLElement;
  readonly heroDetailLayer: HTMLElement;
  readonly heroCopy: HTMLElement;
  readonly nextPreview: HTMLElement | null;
  readonly scrollHint: HTMLElement | null;
}

/** 動画時刻には触れず、2本の映像を覆うHTML/CSS前景だけを制御する。 */
export function createPortalTransitionTimeline(
  elements: PortalTimelineElements,
): gsap.core.Timeline {
  const {
    existingVideo,
    additionalVideo,
    canvas,
    glow,
    flash,
    bridge,
    vignette,
    heroIdleBackground,
    heroIdleMascot,
    heroDetailLayer,
    heroCopy,
    nextPreview,
    scrollHint,
  } = elements;
  const config = TRANSITION_CONFIG;
  const mobile = window.matchMedia(
    `(max-width: ${config.mobileBreakpoint}px)`,
  ).matches;
  const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });

  gsap.set(existingVideo, {
    autoAlpha: 1,
    scale: 1,
    filter: "brightness(1) saturate(1) blur(0px)",
    objectPosition: mobile ? "83% 50%" : "50% 50%",
    transformOrigin: "50% 50%",
  });
  gsap.set(additionalVideo, {
    autoAlpha: 0,
    scale: 1.025,
    filter: "brightness(1.14) saturate(1.08) blur(2.4px)",
    objectPosition: "50% 50%",
    transformOrigin: "50% 50%",
  });
  gsap.set(canvas, { autoAlpha: 0.3 });
  gsap.set(glow, {
    autoAlpha: 0.24,
    "--portal-glow-x": mobile ? "83%" : "76%",
    "--portal-glow-y": mobile ? "48%" : "49%",
    "--portal-glow-radius": "18vmax",
  });
  gsap.set(flash, {
    autoAlpha: 0,
    "--portal-flash-x": mobile ? "70%" : "64%",
    "--portal-flash-radius": "10vmax",
  });
  gsap.set(bridge, { autoAlpha: 0 });
  gsap.set(vignette, { autoAlpha: mobile ? 0.72 : 0.34 });
  gsap.set(heroIdleBackground, { autoAlpha: 1, scale: 1 });
  gsap.set(heroIdleMascot, {
    autoAlpha: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  });
  gsap.set(heroDetailLayer, { autoAlpha: 1, scale: 1 });
  gsap.set(heroCopy, { autoAlpha: 1, y: 0, filter: "blur(0px)" });
  if (nextPreview) {
    gsap.set(nextPreview, {
      autoAlpha: 0,
      x: 0,
      y: 20,
      scale: 1,
      filter: "blur(8px)",
      letterSpacing: "0.045em",
    });
  }
  if (scrollHint) gsap.set(scrollHint, { autoAlpha: 1 });

  // 冒頭1.8%: 待機モーションと背景プレートを同時に動画へ短く引き継ぐ。
  timeline
    .to(
      heroIdleMascot,
      {
        autoAlpha: 0,
        y: -5,
        scale: 1.015,
        filter: "blur(2px)",
        duration: config.heroIdleHandoffEnd,
        ease: "power1.out",
      },
      0,
    )
    .to(
      heroIdleBackground,
      {
        autoAlpha: 0,
        scale: 1.004,
        duration: config.heroIdleHandoffEnd,
        ease: "power1.out",
      },
      0,
    );

  // 10〜22%: Heroコピーと精密装飾を退場させ、ポータルへ視線を集める。
  timeline
    .to(
      heroCopy,
      {
        autoAlpha: 0,
        y: -48,
        filter: "blur(10px)",
        duration: config.approachEnd - config.heroEnd,
        ease: "power1.inOut",
      },
      config.heroEnd,
    )
    .to(
      heroDetailLayer,
      {
        autoAlpha: 0,
        scale: 1.025,
        duration: config.approachEnd - config.heroEnd,
        ease: "power1.inOut",
      },
      config.heroEnd,
    )
    .to(
      existingVideo,
      {
        objectPosition: mobile ? "62% 50%" : "50% 50%",
        filter: "brightness(0.94) saturate(1.03) blur(0px)",
        duration: config.approachEnd - config.heroEnd,
        ease: "power2.out",
      },
      config.heroEnd,
    )
    .to(
      vignette,
      { autoAlpha: 0.62, duration: config.approachEnd - config.heroEnd },
      config.heroEnd,
    )
    .to(
      glow,
      {
        autoAlpha: 0.68,
        "--portal-glow-x": "62%",
        "--portal-glow-radius": "28vmax",
        duration: config.approachEnd - config.heroEnd,
        ease: "power2.out",
      },
      config.heroEnd,
    );
  if (scrollHint) {
    timeline.to(scrollHint, { autoAlpha: 0, duration: 0.04 }, config.heroEnd);
  }

  // 22〜38%: 既存動画のポータルへ突入し、消失点を中央へ合わせる。
  timeline
    .to(
      existingVideo,
      {
        objectPosition: "50% 50%",
        scale: 1.025,
        filter: "brightness(1.18) saturate(1.08) blur(1px)",
        duration: config.portalExposurePeak - config.approachEnd,
        ease: "power2.in",
      },
      config.approachEnd,
    )
    .to(
      existingVideo,
      {
        scale: 1,
        filter: "brightness(1.02) saturate(1.02) blur(0px)",
        duration: config.portalEntryEnd - config.portalExposurePeak,
        ease: "power2.out",
      },
      config.portalExposurePeak,
    )
    .to(
      flash,
      {
        autoAlpha: 0.76,
        "--portal-flash-x": "50%",
        "--portal-flash-radius": "76vmax",
        duration: config.portalFlashPeak - config.portalFlashStart,
        ease: "power3.in",
      },
      config.portalFlashStart,
    )
    .to(
      flash,
      {
        autoAlpha: 0.08,
        duration: config.portalEntryEnd - config.portalFlashPeak,
        ease: "power2.out",
      },
      config.portalFlashPeak,
    )
    .to(
      canvas,
      { autoAlpha: 0.86, duration: config.portalEntryEnd - config.approachEnd },
      config.approachEnd,
    );

  // 38〜44%: 既存動画のトンネル終盤。前景粒子は次動画まで止めない。
  timeline.to(
    existingVideo,
    {
      scale: 1.012,
      filter: "brightness(1.04) saturate(1.06) blur(0px)",
      duration: config.existingTunnelEnd - config.heroJourneyEnd,
    },
    config.heroJourneyEnd,
  );

  // 44〜47%: 両動画を動かしたまま、中央光・放射ブラーで継ぎ目を覆う。
  const bridgeMid =
    config.existingTunnelEnd +
    (config.videoBridgeEnd - config.existingTunnelEnd) * 0.56;
  timeline
    .to(
      existingVideo,
      {
        autoAlpha: 0,
        scale: 1.018,
        filter: "brightness(1.22) saturate(1.08) blur(1.6px)",
        duration: config.videoBridgeEnd - config.existingTunnelEnd,
        ease: "none",
      },
      config.existingTunnelEnd,
    )
    .to(
      additionalVideo,
      {
        autoAlpha: 1,
        scale: 1,
        filter: "brightness(1) saturate(1.02) blur(0px)",
        duration: config.videoBridgeEnd - config.existingTunnelEnd,
        ease: "none",
      },
      config.existingTunnelEnd,
    )
    .to(
      flash,
      {
        autoAlpha: 0.46,
        "--portal-flash-x": "50%",
        "--portal-flash-radius": "48vmax",
        duration: bridgeMid - config.existingTunnelEnd,
        ease: "power2.in",
      },
      config.existingTunnelEnd,
    )
    .to(
      flash,
      {
        autoAlpha: 0.04,
        duration: config.videoBridgeEnd - bridgeMid,
        ease: "power2.out",
      },
      bridgeMid,
    )
    .to(
      vignette,
      {
        autoAlpha: 0.72,
        duration: config.videoBridgeEnd - config.existingTunnelEnd,
      },
      config.existingTunnelEnd,
    );

  // 47〜82%: 追加動画をほぼ全尺で進め、終盤ではスマートフォンだけ右の被写体を追う。
  timeline
    .to(
      additionalVideo,
      {
        objectPosition: mobile
          ? `${config.additionalVideoMobileObjectPositionX * 100}% 50%`
          : "50% 50%",
        scale: 1,
        duration: config.additionalVideoEnd - config.videoBridgeEnd,
        ease: "power1.inOut",
      },
      config.videoBridgeEnd,
    )
    .to(
      glow,
      {
        autoAlpha: 0.14,
        "--portal-glow-x": "50%",
        "--portal-glow-radius": "22vmax",
        duration: 0.12,
      },
      config.videoBridgeEnd,
    );

  if (nextPreview) {
    const previewRevealEnd = config.previewStart + 0.035;
    timeline
      .to(
        nextPreview,
        {
          autoAlpha: 1,
          y: 0,
          filter: "blur(0px)",
          letterSpacing: "0.01em",
          duration: previewRevealEnd - config.previewStart,
          ease: "power2.out",
        },
        config.previewStart,
      )
      .to(
        nextPreview,
        {
          autoAlpha: 0,
          y: -20,
          filter: "blur(8px)",
          duration: config.previewEnd - config.previewHoldEnd,
          ease: "power2.in",
        },
        config.previewHoldEnd,
      );
  }

  // 82〜89%: 単体PNGへ受け渡し、動画内のポータルなど環境要素だけを消す。
  timeline
    .to(
      additionalVideo,
      {
        autoAlpha: 0,
        scale: 1,
        filter: "brightness(0.62) saturate(0.72) blur(1.2px)",
        duration: config.stillVideoFadeEnd - config.additionalVideoEnd,
        ease: "power1.inOut",
      },
      config.additionalVideoEnd,
    )
    .to(
      bridge,
      {
        autoAlpha: 0.34,
        duration: config.stillVideoFadeEnd - config.additionalVideoEnd,
        ease: "power2.in",
      },
      config.additionalVideoEnd,
    )
    .to(
      bridge,
      {
        autoAlpha: 0,
        duration: config.stillHandoffEnd - config.stillVideoFadeEnd,
        ease: "power2.out",
      },
      config.stillVideoFadeEnd,
    )
    .to(
      canvas,
      {
        autoAlpha: 0,
        duration: config.stillHandoffEnd - config.additionalVideoEnd,
      },
      config.additionalVideoEnd,
    )
    .to(
      glow,
      {
        autoAlpha: 0,
        duration: config.stillHandoffEnd - config.additionalVideoEnd,
      },
      config.additionalVideoEnd,
    )
    .to(
      vignette,
      {
        autoAlpha: 0.24,
        duration: config.stillHandoffEnd - config.additionalVideoEnd,
      },
      config.additionalVideoEnd,
    );

  // timeline.progress()と設定上の0〜1を一致させるため、無描画の時計を1まで延ばす。
  const normalizedClock = { value: 0 };
  timeline.to(
    normalizedClock,
    { value: 1, duration: config.end - config.stillHandoffEnd },
    config.stillHandoffEnd,
  );

  return timeline;
}
