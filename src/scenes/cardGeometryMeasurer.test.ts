import { describe, expect, it } from "vitest";
import {
  measureCardGeometry,
  type MeasurableElement,
} from "./cardGeometryMeasurer";

interface StubOptions {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly transform?: string;
  readonly transition?: string;
}

interface StubElement extends MeasurableElement {
  readonly reads: Array<{ transform: string; transition: string }>;
}

function createStub(options: StubOptions): StubElement {
  const style = {
    transform: options.transform ?? "",
    transition: options.transition ?? "",
  };
  const reads: Array<{ transform: string; transition: string }> = [];
  return {
    style,
    reads,
    getBoundingClientRect() {
      reads.push({ transform: style.transform, transition: style.transition });
      return {
        left: options.left,
        top: options.top,
        width: options.width,
        height: options.height,
      };
    },
  };
}

describe("measureCardGeometry", () => {
  it("ステージ基準の中心座標を返す", () => {
    const stage = createStub({ left: 100, top: 50, width: 1500, height: 800 });
    const card = createStub({ left: 300, top: 250, width: 400, height: 300 });
    const [geometry] = measureCardGeometry([card], stage);
    expect(geometry).toEqual({ centerX: 400, centerY: 350 });
  });

  it("計測時はtransformとtransitionの両方を無効化している", () => {
    // transitionが生きたままだとtransform解除が計測に反映されず、
    // 持ち上げ済みの座標で行間を測ってしまう(リサイズ時のレイアウト崩れの原因)
    const stage = createStub({ left: 0, top: 0, width: 1500, height: 800 });
    const card = createStub({
      left: 0,
      top: 700,
      width: 400,
      height: 300,
      transform: "translate3d(0px, -513px, 0px)",
      transition: "transform 0.4s ease",
    });
    measureCardGeometry([card], stage);
    const measurementRead = card.reads[0];
    expect(measurementRead.transform).toBe("none");
    expect(measurementRead.transition).toBe("none");
  });

  it("計測後にtransformとtransitionを元へ戻す", () => {
    const stage = createStub({ left: 0, top: 0, width: 1500, height: 800 });
    const card = createStub({
      left: 0,
      top: 700,
      width: 400,
      height: 300,
      transform: "translate3d(0px, -513px, 0px)",
      transition: "transform 0.4s ease",
    });
    measureCardGeometry([card], stage);
    expect(card.style.transform).toBe("translate3d(0px, -513px, 0px)");
    expect(card.style.transition).toBe("transform 0.4s ease");
  });

  it("transform復元をreflowで確定させてからtransitionを戻す(復元アニメの発火防止)", () => {
    const stage = createStub({ left: 0, top: 0, width: 1500, height: 800 });
    const card = createStub({
      left: 0,
      top: 700,
      width: 400,
      height: 300,
      transform: "translate3d(0px, -513px, 0px)",
      transition: "transform 0.4s ease",
    });
    measureCardGeometry([card], stage);
    const lastRead = card.reads[card.reads.length - 1];
    expect(lastRead.transform).toBe("translate3d(0px, -513px, 0px)");
    expect(lastRead.transition).toBe("none");
  });

  it("計測が例外を投げてもスタイルを復元する", () => {
    const stage = createStub({ left: 0, top: 0, width: 1500, height: 800 });
    const card = createStub({
      left: 0,
      top: 700,
      width: 400,
      height: 300,
      transform: "translate3d(0px, -513px, 0px)",
      transition: "transform 0.4s ease",
    });
    const broken: MeasurableElement = {
      style: { transform: "", transition: "" },
      getBoundingClientRect() {
        throw new Error("計測失敗");
      },
    };
    expect(() => measureCardGeometry([card, broken], stage)).toThrow(
      "計測失敗",
    );
    expect(card.style.transform).toBe("translate3d(0px, -513px, 0px)");
    expect(card.style.transition).toBe("transform 0.4s ease");
  });

  it("カードが空でも安全に空配列を返す", () => {
    const stage = createStub({ left: 0, top: 0, width: 1500, height: 800 });
    expect(measureCardGeometry([], stage)).toEqual([]);
  });
});
