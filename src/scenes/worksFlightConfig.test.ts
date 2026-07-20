import { describe, expect, it } from "vitest";
import {
  FINAL_CARD_FLIGHTS,
  FLIGHT_PASS_CARDS,
  WORKS_FLIGHT_CONFIG,
  finalCardStateAt,
  finalCardViewportOffsetAt,
  passCardStateAt,
  passCardViewportPointAt,
  quadraticBezierPoint,
  worksPageStateAt,
  worksFlightPhaseAt,
  worksFlightVideoTimeAt,
} from "./worksFlightConfig";

describe("制作実績へ飛ぶスクロール区間", () => {
  // 数値を直接書くと尺の調整のたびに落ちるので、境界は設定値から引く
  const C = WORKS_FLIGHT_CONFIG;
  const justBefore = (value: number) => value - 0.0001;

  it.each([
    [0, "system"],
    [justBefore(C.systemHoldEnd), "system"],
    [C.systemHoldEnd, "takeoff"],
    [justBefore(C.prepareEnd), "takeoff"],
    [C.prepareEnd, "flight"],
    [justBefore(C.centralFlightEnd), "flight"],
    [C.centralFlightEnd, "landing"],
    [justBefore(C.landingMotionEnd), "landing"],
    [C.landingMotionEnd, "works"],
    [1, "works"],
  ] as const)("進捗%fは%s区間になる", (progress, expected) => {
    expect(worksFlightPhaseAt(progress)).toBe(expected);
  });

  it("システム保持後は、透過マスコットが飛行状態のまま中央へ移る", () => {
    // 飛び立ちは保持の終わりと同時に始め、着地まで途切れさせない
    expect(WORKS_FLIGHT_CONFIG.takeoffMotionStart).toBe(
      WORKS_FLIGHT_CONFIG.systemHoldEnd,
    );
    expect(WORKS_FLIGHT_CONFIG.takeoffMotionEnd).toBe(
      WORKS_FLIGHT_CONFIG.prepareEnd,
    );
    expect(WORKS_FLIGHT_CONFIG.landingMotionStart).toBe(
      WORKS_FLIGHT_CONFIG.centralFlightEnd,
    );
    // 静止マスコットから動画への差し替えは保持の直後に済ませる
    expect(WORKS_FLIGHT_CONFIG.mascotSwapEnd).toBeLessThanOrEqual(
      WORKS_FLIGHT_CONFIG.systemHoldEnd + 0.02,
    );
    expect(WORKS_FLIGHT_CONFIG.mobileCentralMascotScale).toBeGreaterThan(1);
    expect(WORKS_FLIGHT_CONFIG.alphaVideoPath).toMatch(/\.webm$/);
  });

  it("PCは600〜850vh、モバイルは約23%短い距離を確保する", () => {
    expect(WORKS_FLIGHT_CONFIG.desktopLengthVh).toBeGreaterThanOrEqual(600);
    expect(WORKS_FLIGHT_CONFIG.desktopLengthVh).toBeLessThanOrEqual(850);
    expect(
      WORKS_FLIGHT_CONFIG.mobileLengthSvh /
        WORKS_FLIGHT_CONFIG.desktopLengthVh,
    ).toBeCloseTo(0.77, 1);
  });
});

