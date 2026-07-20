import { clamp01, segmentProgress } from "../core/sceneProgress";

const PASS_CARD_START = 0.29;
const PASS_CARD_INTERVAL = 0.085;
const PASS_CARD_DURATION = 0.115;
const PASS_CARD_START_SCALE = 0.14;
const PASS_CARD_END_SCALE = 1.58;
const PASS_CARD_START_BLUR_PX = 18;
const FINAL_CARD_START = 0.52;
const FINAL_CARD_DELAY = 0.055;
const FINAL_CARD_END = 0.71;
const FINAL_CARD_END_DELAY = 0.02;
const FINAL_CARD_OPACITY_DURATION = 0.025;

export const WORKS_FLIGHT_CONFIG = {
  systemHoldEnd: 0.11,
  mascotSwapStart: 0.11,
  mascotSwapEnd: 0.122,
  prepareEnd: 0.21,
  takeoffMotionStart: 0.11,
  takeoffMotionEnd: 0.21,
  centralFlightEnd: 0.6,
  landingMotionStart: 0.6,
  landingMotionEnd: 0.78,
  mascotHandoffStart: 0.772,
  videoStart: 0.11,
  videoEnd: 0.78,
  visibleVideoStartSeconds: 1.75,
  takeoffConnectionSeconds: 4.8,
  secondVideoStartSeconds: 10,
  visibleVideoEndSeconds: 16.75,
  effectsStart: 0.11,
  effectsPeak: 0.3,
  effectsFadeStart: 0.6,
  effectsEnd: 0.78,
  headingStart: 0.78,
  headingEnd: 0.85,
  worksGroupingStart: 0.62,
  worksGroupingEnd: 0.72,
  worksOneStart: 0.78,
  worksTwoTransitionStart: 0.89,
  worksOneExitEnd: 0.905,
  worksTwoTransitionEnd: 0.915,
  desktopLengthVh: 850,
  mobileLengthSvh: 655,
  mobileBreakpoint: 820,
  mobileCentralMascotScale: 1.55,
  totalVideoSeconds: 20,
  smoothing: 0.14,
  catchUpSmoothing: 0.28,
  catchUpThresholdSeconds: 0.65,
  videoReadyTimeoutMs: 20_000,
  alphaVideoPath: "/assets/works-flight/mascot-achievements-alpha.webm",
  landingMascotPath: "/assets/portal-arrival/1-1-alpha.png",
} as const;

export type WorksFlightPhase =
  | "system"
  | "takeoff"
  | "flight"
  | "landing"
  | "works";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface NormalizedSubjectBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface FlightPassCardSpec {
  readonly start: number;
  readonly end: number;
  readonly exitX: number;
  readonly exitY: number;
  readonly rotateXDeg: number;
  readonly rotateYDeg: number;
  readonly rotateZDeg: number;
}

export interface FlightPassCardState {
  readonly opacity: number;
  readonly scale: number;
  readonly blurPx: number;
  readonly rotateXDeg: number;
  readonly rotateYDeg: number;
  readonly rotateZDeg: number;
  readonly travel: number;
}

export interface FinalCardFlightSpec {
  readonly start: number;
  readonly end: number;
  readonly entryX: number;
  readonly entryY: number;
  readonly rotateXDeg: number;
  readonly rotateYDeg: number;
  readonly rotateZDeg: number;
}

export interface FinalCardFlightState {
  readonly entryWeight: number;
  readonly finalWeight: number;
  readonly opacity: number;
  readonly scale: number;
  readonly blurPx: number;
  readonly rotateXDeg: number;
  readonly rotateYDeg: number;
  readonly rotateZDeg: number;
}

export interface WorksPageState {
  readonly flightOverviewOpacity: number;
  readonly worksOneOpacity: number;
  readonly worksTwoOpacity: number;
  readonly worksTwoLift: number;
}

/** Visionで透過した実フレームのalpha bboxを1280×720へ正規化した値。 */
export const TAKEOFF_START_SUBJECT_BOUNDS: NormalizedSubjectBounds = {
  left: 626 / 1280,
  top: 130 / 720,
  width: 435 / 1280,
  height: 485 / 720,
};

export const TAKEOFF_FRONT_SUBJECT_BOUNDS: NormalizedSubjectBounds = {
  left: 431 / 1280,
  top: 146 / 720,
  width: 400 / 1280,
  height: 421 / 720,
};

export const LANDING_START_SUBJECT_BOUNDS: NormalizedSubjectBounds = {
  left: 394 / 1280,
  top: 118 / 720,
  width: 485 / 1280,
  height: 469 / 720,
};

export const LANDING_END_SUBJECT_BOUNDS: NormalizedSubjectBounds = {
  left: 606 / 1280,
  top: 99 / 720,
  width: 460 / 1280,
  height: 515 / 720,
};

export const GUIDE_MASCOT_ALPHA_BOUNDS: NormalizedSubjectBounds = {
  left: 237 / 1254,
  top: 65 / 1254,
  width: 848 / 1254,
  height: 1021 / 1254,
};

const PASS_CARD_DIRECTIONS = [
  [-0.74, -0.52, 7, -12, -8],
  [0.72, 0.48, -6, 11, 7],
  [0.7, -0.46, 8, 12, -7],
  [-0.7, 0.5, -8, -10, 9],
] as const;

export const FLIGHT_PASS_CARDS: readonly FlightPassCardSpec[] =
  PASS_CARD_DIRECTIONS.map(
    ([exitX, exitY, rotateXDeg, rotateYDeg, rotateZDeg], index) => {
      const start = PASS_CARD_START + PASS_CARD_INTERVAL * index;
      return {
        start,
        end: start + PASS_CARD_DURATION,
        exitX,
        exitY,
        rotateXDeg,
        rotateYDeg,
        rotateZDeg,
      };
    },
  );

const FINAL_CARD_DIRECTIONS = [
  [-1, -1, 6, -12, -7],
  [1, -1, -6, 12, 7],
  [-1, 1, -7, -11, 8],
  [1, 1, 7, 11, -8],
] as const;

export const FINAL_CARD_FLIGHTS: readonly FinalCardFlightSpec[] =
  FINAL_CARD_DIRECTIONS.map(
    ([entryX, entryY, rotateXDeg, rotateYDeg, rotateZDeg], index) => ({
      start: FINAL_CARD_START + FINAL_CARD_DELAY * index,
      end: FINAL_CARD_END + FINAL_CARD_END_DELAY * index,
      entryX,
      entryY,
      rotateXDeg,
      rotateYDeg,
      rotateZDeg,
    }),
  );

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function smoothstep(value: number): number {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

export function worksFlightPhaseAt(progress: number): WorksFlightPhase {
  const value = Number.isFinite(progress) ? clamp01(progress) : 0;
  if (value < WORKS_FLIGHT_CONFIG.systemHoldEnd) return "system";
  if (value < WORKS_FLIGHT_CONFIG.takeoffMotionEnd) return "takeoff";
  if (value < WORKS_FLIGHT_CONFIG.centralFlightEnd) return "flight";
  if (value < WORKS_FLIGHT_CONFIG.landingMotionEnd) return "landing";
  return "works";
}

/** 2本の動作部分をスクロール区間へ分け、待ちフレームは表示しない。 */
export function worksFlightVideoTimeAt(
  progress: number,
  duration: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError(`制作実績遷移の動画時間が不正です: ${duration}`);
  }
  const value = Number.isFinite(progress) ? clamp01(progress) : 0;
  const start = Math.min(WORKS_FLIGHT_CONFIG.visibleVideoStartSeconds, duration);
  const takeoffConnection = Math.min(
    WORKS_FLIGHT_CONFIG.takeoffConnectionSeconds,
    duration,
  );
  const secondVideoStart = Math.min(
    WORKS_FLIGHT_CONFIG.secondVideoStartSeconds,
    duration,
  );
  const end = Math.min(WORKS_FLIGHT_CONFIG.visibleVideoEndSeconds, duration);

  if (value < WORKS_FLIGHT_CONFIG.takeoffMotionStart) return start;
  if (value < WORKS_FLIGHT_CONFIG.takeoffMotionEnd) {
    return (
      start +
      segmentProgress(
        value,
        WORKS_FLIGHT_CONFIG.takeoffMotionStart,
        WORKS_FLIGHT_CONFIG.takeoffMotionEnd,
      ) *
        (takeoffConnection - start)
    );
  }
  if (value < WORKS_FLIGHT_CONFIG.centralFlightEnd) {
    return (
      takeoffConnection +
      segmentProgress(
        value,
        WORKS_FLIGHT_CONFIG.takeoffMotionEnd,
        WORKS_FLIGHT_CONFIG.centralFlightEnd,
      ) *
        (secondVideoStart - takeoffConnection)
    );
  }
  if (value < WORKS_FLIGHT_CONFIG.landingMotionEnd) {
    return (
      secondVideoStart +
      segmentProgress(
        value,
        WORKS_FLIGHT_CONFIG.landingMotionStart,
        WORKS_FLIGHT_CONFIG.landingMotionEnd,
      ) *
        (end - secondVideoStart)
    );
  }
  return end;
}