describe("透過マスコット動画の時間写像", () => {
  const duration = 20;

  /*
    尺を調整しても意味が変わらないよう、境界は設定値から引く。
    確認したいのは「どの進捗が動画のどの節目に対応するか」であって、
    個別の数値そのものではない。
  */
  const C = WORKS_FLIGHT_CONFIG;
  const midpoint = (a: number, b: number) => (a + b) / 2;

  it.each([
    // 飛び立ち前は動画の見せ始めで止める
    [0, C.visibleVideoStartSeconds],
    [C.videoStart, C.visibleVideoStartSeconds],
    // 飛び立ち区間の中間は、見せ始めと接続点の中間へ
    [
      midpoint(C.takeoffMotionStart, C.takeoffMotionEnd),
      midpoint(C.visibleVideoStartSeconds, C.takeoffConnectionSeconds),
    ],
    // 飛び立ち終わりで接続点に着く
    [C.takeoffMotionEnd, C.takeoffConnectionSeconds],
    // 中央飛行の終わりで2本目の開始点へ
    [C.centralFlightEnd, C.secondVideoStartSeconds],
    // 着地で見せ終わりに着き、以降は動かさない
    [C.videoEnd, C.visibleVideoEndSeconds],
    [1, C.visibleVideoEndSeconds],
  ])("進捗%fを%f秒へ写像する", (progress, expected) => {
    expect(worksFlightVideoTimeAt(progress, duration)).toBeCloseTo(expected, 6);
  });

  it("逆スクロールでも単調に動画時間が戻る", () => {
    const times = [1, C.videoEnd, 0.7, 0.5, C.prepareEnd, C.videoStart, 0].map((progress) =>
      worksFlightVideoTimeAt(progress, duration),
    );
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("不正な動画尺を拒否する", () => {
    expect(() => worksFlightVideoTimeAt(0.5, 0)).toThrow(RangeError);
    expect(() => worksFlightVideoTimeAt(0.5, Number.NaN)).toThrow(RangeError);
  });
});

describe("飛行中に通過する演出カード", () => {
  it("実績デザイン4枚を順に出し、同時表示を最大2枚へ制限する", () => {
    expect(FLIGHT_PASS_CARDS).toHaveLength(4);
    for (let index = 1; index < FLIGHT_PASS_CARDS.length; index += 1) {
      expect(FLIGHT_PASS_CARDS[index].start).toBeGreaterThan(
        FLIGHT_PASS_CARDS[index - 1].start,
      );
    }

    let maximumVisible = 0;
    for (let sample = 0; sample <= 1000; sample += 1) {
      const progress = sample / 1000;
      const visible = FLIGHT_PASS_CARDS.filter(
        (_, index) => passCardStateAt(progress, index).opacity > 0.001,
      ).length;
      maximumVisible = Math.max(maximumVisible, visible);
    }
    expect(maximumVisible).toBe(2);
  });

  it("各カードはviewport中央の消失点から手前へ抜けて消える", () => {
    const viewport = { width: 1280, height: 720 };
    FLIGHT_PASS_CARDS.forEach((spec, index) => {
      const start = passCardViewportPointAt(spec.start, index, viewport);
      const middle = passCardStateAt((spec.start + spec.end) / 2, index);
      const end = passCardStateAt(spec.end, index);
      expect(start).toEqual({ x: 640, y: 360 });
      expect(middle.opacity).toBeGreaterThan(0.5);
      expect(middle.scale).toBeGreaterThan(0.25);
      expect(end.opacity).toBe(0);
      expect(end.scale).toBeGreaterThan(1);
    });
  });

  it("後続カード開始時も前カードは飛行中で、まとめて表示しない", () => {
    for (let index = 1; index < FLIGHT_PASS_CARDS.length; index += 1) {
      const progress = FLIGHT_PASS_CARDS[index].start;
      expect(passCardStateAt(progress, index).opacity).toBe(0);
      expect(passCardStateAt(progress, index - 1).opacity).toBeGreaterThan(0);
    }
  });
});

describe("最終4枚の制作実績カード", () => {
  it("着地へ向けて1枚ずつ登場し、グルーピング開始までに整列する", () => {
    // 開始位置そのものではなく、飛行の流れと矛盾しないことを見る
    expect(FINAL_CARD_FLIGHTS[0].start).toBeGreaterThan(
      WORKS_FLIGHT_CONFIG.prepareEnd,
    );
    expect(FINAL_CARD_FLIGHTS[0].start).toBeLessThan(
      WORKS_FLIGHT_CONFIG.centralFlightEnd,
    );
    for (let index = 1; index < FINAL_CARD_FLIGHTS.length; index += 1) {
      expect(FINAL_CARD_FLIGHTS[index].start).toBeGreaterThan(
        FINAL_CARD_FLIGHTS[index - 1].start,
      );
      expect(
        FINAL_CARD_FLIGHTS[index].start - FINAL_CARD_FLIGHTS[index - 1].start,
      ).toBeGreaterThanOrEqual(0.05);
    }
    // 4枚が揃ってからグルーピングへ入る(0.055刻みの加算で誤差が出るため丸めて比べる)
    expect(
      Number(Math.max(...FINAL_CARD_FLIGHTS.map(({ end }) => end)).toFixed(4)),
    ).toBeLessThanOrEqual(WORKS_FLIGHT_CONFIG.worksGroupingStart);
  });

  it("四方から入り、着地時点で2×2のDOM位置へ整列する", () => {
    expect(FINAL_CARD_FLIGHTS).toHaveLength(4);
    expect(
      FINAL_CARD_FLIGHTS.map(({ entryX, entryY }) => [
        Math.sign(entryX),
        Math.sign(entryY),
      ]),
    ).toEqual([
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]);

    FINAL_CARD_FLIGHTS.forEach((_, index) => {
      // 登場前は見えず、着地後は完全に整列している
      expect(
        finalCardStateAt(FINAL_CARD_FLIGHTS[0].start - 0.01, index).opacity,
      ).toBe(0);
      expect(finalCardStateAt(WORKS_FLIGHT_CONFIG.worksOneStart, index)).toMatchObject({
        opacity: 1,
        finalWeight: 1,
        scale: 1,
        blurPx: 0,
      });
    });
  });

  it("進入座標は左カラムでなくviewport全体を基準にする", () => {
    const viewport = { width: 1280, height: 720 };
    const finalCenters = [
      { x: 300, y: 280 },
      { x: 820, y: 280 },
      { x: 300, y: 540 },
      { x: 820, y: 540 },
    ];
    finalCenters.forEach((finalCenter, index) => {
      const state = finalCardStateAt(
        FINAL_CARD_FLIGHTS[index].start,
        index,
      );
      const offset = finalCardViewportOffsetAt(
        finalCenter,
        viewport,
        state,
        FINAL_CARD_FLIGHTS[index],
      );
      const point = {
        x: finalCenter.x + offset.x,
        y: finalCenter.y + offset.y,
      };
      expect(Math.abs(point.x - viewport.width / 2)).toBeGreaterThan(250);
      expect(Math.abs(point.y - viewport.height / 2)).toBeGreaterThan(140);
    });
  });

  it("右下→中央→右下の弧を逆スクロールでも同じ点へ戻せる", () => {
    const start = { x: 1160, y: 640 };
    const control = { x: 830, y: 396 };
    const end = { x: 640, y: 360 };
    expect(quadraticBezierPoint(start, control, end, 0)).toEqual(start);
    expect(quadraticBezierPoint(start, control, end, 1)).toEqual(end);
    const middle = quadraticBezierPoint(start, control, end, 0.5);
    expect(middle.x).toBeLessThan(start.x);
    expect(middle.y).toBeLessThan(start.y);
  });

  it("着地後は制作実績1の2枚から制作実績2の2枚へ連続して切り替わる", () => {
    // グルーピングは着地までに終える
    expect(WORKS_FLIGHT_CONFIG.worksGroupingEnd).toBeLessThanOrEqual(
      WORKS_FLIGHT_CONFIG.landingMotionEnd,
    );
    expect(WORKS_FLIGHT_CONFIG.worksGroupingStart).toBeLessThan(
      WORKS_FLIGHT_CONFIG.worksGroupingEnd,
    );
    // 実績1は着地と同時に出す
    expect(WORKS_FLIGHT_CONFIG.worksOneStart).toBeGreaterThanOrEqual(
      WORKS_FLIGHT_CONFIG.worksGroupingEnd,
    );
    // 実績1を読む時間を確保してから実績2へ渡す
    expect(
      WORKS_FLIGHT_CONFIG.worksTwoTransitionStart -
        WORKS_FLIGHT_CONFIG.worksOneStart,
    ).toBeGreaterThanOrEqual(0.08);
    // 実績2にも余韻を残し、次のセクションへ直結させない
    expect(1 - WORKS_FLIGHT_CONFIG.worksTwoTransitionEnd).toBeGreaterThanOrEqual(
      0.06,
    );
    expect(WORKS_FLIGHT_CONFIG.worksTwoTransitionStart).toBeGreaterThan(
      WORKS_FLIGHT_CONFIG.worksOneStart,
    );
    expect(WORKS_FLIGHT_CONFIG.worksTwoTransitionEnd).toBeLessThanOrEqual(1);

    // 実績1を読ませる区間の途中では、実績1だけが見えている
    const readingOne =
      (WORKS_FLIGHT_CONFIG.worksOneStart +
        WORKS_FLIGHT_CONFIG.worksTwoTransitionStart) /
      2;
    expect(worksPageStateAt(readingOne)).toMatchObject({
      flightOverviewOpacity: 0,
      worksOneOpacity: 1,
      worksTwoOpacity: 0,
    });
    // 末尾では実績2へ入れ替わり切っている
    expect(worksPageStateAt(1)).toMatchObject({
      worksOneOpacity: 0,
      worksTwoOpacity: 1,
      worksTwoLift: 1,
    });
    expect(worksPageStateAt(readingOne)).toEqual(worksPageStateAt(readingOne));
  });
});