export function passCardStateAt(
  progress: number,
  cardIndex: number,
): FlightPassCardState {
  const spec = FLIGHT_PASS_CARDS[cardIndex];
  if (!spec) {
    throw new RangeError(`通過カード番号が不正です: ${cardIndex}`);
  }
  const travel = segmentProgress(progress, spec.start, spec.end);
  const entrance = easeOutCubic(segmentProgress(travel, 0, 0.18));
  const exit = smoothstep(segmentProgress(travel, 0.72, 1));
  return {
    opacity: entrance * (1 - exit),
    scale:
      PASS_CARD_START_SCALE +
      (PASS_CARD_END_SCALE - PASS_CARD_START_SCALE) * easeOutCubic(travel),
    blurPx: PASS_CARD_START_BLUR_PX * (1 - easeOutCubic(travel)),
    rotateXDeg: spec.rotateXDeg * travel,
    rotateYDeg: spec.rotateYDeg * travel,
    rotateZDeg: spec.rotateZDeg * travel,
    travel,
  };
}

export function passCardViewportPointAt(
  progress: number,
  cardIndex: number,
  viewport: ViewportSize,
): Point {
  const spec = FLIGHT_PASS_CARDS[cardIndex];
  if (!spec) {
    throw new RangeError(`通過カード番号が不正です: ${cardIndex}`);
  }
  const travel = passCardStateAt(progress, cardIndex).travel;
  const distance = Math.pow(travel, 1.35);
  return {
    x: viewport.width / 2 + spec.exitX * viewport.width * distance,
    y: viewport.height / 2 + spec.exitY * viewport.height * distance,
  };
}

export function finalCardStateAt(
  progress: number,
  cardIndex: number,
): FinalCardFlightState {
  const spec = FINAL_CARD_FLIGHTS[cardIndex];
  if (!spec) {
    throw new RangeError(`制作実績カード番号が不正です: ${cardIndex}`);
  }
  const arrival = smoothstep(segmentProgress(progress, spec.start, spec.end));
  const opacity = easeOutCubic(
    segmentProgress(
      progress,
      spec.start,
      spec.start + FINAL_CARD_OPACITY_DURATION,
    ),
  );
  return {
    entryWeight: 1 - arrival,
    finalWeight: arrival,
    opacity,
    scale: 0.84 + 0.16 * arrival,
    blurPx: 12 * (1 - arrival),
    rotateXDeg: spec.rotateXDeg * (1 - arrival),
    rotateYDeg: spec.rotateYDeg * (1 - arrival),
    rotateZDeg: spec.rotateZDeg * (1 - arrival),
  };
}

/** 着地後の4枚を、同じstage内で2枚ずつの連続した作品ページへ分ける。 */
export function worksPageStateAt(progress: number): WorksPageState {
  const value = Number.isFinite(progress) ? clamp01(progress) : 0;
  const flightOverviewOpacity =
    1 -
    smoothstep(
      segmentProgress(
        value,
        WORKS_FLIGHT_CONFIG.worksGroupingStart,
        WORKS_FLIGHT_CONFIG.worksGroupingEnd,
      ),
    );
  const worksTwoLift = smoothstep(
    segmentProgress(
      value,
      WORKS_FLIGHT_CONFIG.worksTwoTransitionStart,
      WORKS_FLIGHT_CONFIG.worksTwoTransitionEnd,
    ),
  );

  return {
    flightOverviewOpacity,
    worksOneOpacity:
      1 -
      smoothstep(
        segmentProgress(
          value,
          WORKS_FLIGHT_CONFIG.worksTwoTransitionStart,
          WORKS_FLIGHT_CONFIG.worksOneExitEnd,
        ),
      ),
    worksTwoOpacity: worksTwoLift,
    worksTwoLift,
  };
}

/** 最終DOMのカラム位置ではなく、viewport中心から四方へ進入点を作る。 */
export function finalCardViewportOffsetAt(
  finalCenter: Point,
  viewport: ViewportSize,
  state: FinalCardFlightState,
  spec: FinalCardFlightSpec,
): Point {
  const entryPoint = {
    x: viewport.width / 2 + spec.entryX * viewport.width * 0.54,
    y: viewport.height / 2 + spec.entryY * viewport.height * 0.42,
  };
  return {
    x: (entryPoint.x - finalCenter.x) * state.entryWeight,
    y: (entryPoint.y - finalCenter.y) * state.entryWeight,
  };
}

export function quadraticBezierPoint(
  start: Point,
  control: Point,
  end: Point,
  progress: number,
): Point {
  const value = clamp01(progress);
  const remaining = 1 - value;
  return {
    x:
      remaining * remaining * start.x +
      2 * remaining * value * control.x +
      value * value * end.x,
    y:
      remaining * remaining * start.y +
      2 * remaining * value * control.y +
      value * value * end.y,
  };
}
